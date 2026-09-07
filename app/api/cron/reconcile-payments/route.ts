import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertProductionConfig } from "@/lib/solana/constants";
import { selectHealthyRpcUrl } from "@/lib/solana/rpc";
import { verifySolanaTransaction } from "@/lib/solana/verify";
import { getAssetMintAddress, isDevnetNetwork } from "@/lib/solana/constants";
import * as Sentry from "@/lib/sentry";

const MAX_BATCH = 100;
const STALE_AFTER_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertProductionConfig();
    const supabase = createSupabaseServerClient();
    const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    const { data: rows, error } = await supabase
      .from("payment_ledger")
      .select("id, merchant_id, signature, status, amount, amount_base_units, sender_address, recipient_address, mint, token_symbol, reconciliation_status, last_reconciled_at")
      .in("status", ["submitted", "confirmed", "failed"])
      .or(`reconciliation_status.eq.pending,last_reconciled_at.lt.${cutoff}`)
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (error) throw error;

    const rpcUrl = await selectHealthyRpcUrl();
    let matched = 0;
    let mismatch = 0;
    let notFound = 0;

    for (const row of rows ?? []) {
      let reconciliationStatus: "matched" | "mismatch" | "not_found" = "not_found";
      let notes = "No public signature is available for reconciliation";
      if (row.signature) {
        const verification = await verifySolanaTransaction({
          signature: row.signature,
          expectedMerchantWallet: row.recipient_address,
          expectedSender: row.sender_address,
          expectedAmount: Number(row.amount),
          expectedAmountBaseUnits: row.amount_base_units ? BigInt(row.amount_base_units) : undefined,
          expectedTokenMint: row.token_symbol === "USDC" ? (row.mint || getAssetMintAddress("USDC", isDevnetNetwork())) : undefined,
          expectedTokenDecimals: row.token_symbol === "USDC" ? 6 : 9,
          rpcUrl,
        });
        if (verification.verified) {
          reconciliationStatus = "matched";
          notes = "Settlement facts match the payment intent at finalized commitment";
        } else if (/not found|failed or not found/i.test(verification.reason)) {
          notes = "Signature was not found on the selected Solana RPC";
        } else {
          reconciliationStatus = "mismatch";
          notes = verification.reason;
        }
      }
      const { error: updateError } = await supabase
        .from("payment_ledger")
        .update({ reconciliation_status: reconciliationStatus, last_reconciled_at: new Date().toISOString(), reconciliation_notes: notes })
        .eq("id", row.id);
      if (updateError) throw updateError;
      if (reconciliationStatus === "matched") matched += 1;
      if (reconciliationStatus === "mismatch") mismatch += 1;
      if (reconciliationStatus === "not_found") notFound += 1;
    }

    return NextResponse.json({ success: true, processed: rows?.length ?? 0, matched, mismatch, notFound });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Payment reconciliation failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ success: false, error: "Payment reconciliation failed" }, { status: 500 });
  }
}
