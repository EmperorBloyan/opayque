import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import * as Sentry from "@/lib/sentry";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";

const EXPIRY_WINDOW_MS = 15 * 60 * 1000;
const MAX_BATCH = 500;

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - EXPIRY_WINDOW_MS).toISOString();
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payment_ledger")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("status", ["created", "pending_signature", "submitted"])
      .lt("updated_at", cutoff)
      .limit(MAX_BATCH)
      .select("*");

    if (error) throw error;
    await Promise.all((data ?? []).map((row: any) => dispatchWebhookEvent({
      merchantId: row.merchant_id,
      environment: row.environment === "mainnet" ? "mainnet" : "sandbox",
      eventType: "payment.expired",
      payload: row,
    })));
    return NextResponse.json({ success: true, expired: data?.length ?? 0 });
  } catch (error: unknown) {
    Sentry.captureException(error);
    console.error("Transaction expiry failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, error: "Unable to expire transactions" }, { status: 500 });
  }
}
