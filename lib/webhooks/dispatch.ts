import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WebhookPayload {
  merchantId: string;
  eventType: string;
  payload: Record<string, any>;
  environment?: 'mainnet' | 'sandbox';
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

    const startTime = Date.now();
    let statusCode = 500;

    try {
      const response = await fetch(webhook.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Opayque-Signature': `t=${timestamp},v1=${signature}`,
          'User-Agent': 'Opayque-Webhook-Dispatcher/1.0',
        },
        body: eventBody,
      });

      statusCode = response.status;
    } catch (err) {
      console.error(`Webhook delivery failed to ${webhook.endpoint_url}:`, err);
    } finally {
      const responseTimeMs = Date.now() - startTime;

      await supabaseAdmin.from('webhook_delivery_logs').insert([
        {
          webhook_id: webhook.id,
          event_type: eventType,
          status_code: statusCode,
          payload: JSON.parse(eventBody),
          response_time_ms: responseTimeMs,
        },
      ]);
    }
  });

  await Promise.all(dispatchPromises);
  return { dispatched: webhooks.length };
}
