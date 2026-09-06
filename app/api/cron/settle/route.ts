import { NextResponse } from 'next/server';
import * as Sentry from '@/lib/sentry';
import { getOfframpProvider } from '@/lib/settlement/offramp';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const provider = getOfframpProvider();
    if (!provider.isConfigured()) {
      return NextResponse.json({ success: true, processed: 0, reason: 'not_configured', results: [] });
    }
    const pending: Array<{ merchantId: string; amountUsdc: number; destinationRef: string }> = [];
    let successCount = 0;
    const results: Array<{ merchantId: string; success: boolean; error?: string }> = [];

    for (const p of pending) {
      const result = await provider.createPayout(p);
      results.push({ merchantId: p.merchantId, success: result.success, error: result.success ? undefined : result.message });
      if (result.success) successCount++;
    }

    return NextResponse.json({ success: true, processed: successCount, results });
  } catch (e: unknown) {
    Sentry.captureException(e);
    return NextResponse.json({ error: 'Settlement job failed' }, { status: 500 });
  }
}
