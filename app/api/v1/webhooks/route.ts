import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { encryptWebhookSecret } from '@/lib/webhooks/secrets';

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: merchant } = await supabase.from('merchants').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });

  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('id, environment, endpoint_url, is_active, created_at')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: merchant } = await supabase.from('merchants').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });

  const body = await request.json();
  const { endpointUrl, environment } = body;

  if (!endpointUrl) return NextResponse.json({ error: 'Endpoint URL is required' }, { status: 400 });
  try {
    const endpoint = new URL(endpointUrl);
    if (endpoint.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    return NextResponse.json({ error: 'Endpoint URL must be a valid HTTPS URL' }, { status: 400 });
  }

  const env = environment === 'mainnet' ? 'mainnet' : 'sandbox';
  const rawSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
  const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  let secretCiphertext: string;
  try {
    secretCiphertext = encryptWebhookSecret(rawSecret);
  } catch {
    return NextResponse.json({ error: 'Webhook secret encryption is not configured' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('webhooks')
    .insert([{ merchant_id: merchant.id, environment: env, endpoint_url: endpointUrl, secret_hash: secretHash, secret_ciphertext: secretCiphertext, is_active: true }])
    .select('id, environment, endpoint_url, is_active, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    environment: data.environment,
    endpointUrl: data.endpoint_url,
    isActive: data.is_active,
    createdAt: data.created_at,
    rawSecret,
  });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: merchant } = await supabase.from('merchants').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get('id');

  if (!webhookId) return NextResponse.json({ error: 'Missing webhook ID' }, { status: 400 });

  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId)
    .eq('merchant_id', merchant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
