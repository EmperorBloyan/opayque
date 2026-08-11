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
