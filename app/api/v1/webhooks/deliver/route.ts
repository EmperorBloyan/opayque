import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantId, eventType, payload, webhookEndpoint, secret } = body;

    if (!webhookEndpoint || !secret) {
      return NextResponse.json({ error: 'Missing endpoint or secret' }, { status: 400 });
    }

    // 1. Generate HMAC Signature
    const timestamp = Date.now().toString();
    const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    const signatureHeader = `t=${timestamp},v1=${hmac}`;

    // 2. Send signed HTTP POST to Merchant Endpoint
    const res = await fetch(webhookEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Opayque-Signature': signatureHeader,
      },
      body: JSON.stringify({
        event: eventType,
        data: payload,
      }),
    });

    // If merchant server fails, return 500 so QStash knows to retry
    if (!res.ok) {
      console.error(`Webhook delivery failed with status ${res.status}`);
      return NextResponse.json({ error: 'Merchant endpoint failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: res.status });
  } catch (error: any) {
    console.error('Webhook Delivery Exception:', error);
    // Returning 500 triggers QStash automatic retry
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
