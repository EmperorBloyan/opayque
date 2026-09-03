import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertProductionConfig } from "@/lib/solana/constants";
import { selectHealthyRpcUrl } from "@/lib/solana/rpc";
import { Connection } from "@solana/web3.js";
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
      .from("transactions")
      .select("id, merchant_id, signature, status, reconciliation_status, last_reconciled_at")
      .in("status", ["submitted", "confirmed", "failed"])
      .or(`reconciliation_status.eq.pending,last_reconciled_at.lt.${cutoff}`)
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);
    if (error) throw error;

    const rpcUrl = await selectHealthyRpcUrl();
    const connection = new Connection(rpcUrl, "confirmed");
    let matched = 0;
    let mismatch = 0;
    let notFound = 0;

    for (const row of rows ?? []) {
      let reconciliationStatus: "matched" | "mismatch" | "not_found" = "not_found";
      let notes = "No public signature is available for reconciliation";
      if (row.signature) {
        const result = await connection.getSignatureStatuses([row.signature], { searchTransactionHistory: true });
        const status = result.value[0];
        if (!status) {
          notes = "Signature was not found on the selected Solana RPC";
        } else if (status.err) {
          reconciliationStatus = "mismatch";
          notes = "On-chain signature reports an execution error";
        } else {
          reconciliationStatus = "matched";
          notes = "Signature is publicly observable; private transfer visibility is not inferred";
        }
      }
      const { error: updateError } = await supabase
        .from("transactions")
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
