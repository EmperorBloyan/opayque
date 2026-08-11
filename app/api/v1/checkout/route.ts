import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/auth/apiKey';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  // 1. Authenticate the API Key
  const authHeader = request.headers.get('Authorization');
  const auth = await authenticateApiKey(authHeader);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await request.json();
    const { amount, currency = 'USDC', customerEmail, referenceId } = body;

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

    // 3. Create Checkout Session
    const { data: session, error } = await supabaseAdmin
      .from('checkout_sessions')
      .insert([{
        merchant_id: auth.merchantId,
        environment: auth.environment,
        amount,
        currency,
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
      url: `https://your-domain.com/checkout/${session.id}`, // Hosted checkout page
      solanaPayUrl,
      status: session.status,
      referenceId: session.reference_id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
