import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabaseAdmin = createSupabaseServerClient(request);
  const sessionId = params.id;

  if (!sessionId) return NextResponse.json({ error: 'Session ID required' }, { status: 400 });

  const { data: session, error } = await supabaseAdmin
    .from('checkout_sessions')
    .select('id, status, amount, currency, solana_pay_url, updated_at')
    .eq('id', sessionId)
    .single();

  if (error || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Fetch latest on-chain transaction for this session if present
  const { data: tx, error: txErr } = await supabaseAdmin
    .from('onchain_transactions')
    .select('id, signature, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: session.id,
    status: session.status,
    amount: session.amount,
    currency: session.currency,
    solanaPayUrl: session.solana_pay_url,
    updatedAt: session.updated_at,
    transaction: tx || null,
  });
}
