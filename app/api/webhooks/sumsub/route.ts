import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validSignature(body: string, signature: string | null) {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-payload-digest"))) {
    return NextResponse.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { applicantId?: string; reviewStatus?: string; reviewResult?: { reviewAnswer?: string } };
  const merchantId = payload.applicantId?.trim();
  if (!merchantId) return NextResponse.json({ success: true });

  const reviewAnswer = payload.reviewResult?.reviewAnswer?.toLowerCase();
  const status = reviewAnswer === "green" ? "approved" : reviewAnswer === "red" ? "rejected" : payload.reviewStatus === "completed" ? "review" : "pending";
  const supabase = createSupabaseServerClient();
  await supabase.from("merchants").update({ screening_status: status, provider_ref: merchantId, screened_at: new Date().toISOString() }).eq("id", merchantId);
  return NextResponse.json({ success: true });
}