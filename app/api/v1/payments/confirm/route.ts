import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertProductionConfig, getSolanaNetwork } from "@/lib/solana/constants";
import { selectHealthyRpcUrl } from "@/lib/solana/rpc";
import { verifySolanaTransaction } from "@/lib/solana/verify";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { normalizeIdempotencyKey } from "@/lib/payments/ledger";
import { assertPaymentStatusTransition } from "@/lib/payments/ledger";
import { authenticateApiKey } from "@/lib/auth/apiKey";

function webhookPayload(row: any) {
  return {
    id: row.id,
    merchant_id: row.merchant_id,
    amount: row.amount,
    mint: row.mint,
    sender: row.sender_address,
    recipient: row.recipient_address,
    signature: row.signature,
    status: row.status,
    environment: row.environment,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const intentId = typeof body?.intent_id === "string" ? body.intent_id.trim() : "";
    const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
    const sender = typeof body?.sender === "string" ? body.sender.trim() : null;
    const idempotencyKey = normalizeIdempotencyKey(request.headers.get("Idempotency-Key") || body?.idempotency_key);
    if (!intentId || !signature || signature.length > 128) {
      return NextResponse.json({ error: "intent_id and a valid signature are required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(request);
    let merchantId: string | null = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: merchant } = await supabase.from("merchants").select("id").eq("auth_user_id", user.id).maybeSingle();
      merchantId = merchant?.id ?? null;
    } else {
      const apiAuth = await authenticateApiKey(request.headers.get("authorization"));
      if (!apiAuth.error && apiAuth.environment === (getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "sandbox")) merchantId = apiAuth.merchantId;
    }
    if (!merchantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: row, error: lookupError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", intentId)
      .eq("merchant_id", merchantId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Unable to load payment intent" }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
    if (idempotencyKey && row.idempotency_key && row.idempotency_key !== idempotencyKey) {
      return NextResponse.json({ error: "Payment idempotency key does not match the intent" }, { status: 409 });
    }
    if (row.signature === signature && row.status === "confirmed") {
      return NextResponse.json({ success: true, idempotent: true, transaction: row });
    }
    if (!["created", "pending_signature", "submitted"].includes(String(row.status))) {
      return NextResponse.json({ error: "Payment intent is no longer payable" }, { status: 409 });
    }
    assertPaymentStatusTransition(String(row.status) as any, "submitted");

    const now = new Date().toISOString();
    const { data: submitted, error: submitError } = await supabase
      .from("transactions")
      .update({ status: "submitted", signature, sender_address: sender || row.sender_address, updated_at: now })
      .eq("id", intentId)
      .in("status", ["created", "pending_signature", "submitted"])
      .select("*")
      .maybeSingle();
    if (submitError) return NextResponse.json({ error: "Unable to record submitted payment" }, { status: 500 });
    if (!submitted) return NextResponse.json({ error: "Payment intent changed; retry confirmation" }, { status: 409 });

    await dispatchWebhookEvent({
      merchantId: submitted.merchant_id,
      environment: submitted.environment === "mainnet" ? "mainnet" : "sandbox",
      eventType: "payment.submitted",
      payload: webhookPayload(submitted),
    });

    assertProductionConfig();
    const verification = await verifySolanaTransaction({
      signature,
      expectedMerchantWallet: submitted.recipient_address,
      expectedAmount: Number(submitted.amount),
      expectedTokenMint: submitted.mint,
      expectedTokenDecimals: 6,
      rpcUrl: await selectHealthyRpcUrl(),
    });
    if (!verification.verified) {
      const { data: failed } = await supabase
        .from("transactions")
        .update({ status: "failed", failed_reason: verification.reason, updated_at: new Date().toISOString() })
        .eq("id", submitted.id)
        .eq("status", "submitted")
        .select("*")
        .maybeSingle();
      if (failed) await dispatchWebhookEvent({ merchantId: failed.merchant_id, environment: failed.environment === "mainnet" ? "mainnet" : "sandbox", eventType: "payment.failed", payload: webhookPayload(failed) });
      return NextResponse.json({ error: "On-chain payment verification failed", details: verification.reason }, { status: 400 });
    }

    const { data: confirmed, error: confirmError } = await supabase
      .from("transactions")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString(), reconciliation_status: "matched" })
      .eq("id", submitted.id)
      .eq("status", "submitted")
      .select("*")
      .maybeSingle();
    if (confirmError) return NextResponse.json({ error: "Unable to record confirmed payment" }, { status: 500 });
    if (confirmed) {
      await dispatchWebhookEvent({ merchantId: confirmed.merchant_id, environment: confirmed.environment === "mainnet" ? "mainnet" : "sandbox", eventType: "payment.confirmed", payload: webhookPayload(confirmed) });
      return NextResponse.json({ success: true, transaction: confirmed });
    }
    return NextResponse.json({ success: true, idempotent: true, transaction: submitted });
  } catch (error) {
    console.error("Payment confirmation failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Unable to confirm payment" }, { status: 500 });
  }
}
