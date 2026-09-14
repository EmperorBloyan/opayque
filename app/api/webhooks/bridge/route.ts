import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validSignature(body: string, signature: string | null) {
  const secret = process.env.BRIDGE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-bridge-signature"))) {
    return NextResponse.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { id?: string; status?: string };
  if (payload.id && payload.status) {
    const status = ["completed", "processing", "pending", "failed"].includes(payload.status.toLowerCase())
      ? payload.status.toLowerCase()
      : "pending";
    const supabase = createSupabaseServerClient();
    await supabase.from("offramp_payouts").update({ status, updated_at: new Date().toISOString() }).eq("provider_payout_id", payload.id);
  }
  return NextResponse.json({ success: true, received: true });
}