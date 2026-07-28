import { NextResponse } from 'next/server';
import { initiateFiatPayout } from '@/lib/settlement/offramp';
import * as Sentry from '@/lib/sentry';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // TODO: Replace with real DB query later
    const pending = [{ merchantId: "merch_test", amount: 1250, currency: "USD", bankAccountId: "bank1" }];
    let successCount = 0;
    const results: Array<{ merchantId: string; success: boolean; error?: string }> = [];

    for (const p of pending) {
      const result = await initiateFiatPayout(p);
      results.push({ merchantId: p.merchantId, success: result.success, error: result.error });
      if (result.success) successCount++;
    }

    return NextResponse.json({ success: true, processed: successCount, results });
  } catch (e: any) {
    Sentry.captureException(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
