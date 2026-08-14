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

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, environment, prefix, created_at, last_used_at')
    .eq('merchant_id', user.id)
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

  const environment = body.environment === 'mainnet' ? 'mainnet' : 'sandbox';
  const prefix = environment === 'mainnet' ? 'opq_live_' : 'opq_test_';

  // Generate 256 bits of secure entropy
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  const rawSecretKey = `${prefix}${randomEntropy}`;

  // Hash the raw key using SHA-256 for secure DB storage
  const keyHash = crypto
    .createHash('sha256')
    .update(rawSecretKey)
    .digest('hex');

  const { data, error } = await supabase
    .from('api_keys')
    .insert([{ merchant_id: user.id, environment, prefix, key_hash: keyHash }])
    .select('id, prefix, environment, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: data.id,
      environment: data.environment,
      prefix: data.prefix,
      createdAt: data.created_at,
      rawSecretKey, // Returned once upon creation
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
