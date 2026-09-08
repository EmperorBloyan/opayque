import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { decryptWebhookSecret } from '@/lib/webhooks/secrets';

function timingSafeSecret(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.WEBHOOK_DELIVERY_SECRET?.trim();
  const providedSecret = request.headers.get('x-opayque-delivery-secret')?.trim() || '';
  if (!configuredSecret || !timingSafeSecret(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
    const webhookId = typeof body?.webhookId === 'string' ? body.webhookId.trim() : '';
    if (!eventId || !webhookId) return NextResponse.json({ error: 'Invalid delivery request' }, { status: 400 });

    const supabase = createSupabaseServerClient();
    const { data: event, error: eventError } = await supabase.from('webhook_events').select('id, event_id, webhook_id, event_type, payload, status, attempts').eq('event_id', eventId).eq('webhook_id', webhookId).maybeSingle();
    if (eventError || !event) return NextResponse.json({ error: 'Delivery event not found' }, { status: 404 });
    if (event.status === 'delivered') return NextResponse.json({ success: true, idempotent: true });

    const { data: webhook, error: webhookError } = await supabase.from('webhooks').select('endpoint_url, secret_ciphertext, is_active').eq('id', webhookId).maybeSingle();
    if (webhookError || !webhook || !webhook.is_active || !webhook.secret_ciphertext) return NextResponse.json({ error: 'Webhook is unavailable' }, { status: 410 });

    const timestamp = Math.floor(Date.now() / 1000);
    const eventBody = JSON.stringify({ id: event.event_id, event: event.event_type, created_at: timestamp, data: event.payload });
    const secret = decryptWebhookSecret(webhook.secret_ciphertext);
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${eventBody}`).digest('hex');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(webhook.endpoint_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Opayque-Signature': `t=${timestamp},v1=${signature}` },
        body: eventBody,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Merchant endpoint failed (${response.status})`);
      await supabase.from('webhook_events').update({ status: 'delivered', attempts: Number(event.attempts ?? 0) + 1, delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', event.id).neq('status', 'delivered');
      await supabase.from('webhook_delivery_logs').insert({ webhook_id: webhookId, event_type: event.event_type, status_code: response.status, payload: event.payload, response_time_ms: null });
      return NextResponse.json({ success: true, status: response.status });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'Merchant endpoint timed out' : error instanceof Error ? error.message : 'Merchant endpoint failed';
      await supabase.from('webhook_events').update({ status: 'failed', attempts: Number(event.attempts ?? 0) + 1, last_error: message, next_attempt_at: new Date(Date.now() + Math.min(3_600_000, 2 ** Math.min(10, Number(event.attempts ?? 0)) * 1000)).toISOString(), updated_at: new Date().toISOString() }).eq('id', event.id).neq('status', 'delivered');
      await supabase.from('webhook_delivery_logs').insert({ webhook_id: webhookId, event_type: event.event_type, status_code: 500, payload: event.payload, response_time_ms: null });
      return NextResponse.json({ error: 'Merchant endpoint failed' }, { status: 500 });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error('Webhook delivery failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Webhook delivery failed' }, { status: 500 });
  }
}
