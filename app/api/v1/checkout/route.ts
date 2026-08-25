import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { authenticateApiKey } from '@/lib/auth/apiKey';

function getRequestOrigin(request: Request): string {
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  return `${protocol}://${host}`.replace(/\/$/, '');
}

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseServerClient(request);
  // 1. Authenticate the API Key
  const authHeader = request.headers.get('Authorization');
  const auth = await authenticateApiKey(authHeader);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await request.json();
    const { amount, currency = 'USD', customerEmail, referenceId } = body;
    const normalizedCurrency = String(currency).trim().toUpperCase();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // 2. Fetch merchant wallet address for the Solana Pay URL
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('settlement_wallet_address')
      .eq('id', auth.merchantId)
      .single();

    if (!merchant?.settlement_wallet_address) {
      return NextResponse.json({ error: 'Merchant settlement wallet not configured' }, { status: 400 });
    }

    if (normalizedCurrency !== 'USD' && normalizedCurrency !== 'USDC') {
      return NextResponse.json({ error: 'Only USD/USDC checkout amounts are supported' }, { status: 400 });
    }

    // 3. Create Checkout Session
    const { data: session, error } = await supabaseAdmin
      .from('checkout_sessions')
      .insert([{
        merchant_id: auth.merchantId,
        environment: auth.environment,
        amount,
        currency: normalizedCurrency,
        customer_email: customerEmail,
        reference_id: referenceId,
      }])
      .select()
      .single();

    if (error) throw error;

    // 4. Construct Solana Pay URL (Placeholder structure)
    const solanaPayUrl = `solana:${merchant.settlement_wallet_address}?amount=${amount}&reference=${session.id}&label=Opayque+Checkout`;

    // 5. Update session with URL
    await supabaseAdmin
      .from('checkout_sessions')
      .update({ solana_pay_url: solanaPayUrl })
      .eq('id', session.id);

    return NextResponse.json({
      id: session.id,
      url: `${getRequestOrigin(request)}/checkout?address=${encodeURIComponent(merchant.settlement_wallet_address)}&amount=${encodeURIComponent(Number(amount).toFixed(2))}&fiat_amount=${encodeURIComponent(Number(amount).toFixed(2))}&currency=${encodeURIComponent(normalizedCurrency)}&token=USDC&session=${encodeURIComponent(session.id)}`,
      solanaPayUrl,
      status: session.status,
      referenceId: session.reference_id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
