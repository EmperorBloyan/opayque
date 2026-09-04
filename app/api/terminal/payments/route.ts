import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRealMerchantId } from "@/lib/terminal/guards";
import { requireTerminalDevice } from "@/lib/terminal/deviceAuth";
import { getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from "@/lib/solana/constants";
import { normalizeIdempotencyKey } from "@/lib/payments/ledger";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
    const amount = Number(body?.amount);
    const tokenSymbol = typeof body?.tokenSymbol === "string" ? body.tokenSymbol.trim().toUpperCase() : "";
    const idempotencyKey = normalizeIdempotencyKey(request.headers.get("Idempotency-Key") || body?.idempotencyKey);
    const normalizedAmount = Number(amount.toFixed(6));

    if (!terminalId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount >= 1_000_000 || tokenSymbol !== "USDC") {
      return NextResponse.json({ success: false, error: "Valid terminal payment details are required" }, { status: 400 });
    }

    const auth = await requireTerminalDevice(request, terminalId);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { terminal, supabase } = auth;

    if (!terminal || ["revoked", "unpaired", "deleted"].includes(String(terminal.status).toLowerCase()) || !isRealMerchantId(terminal.merchant_id)) {
      return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 401 });
    }

    if (idempotencyKey) {
      const { data: existing, error: existingError } = await supabase
        .from("payment_ledger")
        .select("*")
        .eq("merchant_id", terminal.merchant_id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingError) return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
      if (existing) return NextResponse.json({ success: true, ...existing, idempotent: true });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("settlement_wallet_address, wallet_address")
      .eq("id", terminal.merchant_id)
      .maybeSingle();
    if (merchantError || !merchant) return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
    const recipientAddress = String(merchant.settlement_wallet_address || merchant.wallet_address || "").trim();
    if (!recipientAddress) return NextResponse.json({ success: false, error: "Merchant settlement wallet is not configured" }, { status: 409 });
    const environment = getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "sandbox";

    const { data, error } = await supabase
      .from("payment_ledger")
      .insert({
        merchant_id: terminal.merchant_id,
        terminal_id: terminal.id,
        signature: null,
        token_symbol: tokenSymbol,
        amount: normalizedAmount,
        amount_base_units: Math.round(normalizedAmount * 1_000_000),
        mint: getAssetMintAddress("USDC", isDevnetNetwork()),
        recipient_address: recipientAddress,
        environment,
        idempotency_key: idempotencyKey,
        status: "created",
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Failed to create pending transaction" }, { status: 500 });
    }

    await dispatchWebhookEvent({
      merchantId: terminal.merchant_id,
      environment,
      eventType: "payment.created",
      payload: data,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to create payment" }, { status: 500 });
  }
}