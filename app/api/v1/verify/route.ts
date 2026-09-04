import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatch';
import { verifySolanaTransaction } from '@/lib/solana/verify';
import { assertProductionConfig, getAssetMintAddress, isDevnetNetwork } from '@/lib/solana/constants';
import { selectHealthyRpcUrl } from '@/lib/solana/rpc';
import * as Sentry from '@/lib/sentry';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseServerClient(request);
  try {
    const body = await request.json();
    const { sessionId, transactionSignature } = body;

    if (!sessionId || !transactionSignature) {
      return NextResponse.json({ error: 'Session ID and Transaction Signature required' }, { status: 400 });
    }

    // 1. Fetch the session and the merchant's settlement wallet
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('checkout_sessions')
      .select('*, merchants(settlement_wallet_address)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ success: true, status: 'completed', message: 'Session already completed' });
    }

    const expectedMerchantWallet = session.merchants?.settlement_wallet_address;
    if (!expectedMerchantWallet) {
      return NextResponse.json({ error: 'Merchant settlement wallet not configured' }, { status: 400 });
    }

    // 2. Verify against Solana RPC
    assertProductionConfig();
    const rpcUrl = await selectHealthyRpcUrl();
    const isDevnet = isDevnetNetwork();
    const settlementToken = String(session.settlement_token || 'USDC').toUpperCase();

    if (settlementToken !== 'USDC') {
      return NextResponse.json({ error: 'Only USDC checkout verification is supported' }, { status: 400 });
    }

    const verification = await verifySolanaTransaction({
      signature: transactionSignature,
      expectedMerchantWallet,
      expectedAmount: Number(session.amount_token ?? session.amount),
      expectedTokenMint: getAssetMintAddress('USDC', isDevnet),
      expectedTokenDecimals: 6,
      rpcUrl,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'On-chain verification failed', details: verification.reason }, { status: 400 });
    }

    // 4. Mark Session as Completed
    await supabaseAdmin
      .from('checkout_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .in('status', ['created', 'pending', 'pending_signature', 'submitted']);

    const { data: ledger } = await supabaseAdmin
      .from('payment_ledger')
      .update({ status: 'confirmed', signature: transactionSignature, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString(), reconciliation_status: 'matched' })
      .eq('checkout_session_id', session.id)
      .in('status', ['created', 'pending_signature', 'submitted'])
      .select('*')
      .maybeSingle();
    if (ledger) await dispatchWebhookEvent({ merchantId: ledger.merchant_id, environment: ledger.environment === 'mainnet' ? 'mainnet' : 'sandbox', eventType: 'payment.confirmed', payload: ledger });

    // 5. Dispatch Webhook to the Merchant
    await dispatchWebhookEvent({
      merchantId: session.merchant_id,
      environment: session.environment,
      eventType: 'checkout.session.completed',
      payload: {
        sessionId: session.id,
        amount: Number(session.amount_token ?? session.amount),
        amountFiat: Number(session.amount_fiat ?? session.amount),
        currency: session.currency,
        settlementToken,
        referenceId: session.reference_id,
        customerEmail: session.customer_email,
        transactionSignature,
      },
    });

    return NextResponse.json({ success: true, status: 'completed' });
  } catch (error: unknown) {
    Sentry.captureException(error);
    console.error('Verification Error:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Unable to verify payment' }, { status: 500 });
  }
}
