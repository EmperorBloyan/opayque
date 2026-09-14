import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (merchantError) return NextResponse.json({ error: merchantError.message }, { status: 500 });
  if (!merchant?.id) return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });

  // Fetch recent completed ledger payments
  const { data: transactions, error } = await supabase
    .from('payment_ledger')
    .select('amount, created_at, status')
    .eq('merchant_id', merchant.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate basic metrics
  const totalVolume = transactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
  const transactionCount = transactions?.length || 0;

  return NextResponse.json({ 
    metrics: {
      totalVolume,
      transactionCount,
    },
    recentTransactions: transactions?.slice(0, 10) || []
  });
}
