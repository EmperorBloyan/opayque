import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabaseAdmin = createSupabaseServerClient(request);
  const requestedId = params.id;

  if (!requestedId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

  let { data: session, error } = await supabaseAdmin
    .from('checkout_sessions')
    .select('id, status, amount, currency, transfer_mode, solana_pay_url, updated_at, merchants(settlement_wallet_address)')
    .eq('id', requestedId)
    .maybeSingle();

  if (!session && !error) {
    const { data: intent, error: intentError } = await supabaseAdmin
      .from('payment_ledger')
      .select('checkout_session_id')
      .eq('id', requestedId)
      .maybeSingle();

    if (intentError) {
      error = intentError;
    } else if (intent?.checkout_session_id) {
      const sessionLookup = await supabaseAdmin
        .from('checkout_sessions')
        .select('id, status, amount, currency, transfer_mode, solana_pay_url, updated_at, merchants(settlement_wallet_address)')
        .eq('id', intent.checkout_session_id)
        .maybeSingle();
      session = sessionLookup.data;
      error = sessionLookup.error;
    }
  }

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const sessionId = session.id;

  // Fetch the latest ledger record for this session if present
  const { data: tx, error: txErr } = await supabaseAdmin
    .from('payment_ledger')
    .select('id, signature, status, created_at')
    .eq('checkout_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: session.id,
    status: session.status,
    amount: session.amount,
    currency: session.currency,
    transferMode: session.transfer_mode === 'public' ? 'public' : 'private',
    paymentStatus: tx?.status || null,
    merchantWallet: session.merchants?.settlement_wallet_address || null,
    solanaPayUrl: session.solana_pay_url,
    updatedAt: session.updated_at,
    transaction: tx || null,
  });
}
