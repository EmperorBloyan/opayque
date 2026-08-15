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

  const body = await request.json();
  const { settlementWalletAddress } = body;

  const { data: merchant, error } = await supabase
    .from('merchants')
    .upsert({
      auth_user_id: user.id,
      email: user.email!,
      onboarding_status: 'completed',
      settlement_wallet_address: settlementWalletAddress || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, merchant });
}
