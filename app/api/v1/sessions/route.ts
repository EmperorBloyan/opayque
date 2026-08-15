import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildKeyHash, normalizeApiKeyHeader } from "@/lib/auth/apiKey";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const origin = `${forwardedProto}://${forwardedHost}`;

  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return origin;
  }

  return origin.replace(/\/$/, "");
}

async function authenticateMerchantApiKey(authHeader: string | null) {
  const rawKey = normalizeApiKeyHeader(authHeader);
  if (!rawKey) {
    return { error: "Missing or invalid Authorization header" } as const;
  }

  const keyHash = buildKeyHash(rawKey);
  const supabase = createSupabaseServerClient();

  const { data: keyRecord, error } = await supabase
    .from("api_keys")
    .select("merchant_id, environment")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!error && keyRecord?.merchant_id) {
    return {
      merchantId: keyRecord.merchant_id,
      environment: keyRecord.environment ?? "sandbox",
    };
  }

  const { data: legacyMerchant, error: legacyError } = await supabase
    .from("merchants")
    .select("id")
    .eq("api_key", rawKey)
    .maybeSingle();

  if (!legacyError && legacyMerchant?.id) {
    return { merchantId: legacyMerchant.id, environment: "sandbox" };
  }

  return { error: "Invalid API Key" } as const;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const auth = await authenticateMerchantApiKey(authHeader);

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = typeof body?.order_id === "string" && body.order_id.trim() ? body.order_id.trim() : null;
    const amountFiat = Number(body?.amount_fiat ?? body?.amount ?? body?.amount_fiat_usd ?? 0);
    const customerEmail = typeof body?.customer_email === "string" && body.customer_email.trim() ? body.customer_email.trim() : null;
    const settlementToken = typeof body?.settlement_token === "string" && body.settlement_token.trim()
      ? body.settlement_token.trim().toUpperCase()
      : typeof body?.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : "USDC";

    if (!orderId || !Number.isFinite(amountFiat) || amountFiat <= 0) {
      return NextResponse.json({ error: "order_id and amount_fiat are required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const sessionId = crypto.randomUUID();
    const origin = getRequestOrigin(request);
    const paymentUrl = `${origin}/checkout/${sessionId}`;

    const { error: insertError } = await supabase
      .from("checkout_sessions")
      .insert([
        {
          id: sessionId,
          merchant_id: auth.merchantId,
          environment: auth.environment,
          amount: Number(amountFiat),
          currency: settlementToken,
          customer_email: customerEmail,
          reference_id: orderId,
          status: "pending",
          solana_pay_url: paymentUrl,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error("Failed to create checkout session:", insertError);
      return NextResponse.json({ error: insertError.message || "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payment_url: paymentUrl,
      session_id: sessionId,
    });
  } catch (error) {
    console.error("POST /api/v1/sessions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}
