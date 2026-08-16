import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveMerchantAccessStatus } from '@/lib/auth/merchantAccess';

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
      .select('id, email, merchant_name, merchant_logo, secondary_email, onboarding_status, api_access_status, settlement_wallet_address, website_url, webhook_url, tee_enforcement_enabled, api_key')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const normalizedMerchant = merchant
      ? {
          ...merchant,
          api_access_status: resolveMerchantAccessStatus(merchant.api_access_status, merchant.api_key),
        }
      : null;

    return NextResponse.json({ merchant: normalizedMerchant });
  } catch (err: any) {
    console.error('GET /api/v1/merchant error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
    const {
      email,
      merchantName,
      merchantLogo,
      secondaryEmail,
      settlementWalletAddress,
      websiteUrl,
      webhookUrl,
      teeEnforcementEnabled,
    } = body;

    // Safely build the updates object so we don't overwrite missing body fields with null
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    
    if (email !== undefined) updates.email = email;
    if (merchantName !== undefined) updates.merchant_name = merchantName;
    if (merchantLogo !== undefined) updates.merchant_logo = merchantLogo;
    if (secondaryEmail !== undefined) updates.secondary_email = secondaryEmail;
    if (settlementWalletAddress !== undefined) updates.settlement_wallet_address = settlementWalletAddress;
    if (websiteUrl !== undefined) updates.website_url = websiteUrl;
    if (webhookUrl !== undefined) updates.webhook_url = webhookUrl;
    if (teeEnforcementEnabled !== undefined) updates.tee_enforcement_enabled = teeEnforcementEnabled;

    if (
      email !== undefined || 
      merchantName !== undefined || 
      merchantLogo !== undefined || 
      secondaryEmail !== undefined || 
      settlementWalletAddress !== undefined || 
      websiteUrl !== undefined || 
      webhookUrl !== undefined
    ) {
      updates.api_access_status = 'active';
    }

    // 1. Check if the merchant record already exists
    const { data: existing } = await supabase
      .from('merchants')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const selectColumns = 'id, email, merchant_name, merchant_logo, secondary_email, onboarding_status, api_access_status, settlement_wallet_address, website_url, webhook_url, tee_enforcement_enabled, api_key';
    
    let dbResult;

    // 2. Branch logic based on existence
    if (existing?.id) {
      // Update existing record targeting the specific primary key ID
      dbResult = await supabase
        .from('merchants')
        .update(updates)
        .eq('id', existing.id)
        .select(selectColumns)
        .maybeSingle();
    } else {
      // Insert new record with explicit creation defaults
      dbResult = await supabase
        .from('merchants')
        .insert({
          ...updates,
          auth_user_id: user.id,
          onboarding_status: 'pending',
          api_access_status: updates.api_access_status || 'pending',
          created_at: new Date().toISOString(),
        })
        .select(selectColumns)
        .maybeSingle();
    }

    const { data: merchant, error } = dbResult;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Retain the normalization logic
    const normalizedMerchant = merchant
      ? {
          ...merchant,
          api_access_status: resolveMerchantAccessStatus(merchant.api_access_status, merchant.api_key),
        }
      : null;

    return NextResponse.json({ merchant: normalizedMerchant });
  } catch (err: any) {
    console.error('PATCH /api/v1/merchant error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
