import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { z } from "zod";

function createPayloadHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const webhookPayloadSchema = z.object({
  merchant_id: z.string().uuid(),
  terminal_id: z.string().uuid().nullable().optional(),
  signature: z.string().trim().min(32).max(128),
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
    const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "A valid amount is required" }, { status: 400 });
    }

    const payloadHash = createPayloadHash(body);
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payment_ledger")
      .insert({
        merchant_id: body.merchant_id,
        terminal_id: body.terminal_id ?? null,
        signature: body.signature,
        token_symbol: body.token_symbol,
        amount,
        amount_base_units: Math.round(amount * (body.token_symbol === "USDC" ? 1_000_000 : 1_000_000_000)),
        mint: body.mint,
        recipient_address: body.recipient_address,
        environment: process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "mainnet" : "sandbox",
        status: "submitted",
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
