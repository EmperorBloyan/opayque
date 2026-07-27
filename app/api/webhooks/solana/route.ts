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
    const payloadHash = createPayloadHash(body);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        merchant_id: body.merchant_id ?? "00000000-0000-0000-0000-000000000000",
        terminal_id: body.terminal_id ?? null,
        signature: body.signature ?? null,
        token_symbol: body.token_symbol ?? "SOL",
        amount: Number(body.amount ?? 0),
        status: body.status ?? "confirmed",
        payload_hash: payloadHash,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { transaction: data, payload_hash: payloadHash } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}
