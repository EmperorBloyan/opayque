import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

// Helper function to create a Supabase client with complete cookie management
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
            // Ignored if called from Server Components
          }
        },
      },
    }
  );
}

// GET: Fetch API Keys for the Authenticated Merchant
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

  return NextResponse.json({ keys });
}

// POST: Create a New Secret API Key
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
    // If request body is empty or invalid JSON, fall back to default
  }

  // Normalize environment: accept "devnet", "mainnet", "sandbox", "live"
  const rawEnv = body.environment || 'sandbox';
  const environment = (rawEnv === 'mainnet' || rawEnv === 'live') ? 'mainnet' : 'sandbox';
  const prefix = environment === 'mainnet' ? 'osk_live_' : 'osk_test_';

  // Generate 256 bits of secure entropy
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const rawSecretKey = `${prefix}${randomEntropy}`;

  // Hash the raw key using SHA-256 for secure DB storage
  const keyHash = crypto
    .createHash('sha256')
    .update(rawSecretKey)
    .digest('hex');

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (merchantError) {
    return NextResponse.json({ error: merchantError.message }, { status: 500 });
  }

  // If merchant profile doesn't exist, create a temporary key for testing
  if (!merchant?.id) {
    return NextResponse.json(
      {
        id: `temp_${Date.now()}`,
        environment,
        prefix,
        createdAt: new Date().toISOString(),
        rawSecretKey,
        isTemporary: true,
        warning: 'This is a temporary test key. Create a merchant profile and generate a persistent key to go live.',
      },
      { status: 201 }
    );
  }

  const { data, error } = await supabase
    .from('api_keys')
    .insert([{ merchant_id: merchant.id, environment, prefix, key_hash: keyHash }])
    .select('id, prefix, environment, created_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: merchantStatusError } = await supabase
    .from('merchants')
    .update({
      api_access_status: 'active',
      onboarding_status: 'completed',
      api_key: rawSecretKey,
      updated_at: new Date().toISOString(),
    })
    .eq('id', merchant.id);

  if (merchantStatusError) {
    return NextResponse.json({ error: merchantStatusError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: data.id,
      environment: data.environment,
      prefix: data.prefix,
      createdAt: data.created_at,
      rawSecretKey, // Returned once upon creation
      isTemporary: false,
    },
    { status: 201 }
  );
}

// DELETE: Revoke/Delete an API Key
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

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('merchant_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
