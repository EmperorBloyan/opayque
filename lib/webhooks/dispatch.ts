import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Client } from '@upstash/qstash';
import crypto from 'node:crypto';

const WEBHOOK_DELIVER_ROUTE = '/api/v1/webhooks/deliver';

interface WebhookPayload {
  merchantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  environment?: 'mainnet' | 'sandbox';
}

function getDeliverUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) || 'http://localhost:3000';
  return `${siteUrl.replace(/\/$/, '')}${WEBHOOK_DELIVER_ROUTE}`;
}

function getDeliverySecret(): string {
  const secret = process.env.WEBHOOK_DELIVERY_SECRET?.trim();
  if (!secret) throw new Error('WEBHOOK_DELIVERY_SECRET is not configured');
  return secret;
}

async function enqueueDelivery(eventId: string, webhookId: string, qstashClient: Client | null): Promise<void> {
  const body = { eventId, webhookId };
  const headers = {
    'Content-Type': 'application/json',
    'x-opayque-delivery-secret': getDeliverySecret(),
  };
  if (qstashClient) {
    await qstashClient.publishJSON({ url: getDeliverUrl(), method: 'POST', body, headers, retries: 3 });
    return;
  }
  const response = await fetch(getDeliverUrl(), { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Webhook delivery enqueue failed (${response.status})`);
}

export async function dispatchWebhookEvent({ merchantId, eventType, payload, environment = 'sandbox' }: WebhookPayload) {
  const supabaseAdmin = createSupabaseServerClient();
  const qstashClient = process.env.QSTASH_TOKEN ? new Client({ token: process.env.QSTASH_TOKEN }) : null;
  const { data: webhooks, error } = await supabaseAdmin
    .from('webhooks')
    .select('id, endpoint_url')
    .eq('merchant_id', merchantId)
    .eq('environment', environment)
    .eq('is_active', true);

  if (error || !webhooks?.length) return { dispatched: 0 };

  let dispatched = 0;
  for (const webhook of webhooks as Array<{ id: string; endpoint_url: string }>) {
    const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`;
    const { data: event, error: eventError } = await supabaseAdmin
      .from('webhook_events')
      .insert({ event_id: eventId, webhook_id: webhook.id, event_type: eventType, payload, status: 'pending' })
      .select('id, event_id')
      .single();
    if (eventError || !event) continue;

    try {
      await enqueueDelivery(event.event_id, webhook.id, qstashClient);
      await supabaseAdmin.from('webhook_events').update({ status: 'delivering', attempts: 1, updated_at: new Date().toISOString() }).eq('id', event.id);
      dispatched += 1;
    } catch (deliveryError) {
      await supabaseAdmin.from('webhook_events').update({ status: 'failed', attempts: 1, last_error: deliveryError instanceof Error ? deliveryError.message : 'Delivery enqueue failed', next_attempt_at: new Date(Date.now() + 60_000).toISOString(), updated_at: new Date().toISOString() }).eq('id', event.id);
    }
  }

  return { dispatched };
}
