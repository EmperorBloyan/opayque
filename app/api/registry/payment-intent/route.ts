import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAssetMintAddress, getSolanaNetwork, isDevnetNetwork } from "@/lib/solana/constants";
import { parseAmountToBaseUnits } from "@/lib/payments/amount";
import { normalizeTransferMode } from "@/lib/payments/transferMode";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const recipient = typeof body?.recipient === "string" ? body.recipient.trim() : "";
    const amountBaseUnits = parseAmountToBaseUnits(body?.amount, 6);
    if (!recipient || !amountBaseUnits || amountBaseUnits >= 1_000_000_000_000n) {
      return NextResponse.json({ error: "A valid recipient and amount are required" }, { status: 400 });
    }
    new PublicKey(recipient);

    const supabase = createSupabaseServerClient();
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .or(`settlement_wallet_address.eq.${recipient},wallet_address.eq.${recipient}`)
      .maybeSingle();
    if (merchantError || !merchant?.id) {
      return NextResponse.json({ error: "Recipient is not a registered merchant" }, { status: 404 });
    }

    const sessionId = crypto.randomUUID();
    const transferMode = normalizeTransferMode(body?.mode);
    const amount = Number(amountBaseUnits) / 1_000_000;
    const environment = getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "sandbox";
    const { error: sessionError } = await supabase.from("checkout_sessions").insert({
      id: sessionId,
      merchant_id: merchant.id,
      environment,
      amount,
      amount_fiat: amount,
      amount_token: amount,
      currency: "USD",
      settlement_token: "USDC",
      status: "pending",
      transfer_mode: transferMode,
      created_at: new Date().toISOString(),
    });
    if (sessionError) return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });

    const { error: intentError } = await supabase.from("payment_ledger").insert({
      merchant_id: merchant.id,
      checkout_session_id: sessionId,
      amount,
      amount_base_units: Number(amountBaseUnits),
      mint: getAssetMintAddress("USDC", isDevnetNetwork()),
      token_symbol: "USDC",
      recipient_address: recipient,
      environment,
      status: "created",
      transfer_mode: transferMode,
    });
    if (intentError) {
      await supabase.from("checkout_sessions").delete().eq("id", sessionId);
      return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 });
    }

    return NextResponse.json({ intent_id: sessionId, session_id: sessionId, transfer_mode: transferMode });
  } catch {
    return NextResponse.json({ error: "Unable to create payment intent" }, { status: 400 });
  }
}