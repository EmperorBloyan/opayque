import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SolanaWebhookPayload {
  merchant_id?: string;
  terminal_id?: string | null;
  signature?: string | null;
  token_symbol?: string;
  amount?: number | string;
  status?: string;
}

function createPayloadHash(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SolanaWebhookPayload;

    if (!body.merchant_id) {
      return NextResponse.json({ success: false, error: "merchant_id is required" }, { status: 400 });
    }

    const payloadHash = createPayloadHash(body);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        merchant_id: body.merchant_id,
        terminal_id: body.terminal_id ?? null,
        signature: body.signature ?? null,
        token_symbol: body.token_symbol ?? "SOL",
        amount: Number(body.amount ?? 0),
        status: ["created", "pending_signature", "submitted", "confirmed", "failed", "expired"].includes(body.status ?? "") ? body.status : "submitted",
        payload_hash: payloadHash,
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Transaction insertion failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { transaction: data, payload_hash: payloadHash } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}
