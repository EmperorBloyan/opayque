import { NextResponse } from "next/server";
import { requireMerchantSession } from "@/lib/auth/serverMerchant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMerchantSession(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { merchant, supabase } = auth;

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") || "50", 10) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from("payment_ledger")
    .select("id, merchant_id, terminal_id, checkout_session_id, amount, amount_base_units, mint, token_symbol, sender_address, recipient_address, signature, status, memo, environment, failed_reason, confirmed_at, reconciliation_status, created_at, updated_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return NextResponse.json({ error: "Unable to load payment activity" }, { status: 500 });

  const rows = data ?? [];
  const terminalIds = [...new Set(rows.map((row) => row.terminal_id).filter(Boolean))];
  const terminalNames = new Map<string, string>();
  if (terminalIds.length > 0) {
    const { data: terminals } = await supabase
      .from("terminals")
      .select("id, terminal_label, label")
      .in("id", terminalIds);
    for (const terminal of terminals ?? []) {
      const label = String(terminal.terminal_label || terminal.label || "").trim();
      if (label) terminalNames.set(String(terminal.id), label);
    }
  }

  const enrichedRows = rows.map((row) => ({
    ...row,
    source_name: row.terminal_id ? terminalNames.get(String(row.terminal_id)) || "Merchant Terminal" : "System",
    source_category: row.terminal_id ? "Terminal" : "Registry",
  }));
  return NextResponse.json({ data: enrichedRows.slice(0, pageSize), page, pageSize, hasMore: rows.length > pageSize });
}
