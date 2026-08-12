import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie set skipped if called from server component context
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('id, email, merchant_name, merchant_logo, secondary_email, onboarding_status, settlement_wallet_address, tee_enforcement_enabled')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ merchant: merchant || null });
  } catch (err: any) {
    console.error('GET /api/v1/merchant error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie set skipped
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { merchantName, merchantLogo, secondaryEmail, settlementWalletAddress, teeEnforcementEnabled } = body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (merchantName !== undefined) updates.merchant_name = merchantName;
    if (merchantLogo !== undefined) updates.merchant_logo = merchantLogo;
    if (secondaryEmail !== undefined) updates.secondary_email = secondaryEmail;
    if (settlementWalletAddress !== undefined) updates.settlement_wallet_address = settlementWalletAddress;
    if (teeEnforcementEnabled !== undefined) updates.tee_enforcement_enabled = teeEnforcementEnabled;

    const { data: merchant, error } = await supabase
      .from('merchants')
      .update(updates)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ merchant });
  } catch (err: any) {
    console.error('PATCH /api/v1/merchant error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
