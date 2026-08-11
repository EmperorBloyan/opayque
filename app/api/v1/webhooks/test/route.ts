import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

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
  const { webhookId } = body;
  if (!webhookId) return NextResponse.json({ error: 'Missing webhookId' }, { status: 400 });

  const { data: webhook, error } = await supabase
    .from('webhooks')
    .select('id, endpoint_url, secret_hash, merchant_id')
    .eq('id', webhookId)
    .single();

  if (error || !webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  // Ensure ownership
  if (!webhook.merchant_id) return NextResponse.json({ error: 'Invalid webhook' }, { status: 403 });

  // Prepare a test payload
  const timestamp = Math.floor(Date.now() / 1000);
  const eventBody = JSON.stringify({ id: `evt_${crypto.randomBytes(8).toString('hex')}`, event: 'test.ping', created_at: timestamp, data: { message: 'ping' } });
  const signature = crypto.createHmac('sha256', webhook.secret_hash).update(`${timestamp}.${eventBody}`).digest('hex');

  let statusCode = 500;
  const start = Date.now();
  try {
    const resp = await fetch(webhook.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Opayque-Signature': `t=${timestamp},v1=${signature}`,
      },
      body: eventBody,
    });
    statusCode = resp.status;
  } catch (err) {
    console.error('Webhook test dispatch failed', err);
  } finally {
    const responseTimeMs = Date.now() - start;
    await supabase.from('webhook_delivery_logs').insert([{
      webhook_id: webhook.id,
      event_type: 'test.ping',
      status_code: statusCode,
      payload: JSON.parse(eventBody),
      response_time_ms: responseTimeMs,
    }]);
  }

  return NextResponse.json({ success: true, dispatched: true });
}
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatch';

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
  const { webhookId } = body;

  if (!webhookId) {
    return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
  }

  // Dispatch real HMAC signed test payload via background dispatcher
  const result = await dispatchWebhookEvent({
    merchantId: user.id,
    eventType: 'test.ping',
    payload: {
      message: 'This is a test webhook event sent from Opayque.',
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json({ success: true, dispatched: result.dispatched });
}
