import { NextResponse } from 'next/server';
import { initiateFiatPayout } from '@/lib/settlement/offramp';
import * as Sentry from '@/lib/sentry';
import { getOfframpConfig } from '@/lib/env/server';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const providerConfigured = !getOfframpConfig().error;
    if (!providerConfigured) {
      return NextResponse.json({ success: true, processed: 0, reason: 'not_configured', results: [] });
    }
    const pending: Array<{ merchantId: string; amount: number; currency: string; bankAccountId: string }> = [];
    let successCount = 0;
    const results: Array<{ merchantId: string; success: boolean; error?: string }> = [];

    for (const p of pending) {
      const result = await initiateFiatPayout(p);
      results.push({ merchantId: p.merchantId, success: result.success, error: result.error });
      if (result.success) successCount++;
    }

    return NextResponse.json({ success: true, processed: successCount, results });
  } catch (e: unknown) {
    Sentry.captureException(e);
    return NextResponse.json({ error: 'Settlement job failed' }, { status: 500 });
  }
}
