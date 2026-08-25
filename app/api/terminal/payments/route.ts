import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRealMerchantId } from "@/lib/terminal/guards";
import { requireTerminalDevice } from "@/lib/terminal/deviceAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const terminalId = typeof body?.terminalId === "string" ? body.terminalId.trim() : "";
    const amount = Number(body?.amount);
    const tokenSymbol = typeof body?.tokenSymbol === "string" ? body.tokenSymbol.trim().toUpperCase() : "";
    const normalizedAmount = Number(amount.toFixed(6));

    if (!terminalId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount >= 1_000_000 || tokenSymbol !== "USDC") {
      return NextResponse.json({ success: false, error: "Valid terminal payment details are required" }, { status: 400 });
    }

    const auth = await requireTerminalDevice(request, terminalId);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { terminal, supabase } = auth;

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
        amount: normalizedAmount,
        status: "created",
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