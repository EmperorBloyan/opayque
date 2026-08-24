import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRealMerchantId } from "@/lib/terminal/guards";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
    const deviceToken = typeof body?.deviceToken === "string" ? body.deviceToken.trim() : "";
    const amount = Number(body?.amount);
    const tokenSymbol = typeof body?.tokenSymbol === "string" ? body.tokenSymbol.trim().toUpperCase() : "";

    if (!terminalId || !deviceToken || !Number.isFinite(amount) || amount <= 0 || amount >= 1_000_000 || !["USDC", "USDT", "SOL"].includes(tokenSymbol)) {
      return NextResponse.json({ success: false, error: "Valid terminal payment details are required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(request);
    const { data: terminal, error: terminalError } = await supabase
      .from("terminals")
      .select("id, merchant_id, device_token, status")
      .eq("id", terminalId)
      .eq("device_token", deviceToken)
      .maybeSingle();

    if (terminalError) {
      return NextResponse.json({ success: false, error: terminalError.message }, { status: 500 });
    }

    if (!terminal || terminal.status === "revoked" || !isRealMerchantId(terminal.merchant_id)) {
      return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        merchant_id: terminal.merchant_id,
        terminal_id: terminal.id,
        signature: null,
        token_symbol: tokenSymbol,
        amount,
        status: "pending",
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Failed to create pending transaction" }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to create payment" }, { status: 500 });
  }
}