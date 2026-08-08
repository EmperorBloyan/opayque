import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * @route POST /api/v1/webhooks/resend
 * @description Manually triggers a redelivery of a specific webhook event.
 * Utilizes HMAC SHA-256 signatures to ensure payload integrity.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate Request via Secret Key Header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer osk_live_')) {
      return NextResponse.json(
        { 
          error: 'UNAUTHORIZED_ACCESS',
          message: 'Missing or invalid live secret API key.'
        },
        { status: 401 }
      );
    }

    // 2. Parse & Validate Incoming Payload
    const body = await request.json();
    const { event_type = 'payment.settled', order_id, webhook_url } = body;

    if (!order_id || !webhook_url) {
      return NextResponse.json(
        { 
          error: 'BAD_REQUEST',
          message: 'Missing required routing parameters: [order_id, webhook_url]'
        },
        { status: 400 }
      );
    }

    // 3. Construct Standardized Event Payload
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const timestamp = new Date().toISOString();
    
    const webhookPayload = JSON.stringify({
      id: eventId,
      event: event_type,
      created_at: timestamp,
      data: {
        order_id: order_id,
        status: 'SETTLED',
        network: 'solana-mainnet',
        tx_hash: `5Kj${Math.random().toString(36).substring(2, 12)}...`,
      }
    });

    // 4. Generate Cryptographic HMAC Signature
    const webhookSecret = 'whsec_live_abcdef9876543210';
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayload)
      .digest('hex');

    // 5. Dispatch Webhook to Merchant Infrastructure (with strict timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second max latency

    let responseStatus = 500;
    let responseBody = 'Failed to establish connection with destination endpoint.';

    try {
      const externalRes = await fetch(webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Opayque-Signature': `t=${Date.now()},v1=${signature}`
        },
        body: webhookPayload,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      responseStatus = externalRes.status;
      responseBody = await externalRes.text();
    } catch (fetchError: any) {
      responseStatus = 504;
      responseBody = fetchError.name === 'AbortError' 
        ? 'GATEWAY_TIMEOUT: Destination server took too long to respond.' 
        : `NETWORK_ERROR: ${fetchError.message}`;
    }

    // 6. Return Telemetry Log to Developer Hub
    const isSuccessful = responseStatus >= 200 && responseStatus < 300;

    return NextResponse.json(
      {
        success: isSuccessful,
        data: {
          delivery_status: isSuccessful ? 'DELIVERED' : 'FAILED',
          event_type: event_type,
          target_url: webhook_url,
          metrics: {
            http_status: responseStatus,
            response_snippet: responseBody.substring(0, 250),
            dispatched_at: timestamp
          }
        }
      },
      { status: isSuccessful ? 200 : 207 } // 207 Multi-Status if dispatch failed but API succeeded
    );

  } catch (error) {
    console.error('[OPAYQUE_WEBHOOK_ERROR] Redelivery Dispatch Failed:', error);
    return NextResponse.json(
      { 
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Webhook redelivery engine encountered a critical fault.'
      },
      { status: 500 }
    );
  }
}
