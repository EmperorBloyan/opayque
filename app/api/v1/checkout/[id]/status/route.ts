import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabaseAdmin = createSupabaseServerClient(request);
  const sessionId = params.id;

  if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

  const { data: session, error } = await supabaseAdmin
    .from('checkout_sessions')
    .select('id, status, amount, currency, solana_pay_url, updated_at, merchants(settlement_wallet_address)')
    .eq('id', sessionId)
    .single();

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Fetch the latest ledger record for this session if present
  const { data: tx, error: txErr } = await supabaseAdmin
    .from('payment_ledger')
    .select('id, signature, created_at')
    .eq('checkout_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: session.id,
    status: session.status,
    amount: session.amount,
    currency: session.currency,
    merchantWallet: session.merchants?.settlement_wallet_address || null,
    solanaPayUrl: session.solana_pay_url,
    updatedAt: session.updated_at,
    transaction: tx || null,
  });
}
