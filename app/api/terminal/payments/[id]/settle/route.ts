import { NextResponse } from "next/server";
import { assertProductionConfig, getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from "@/lib/solana/constants";
import { selectHealthyRpcUrl } from "@/lib/solana/rpc";
import { verifySolanaTransaction } from "@/lib/solana/verify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTerminalDevice } from "@/lib/terminal/deviceAuth";
import { resolveSettlementWallet } from "@/lib/merchant/wallets";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
    const transactionId = params.id?.trim();

    if (!transactionId || !signature) {
      return NextResponse.json({ success: false, error: "Transaction ID and signature are required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_ledger")
      .select("id, merchant_id, terminal_id, amount, amount_base_units, mint, sender_address, recipient_address, token_symbol, status, signature")
      .eq("id", transactionId)
      .maybeSingle();

    if (transactionError) {
      return NextResponse.json({ success: false, error: transactionError.message }, { status: 500 });
    }

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Terminal transaction not found" }, { status: 404 });
    }
    if (request.headers.get("x-terminal-token")) {
      const auth = await requireTerminalDevice(request, String(transaction.terminal_id || ""));
      if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      if (transaction.terminal_id !== auth.terminal.id) {
        return NextResponse.json({ success: false, error: "Terminal is not authorized for this payment" }, { status: 403 });
      }
    }

    if (!["created", "pending_signature", "submitted"].includes(transaction.status)) {
      return NextResponse.json({ success: false, error: "Terminal transaction is no longer pending" }, { status: 409 });
    }
    if (transaction.status === "submitted" && transaction.signature && transaction.signature !== signature) {
      return NextResponse.json({ success: false, error: "Terminal transaction is already associated with another signature" }, { status: 409 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("settlement_wallet_address, wallet_address")
      .eq("id", transaction.merchant_id)
      .maybeSingle();

    if (merchantError || !merchant) {
      return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
    }

    const merchantWallet = resolveSettlementWallet(merchant).address;
    if (!merchantWallet) {
      return NextResponse.json({ success: false, error: "Merchant settlement wallet not configured" }, { status: 400 });
    }
    if (transaction.recipient_address !== merchantWallet) {
      return NextResponse.json({ success: false, error: "Payment recipient does not match the merchant settlement wallet" }, { status: 409 });
    }

    assertProductionConfig();
    const rpcUrl = await selectHealthyRpcUrl();
    const isDevnet = isDevnetNetwork();
    const tokenSymbol = String(transaction.token_symbol || "USDC").toUpperCase();

    if (tokenSymbol !== "USDC") {
      return NextResponse.json({ success: false, error: "Only USDC terminal payments are supported" }, { status: 400 });
    }

    const { data: submitted, error: submitError } = await supabase
      .from("payment_ledger")
      .update({ signature, status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", transactionId)
      .in("status", ["created", "pending_signature", "submitted"])
      .select("id, merchant_id, amount, amount_base_units, mint, sender_address, recipient_address, signature, status")
      .maybeSingle();
    if (submitError || !submitted) {
      return NextResponse.json({ success: false, error: "Terminal transaction changed; retry settlement" }, { status: 409 });
    }

    const verification = await verifySolanaTransaction({
      signature,
      expectedMerchantWallet: merchantWallet,
      expectedSender: submitted.sender_address,
      expectedAmount: Number(submitted.amount),
      expectedAmountBaseUnits: submitted.amount_base_units ? BigInt(submitted.amount_base_units) : undefined,
      expectedTokenMint: submitted.mint || getAssetMintAddress("USDC", isDevnet),
      expectedTokenDecimals: 6,
      rpcUrl,
    });

    if (!verification.verified) {
      const { data: failed } = await supabase
        .from("payment_ledger")
        .update({ status: "failed", failed_reason: verification.reason, updated_at: new Date().toISOString() })
        .eq("id", transactionId)
        .eq("status", "submitted")
        .select("*")
        .maybeSingle();
      if (failed) await dispatchWebhookEvent({ merchantId: failed.merchant_id, environment: getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "sandbox", eventType: "payment.failed", payload: failed });
      return NextResponse.json({ success: false, error: "On-chain payment verification failed", details: verification.reason }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("payment_ledger")
      .update({ signature, status: "confirmed", confirmed_at: new Date().toISOString(), reconciliation_status: "matched", updated_at: new Date().toISOString() })
      .eq("id", transactionId)
      .in("status", ["created", "pending_signature", "submitted"])
      .select("id, merchant_id, status, signature")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updated) {
      const { data: existing } = await supabase
        .from("payment_ledger")
        .select("id, status, signature")
        .eq("id", transactionId)
        .maybeSingle();
      if (existing?.status === "confirmed" && existing.signature === signature) {
        return NextResponse.json({ success: true, transaction: existing });
      }
      return NextResponse.json({ success: false, error: "Terminal transaction was updated by another request" }, { status: 409 });
    }

    await dispatchWebhookEvent({
      merchantId: updated.merchant_id,
      environment: getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "sandbox",
      eventType: "payment.confirmed",
      payload: updated,
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error("Terminal payment settlement failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ success: false, error: "Unable to settle terminal payment" }, { status: 500 });
  }
}