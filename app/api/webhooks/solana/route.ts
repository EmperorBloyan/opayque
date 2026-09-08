import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { z } from "zod";
import { parseAmountToBaseUnits } from "@/lib/payments/amount";

function createPayloadHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const webhookPayloadSchema = z.object({
  intent_id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  terminal_id: z.string().uuid().nullable().optional(),
  signature: z.string().trim().min(32).max(128),
  sender_address: z.string().trim().min(32).max(64).nullable().optional(),
  token_symbol: z.string().trim().toUpperCase().default("SOL"),
  mint: z.string().trim().min(1).max(64),
  recipient_address: z.string().trim().min(32).max(64),
  amount: z.union([z.number(), z.string().trim()]),
}).strict();

export async function POST(request: Request) {
  try {
    const secret = process.env.SOLANA_WEBHOOK_SECRET;
    const rawBody = await request.text();
    const providedSignature = request.headers.get("x-solana-webhook-signature")?.trim() || "";
    if (!secret || !providedSignature) {
      return NextResponse.json({ success: false, error: "Webhook authentication is not configured" }, { status: 503 });
    }
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (providedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      return NextResponse.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
    }

    let input: unknown;
    try {
      input = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid webhook JSON" }, { status: 400 });
    }
    const parsed = webhookPayloadSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid Solana webhook payload" }, { status: 400 });
    }
    const body = parsed.data;
    const amountBaseUnits = parseAmountToBaseUnits(body.amount, body.token_symbol === "USDC" ? 6 : 9);
    if (!amountBaseUnits) {
      return NextResponse.json({ success: false, error: "A valid amount is required" }, { status: 400 });
    }

    const payloadHash = createPayloadHash(body);
    const supabase = createSupabaseServerClient();
    const { data: intent, error: intentError } = await supabase
      .from("payment_ledger")
      .select("*")
      .eq("id", body.intent_id)
      .eq("merchant_id", body.merchant_id)
      .maybeSingle();

    if (intentError) {
      return NextResponse.json({ success: false, error: "Unable to load payment intent" }, { status: 500 });
    }
    if (!intent) {
      return NextResponse.json({ success: false, error: "Payment intent not found" }, { status: 404 });
    }
    if (intent.signature && intent.signature !== body.signature) {
      return NextResponse.json({ success: false, error: "Payment intent is already associated with another signature" }, { status: 409 });
    }
    if (!["created", "pending_signature", "submitted"].includes(String(intent.status))) {
      if (intent.signature === body.signature && intent.status === "confirmed") {
        return NextResponse.json({ success: true, idempotent: true, data: { transaction: intent, payload_hash: payloadHash } });
      }
      return NextResponse.json({ success: false, error: "Payment intent is no longer payable" }, { status: 409 });
    }
    if (intent.token_symbol !== body.token_symbol || intent.mint !== body.mint || intent.recipient_address !== body.recipient_address || BigInt(intent.amount_base_units) !== amountBaseUnits) {
      return NextResponse.json({ success: false, error: "Webhook facts do not match the payment intent" }, { status: 409 });
    }
    if (intent.sender_address && body.sender_address && intent.sender_address !== body.sender_address) {
      return NextResponse.json({ success: false, error: "Webhook sender does not match the payment intent" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("payment_ledger")
      .update({
        signature: body.signature,
        sender_address: body.sender_address ?? intent.sender_address,
        status: "submitted",
        payload_hash: payloadHash,
      })
      .eq("id", intent.id)
      .in("status", ["created", "pending_signature", "submitted"])
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: "Payment intent update failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: "Payment intent changed; retry webhook" }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: { transaction: data, payload_hash: payloadHash } });
  } catch (error) {
    console.error("Solana webhook processing failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
