import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { initiateFiatPayout } from "@/lib/settlement/offramp";

interface SettleCronRequest {
  secret?: string;
  merchantId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SettleCronRequest;
    const expectedSecret = process.env.SETTLEMENT_CRON_SECRET ?? "dev-secret";

    if (body.secret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: merchants, error: merchantError } = await supabase.from("merchants").select("*");

    if (merchantError) {
      return NextResponse.json({ success: false, error: merchantError.message }, { status: 500 });
    }

    const settlements: Array<Record<string, unknown>> = [];

    for (const merchant of merchants ?? []) {
      const payoutAmount = 25;
      const payout = await initiateFiatPayout({
        merchantId: merchant.id,
        amount: payoutAmount,
        currency: "USD",
        bankAccountId: merchant.id,
      });

      const { error: settlementError } = await supabase.from("settlements").insert({
        merchant_id: merchant.id,
        payout_id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        note: payout.note,
      });

      if (settlementError) {
        settlements.push({ merchantId: merchant.id, success: false, error: settlementError.message });
      } else {
        settlements.push({ merchantId: merchant.id, success: true, payoutId: payout.id, status: payout.status });
      }
    }

    return NextResponse.json({ success: true, data: { settlements } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Settlement cron failed" }, { status: 500 });
  }
}
