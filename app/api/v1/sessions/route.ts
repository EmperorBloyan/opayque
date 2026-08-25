import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildKeyHash, normalizeApiKeyHeader } from "@/lib/auth/apiKey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRequestRateLimit } from "@/lib/rate-limit";

function getRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const forwardedHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost:3000";

  const origin = `${forwardedProto}://${forwardedHost}`;
  return origin.replace(/\/$/, "");
}

  const FALLBACK_RATES: Record<string, number> = {
    USD: 1,
    USDC: 1,
    EUR: 0.92,
    GBP: 0.78,
    NGN: 1600,
    GHS: 15.5,
    KES: 129,
    ZAR: 18.2,
    INR: 83,
    CAD: 1.36,
    AUD: 1.52,
  };

async function authenticateMerchantApiKey(authHeader: string | null) {
  const rawKey = normalizeApiKeyHeader(authHeader);
  if (!rawKey) {
    return { error: "Missing or invalid Authorization header" } as const;
  }

  const keyHash = buildKeyHash(rawKey);
  const supabase = createSupabaseServerClient();

  // Preferred: hashed key in api_keys
  const { data: keyRecord, error } = await supabase
    .from("api_keys")
    .select("merchant_id, environment")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!error && keyRecord?.merchant_id) {
    return {
      merchantId: keyRecord.merchant_id as string,
      environment: (keyRecord.environment as string) ?? "sandbox",
    };
  }

  // Legacy fallback: raw key stored on merchants.api_key
  const { data: legacyMerchant, error: legacyError } = await supabase
    .from("merchants")
    .select("id")
    .eq("api_key", rawKey)
    .maybeSingle();

  if (!legacyError && legacyMerchant?.id) {
    return {
      merchantId: legacyMerchant.id as string,
      environment: "sandbox",
    };
  }

  return { error: "Invalid API Key" } as const;
}

export async function POST(request: Request) {
  try {
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rateLimit = checkRequestRateLimit(`session:${address}`, 10);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many session requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
    const authHeader = request.headers.get("authorization");
    const auth = await authenticateMerchantApiKey(authHeader);

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const orderId =
      typeof body?.order_id === "string" && body.order_id.trim()
        ? body.order_id.trim()
        : null;

    const amountFiat = Number(
      body?.amount_fiat ?? body?.amount ?? body?.amount_fiat_usd ?? 0
    );

    const customerEmail =
      typeof body?.customer_email === "string" && body.customer_email.trim()
        ? body.customer_email.trim()
        : null;

    const description =
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : "Opayque Payment";

    const displayCurrency =
      typeof body?.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : "USD";
    const settlementToken =
      typeof body?.settlement_token === "string" && body.settlement_token.trim()
        ? body.settlement_token.trim().toUpperCase()
        : "USDC";
    const rate = FALLBACK_RATES[displayCurrency];
    const settlementAmount = displayCurrency === "USD" || displayCurrency === "USDC"
      ? amountFiat
      : rate ? amountFiat / rate : Number.NaN;

    if (!orderId || !Number.isFinite(amountFiat) || amountFiat <= 0 || !Number.isFinite(settlementAmount) || settlementAmount <= 0 || settlementAmount >= 1_000_000 || settlementToken !== "USDC") {
      return NextResponse.json(
        { error: `A valid ${displayCurrency} amount with an available FX rate is required; only USDC settlement is supported` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Load merchant settlement wallet + display name
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, merchant_name, settlement_wallet_address")
      .eq("id", auth.merchantId)
      .maybeSingle();

    if (merchantError || !merchant?.id) {
      return NextResponse.json(
        { error: "Merchant profile not found for this API key" },
        { status: 400 }
      );
    }

    const merchantWallet = String(merchant.settlement_wallet_address || "").trim();
    if (!merchantWallet) {
      return NextResponse.json(
        {
          error:
            "Settlement wallet missing. Save a settlement wallet in Developer → API Keys & Merchant Details.",
        },
        { status: 400 }
      );
    }

    const merchantName = String(merchant.merchant_name || "Opayque Merchant").trim();
    const sessionId = crypto.randomUUID();
    const origin = getRequestOrigin(request);

    // ✅ Use the WORKING terminal checkout route
    const paymentUrl =
      `${origin}/checkout` +
      `?address=${encodeURIComponent(merchantWallet)}` +
      `&amount=${encodeURIComponent(Number(settlementAmount.toFixed(6)).toFixed(6))}` +
      `&fiat_amount=${encodeURIComponent(amountFiat.toFixed(2))}` +
      `&currency=${encodeURIComponent(displayCurrency)}` +
      `&name=${encodeURIComponent(merchantName)}` +
      `&session=${encodeURIComponent(sessionId)}` +
      `&order=${encodeURIComponent(orderId)}` +
      `&token=${encodeURIComponent(settlementToken)}`;

    // Keep session record for tracking (optional but useful)
    const { error: insertError } = await supabase.from("checkout_sessions").insert([
      {
        id: sessionId,
        merchant_id: auth.merchantId,
        environment: auth.environment,
        amount: Number(settlementAmount.toFixed(6)),
        amount_fiat: Number(amountFiat.toFixed(2)),
        amount_token: Number(settlementAmount.toFixed(6)),
        currency: displayCurrency,
        settlement_token: settlementToken,
        customer_email: customerEmail,
        reference_id: orderId,
        status: "pending",
        solana_pay_url: paymentUrl,
        created_at: new Date().toISOString(),
      },
    ]);

    // Do not hard-fail payment link if session table insert fails
    if (insertError) {
      console.warn("checkout_sessions insert failed:", insertError.message);
    }

    return NextResponse.json({
      success: true,
      payment_intent_id: sessionId,
      session_id: sessionId,
      payment_url: paymentUrl,
      merchant_wallet: merchantWallet,
      amount_fiat: amountFiat,
      amount_token: Number(settlementAmount.toFixed(6)),
      token: settlementToken,
      description,
      customer_email: customerEmail,
      network: "Solana",
    });
  } catch (error) {
    console.error("POST /api/v1/sessions error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create session",
      },
      { status: 500 }
    );
  }
}