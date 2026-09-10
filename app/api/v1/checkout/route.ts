import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { authenticateApiKey } from '@/lib/auth/apiKey';
import { normalizeIdempotencyKey } from '@/lib/payments/ledger';
import { parseAmountToBaseUnits } from '@/lib/payments/amount';
import { buildPaymentRequestFingerprint } from '@/lib/payments/fingerprint';
import { getAssetMintAddress, isDevnetNetwork } from '@/lib/solana/constants';
import { normalizeTransferMode } from '@/lib/payments/transferMode';

function getRequestOrigin(request: Request): string {
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${protocol}://${host}`.replace(/\/$/, '');
}

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseServerClient();
  // 1. Authenticate the API Key
  const authHeader = request.headers.get('Authorization');
  const auth = await authenticateApiKey(authHeader);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await request.json();
    const { amount, currency = 'USD', customerEmail, referenceId } = body;
    const normalizedCurrency = String(currency).trim().toUpperCase();
    const idempotencyKey = normalizeIdempotencyKey(request.headers.get('Idempotency-Key') || body?.idempotencyKey);
    const amountBaseUnits = parseAmountToBaseUnits(amount, 6);

    if (!amountBaseUnits || normalizedCurrency !== 'USD' && normalizedCurrency !== 'USDC') {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }
    const normalizedAmount = Number(amountBaseUnits) / 1_000_000;
    if (!Number.isSafeInteger(Number(amountBaseUnits)) || normalizedAmount >= 1_000_000) {
      return NextResponse.json({ error: 'Amount is outside the supported range' }, { status: 400 });
    }
    const requestFingerprint = buildPaymentRequestFingerprint({ amount: String(amount), currency: normalizedCurrency, customerEmail: customerEmail ?? null, referenceId: referenceId ?? null });

    if (idempotencyKey) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('checkout_sessions')
        .select('id, idempotency_fingerprint, solana_pay_url, status, reference_id, transfer_mode')
        .eq('merchant_id', auth.merchantId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingError) return NextResponse.json({ error: 'Unable to resolve idempotency key' }, { status: 500 });
      if (existing) {
        if (existing.idempotency_fingerprint !== requestFingerprint) return NextResponse.json({ error: 'Idempotency key was already used for a different checkout' }, { status: 409 });
        return NextResponse.json({ id: existing.id, url: existing.solana_pay_url, solanaPayUrl: existing.solana_pay_url, status: existing.status, referenceId: existing.reference_id, transferMode: normalizeTransferMode(existing.transfer_mode), idempotent: true });
      }
    }

    // 2. Fetch merchant wallet address for the Solana Pay URL
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('settlement_wallet_address, default_transfer_mode')
      .eq('id', auth.merchantId)
      .single();

    if (!merchant?.settlement_wallet_address) {
      return NextResponse.json({ error: 'Merchant settlement wallet not configured' }, { status: 400 });
    }
    const transferMode = normalizeTransferMode(merchant.default_transfer_mode);

    // 3. Create Checkout Session
    const { data: session, error } = await supabaseAdmin
      .from('checkout_sessions')
      .insert([{
        merchant_id: auth.merchantId,
        environment: auth.environment,
        amount: normalizedAmount,
        amount_fiat: normalizedAmount,
        amount_token: normalizedAmount,
        settlement_token: 'USDC',
        currency: normalizedCurrency,
        customer_email: customerEmail,
        reference_id: referenceId,
        idempotency_key: idempotencyKey,
        idempotency_fingerprint: requestFingerprint,
        status: 'pending',
        transfer_mode: transferMode,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && idempotencyKey) {
        const { data: existing } = await supabaseAdmin.from('checkout_sessions').select('id, idempotency_fingerprint, solana_pay_url, status, reference_id, transfer_mode').eq('merchant_id', auth.merchantId).eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existing?.idempotency_fingerprint === requestFingerprint) return NextResponse.json({ id: existing.id, url: existing.solana_pay_url, solanaPayUrl: existing.solana_pay_url, status: existing.status, referenceId: existing.reference_id, transferMode: normalizeTransferMode(existing.transfer_mode), idempotent: true });
        return NextResponse.json({ error: 'Idempotency key was already used for a different checkout' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    // 4. Construct Solana Pay URL (Placeholder structure)
    const solanaPayUrl = `solana:${merchant.settlement_wallet_address}?amount=${normalizedAmount.toFixed(6)}&reference=${session.id}&label=Opayque+Checkout`;

    // 5. Update session with URL
    await supabaseAdmin
      .from('checkout_sessions')
      .update({ solana_pay_url: solanaPayUrl })
      .eq('id', session.id);

    const { error: ledgerError } = await supabaseAdmin.from('payment_ledger').insert({
      merchant_id: auth.merchantId,
      checkout_session_id: session.id,
      token_symbol: 'USDC',
      amount: normalizedAmount,
      amount_base_units: Number(amountBaseUnits),
      mint: getAssetMintAddress('USDC', isDevnetNetwork()),
      recipient_address: merchant.settlement_wallet_address,
      environment: auth.environment,
      idempotency_key: idempotencyKey,
      idempotency_fingerprint: requestFingerprint,
      status: 'created',
      transfer_mode: transferMode,
    });
    if (ledgerError) {
      await supabaseAdmin.from('checkout_sessions').delete().eq('id', session.id);
      if (ledgerError.code === '23505' && idempotencyKey) {
        const { data: existing } = await supabaseAdmin.from('checkout_sessions').select('id, solana_pay_url, status, reference_id, transfer_mode').eq('merchant_id', auth.merchantId).eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existing) return NextResponse.json({ id: existing.id, url: existing.solana_pay_url, solanaPayUrl: existing.solana_pay_url, status: existing.status, referenceId: existing.reference_id, transferMode: normalizeTransferMode(existing.transfer_mode), idempotent: true });
      }
      return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
    }

    return NextResponse.json({
      id: session.id,
      url: `${getRequestOrigin(request)}/checkout?address=${encodeURIComponent(merchant.settlement_wallet_address)}&amount=${encodeURIComponent(normalizedAmount.toFixed(6))}&fiat_amount=${encodeURIComponent(normalizedAmount.toFixed(2))}&currency=${encodeURIComponent(normalizedCurrency)}&token=USDC&session=${encodeURIComponent(session.id)}&mode=${encodeURIComponent(transferMode)}`,
      solanaPayUrl,
      status: session.status,
      referenceId: session.reference_id,
      transferMode,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Unable to create checkout' }, { status: 500 });
  }
}
