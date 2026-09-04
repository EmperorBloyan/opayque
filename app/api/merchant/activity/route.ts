import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (merchantError) return NextResponse.json({ error: "Unable to resolve merchant" }, { status: 500 });
  if (!merchant?.id) return NextResponse.json({ data: [], page: 1, pageSize: 50, hasMore: false });

  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") || "50", 10) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const { data, error } = await supabase
    .from("payment_ledger")
    .select("id, merchant_id, terminal_id, checkout_session_id, amount, amount_base_units, mint, token_symbol, sender_address, recipient_address, signature, status, memo, environment, failed_reason, confirmed_at, reconciliation_status, created_at, updated_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return NextResponse.json({ error: "Unable to load payment activity" }, { status: 500 });

  const rows = data ?? [];
  return NextResponse.json({ data: rows.slice(0, pageSize), page, pageSize, hasMore: rows.length > pageSize });
}
