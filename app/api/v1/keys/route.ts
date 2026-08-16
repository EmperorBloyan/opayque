import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

async function getSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // ignore when called from Server Components
          }
        },
      },
    }
  );
}

// GET: list keys for authenticated merchant
export async function GET() {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (merchantError) {
    return NextResponse.json({ error: merchantError.message }, { status: 500 });
  }

  if (!merchant?.id) {
    return NextResponse.json({ keys: [] });
  }

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, environment, prefix, created_at, last_used_at')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: keys ?? [] });
}

// POST: create a real persisted key only
export async function POST(request: Request) {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { environment?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const rawEnv = body.environment || 'sandbox';
  const environment =
    rawEnv === 'mainnet' || rawEnv === 'live' ? 'mainnet' : 'sandbox';
  const prefix = environment === 'mainnet' ? 'osk_live_' : 'osk_test_';

  // Find or create merchant row
  let { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id, settlement_wallet_address, merchant_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (merchantError) {
    return NextResponse.json({ error: merchantError.message }, { status: 500 });
  }

  // Auto-create merchant if missing
  if (!merchant?.id) {
    const { data: created, error: createError } = await supabase
      .from('merchants')
      .insert([
        {
          auth_user_id: user.id,
          email: user.email ?? null,
          onboarding_status: 'pending',
          api_access_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id, settlement_wallet_address, merchant_name')
      .maybeSingle();

    if (createError || !created?.id) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            'Merchant profile not found. Please complete merchant setup first.',
        },
        { status: 400 }
      );
    }

    merchant = created;
  }

  // Generate secure key
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const rawSecretKey = `${prefix}${randomEntropy}`;
  const keyHash = crypto.createHash('sha256').update(rawSecretKey).digest('hex');

  // Persist key in api_keys
  const { data, error } = await supabase
    .from('api_keys')
    .insert([
      {
        merchant_id: merchant.id,
        environment,
        prefix,
        key_hash: keyHash,
      },
    ])
    .select('id, prefix, environment, created_at')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create API key' },
      { status: 500 }
    );
  }

  // Also store latest key on merchant for legacy support
  await supabase
    .from('merchants')
    .update({
      api_access_status: 'active',
      onboarding_status: 'completed',
      api_key: rawSecretKey,
      updated_at: new Date().toISOString(),
    })
    .eq('id', merchant.id);

  return NextResponse.json(
    {
      id: data.id,
      environment: data.environment,
      prefix: data.prefix,
      createdAt: data.created_at,
      publishableKey: `${prefix}pub_${String(data.id).slice(0, 8)}`,
      rawSecretKey, // shown only once
      isTemporary: false,
    },
    { status: 201 }
  );
}

// DELETE: revoke key
export async function DELETE(request: Request) {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get('id');

  if (!keyId) {
    return NextResponse.json({ error: 'Missing key ID' }, { status: 400 });
  }

  // Resolve merchant first
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!merchant?.id) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('merchant_id', merchant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}