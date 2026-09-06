import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const settlementWalletAddress = typeof body?.settlementWalletAddress === 'string'
    ? body.settlementWalletAddress.trim()
    : '';
  if (!settlementWalletAddress) {
    return NextResponse.json({ error: 'A settlement wallet address is required' }, { status: 400 });
  }

  const { data: merchant, error } = await supabase
    .from('merchants')
    .update({
      onboarding_status: 'completed',
      settlement_wallet_address: settlementWalletAddress,
      updated_at: new Date().toISOString(),
    })
    .eq('auth_user_id', user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Merchant onboarding update failed' }, { status: 500 });
  if (!merchant) return NextResponse.json({ error: 'Merchant profile not found. Complete merchant setup first.' }, { status: 404 });
  return NextResponse.json({ success: true, merchant });
}
