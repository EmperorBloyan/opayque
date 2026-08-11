import { createClient } from '@supabase/supabase-js';
import { Client } from '@upstash/qstash';
import crypto from 'node:crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const qstashClient = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

const WEBHOOK_DELIVER_ROUTE = '/api/v1/webhooks/deliver';

interface WebhookPayload {
  merchantId: string;
  eventType: string;
  payload: Record<string, any>;
  environment?: 'mainnet' | 'sandbox';
}

function getDeliverUrl(): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    'http://localhost:3000';

  return `${siteUrl.replace(/\/$/, '')}${WEBHOOK_DELIVER_ROUTE}`;
}

async function deliverViaQstash(
  webhook: { id: string; endpoint_url: string; secret_hash: string },
  body: Record<string, unknown>,
) {
  const qstashUrl = getDeliverUrl();

  await qstashClient?.publishJSON({
    url: qstashUrl,
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
    },
    retries: 3,
  });
}

async function deliverDirectly(
  webhook: { id: string; endpoint_url: string; secret_hash: string },
  body: Record<string, unknown>,
) {
  await fetch(getDeliverUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function dispatchWebhookEvent({
  merchantId,
  eventType,
  payload,
  environment = 'sandbox',
}: WebhookPayload) {
  const { data: webhooks, error } = await supabaseAdmin
    .from('webhooks')
    .select('id, endpoint_url, secret_hash')
    .eq('merchant_id', merchantId)
    .eq('environment', environment)
    .eq('is_active', true);

  if (error || !webhooks || webhooks.length === 0) return { dispatched: 0 };

  const dispatchPromises = webhooks.map(async (webhook) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const eventBody = JSON.stringify({
      id: `evt_${crypto.randomBytes(12).toString('hex')}`,
      event: eventType,
      created_at: timestamp,
      data: payload,
    });

    const signature = crypto
      .createHmac('sha256', webhook.secret_hash)
      .update(`${timestamp}.${eventBody}`)
      .digest('hex');

    const deliveryBody = {
      merchantId,
      eventType,
      payload,
      webhookEndpoint: webhook.endpoint_url,
      secret: webhook.secret_hash,
      signature: `t=${timestamp},v1=${signature}`,
      eventBody,
    };

    const startTime = Date.now();
    let statusCode = 202;

    try {
      if (qstashClient) {
        await deliverViaQstash(webhook, deliveryBody);
      } else {
        const res = await fetch(getDeliverUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(deliveryBody),
        });

        statusCode = res.status;

        if (!res.ok) {
          console.error(`Webhook direct delivery failed for ${webhook.endpoint_url}: ${res.status}`);
        }
      }
    } catch (err) {
      console.error(`Webhook dispatch failed for ${webhook.endpoint_url}:`, err);
    } finally {
      const responseTimeMs = Date.now() - startTime;
      const insertPayload = {
        webhook_id: webhook.id,
        event_type: eventType,
        status_code: statusCode,
        payload,
        response_time_ms: responseTimeMs,
      };

      try {
        await supabaseAdmin.from('webhook_delivery_logs').insert([insertPayload]);
      } catch (logError) {
        console.error('Failed to record webhook delivery log:', logError);
      }
    }
  });

  await Promise.all(dispatchPromises);
  return { dispatched: webhooks.length };
}
