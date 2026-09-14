import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { authenticateApiKey } from "@/lib/auth/apiKey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";
import { getSolanaNetwork } from "@/lib/solana/constants";
import { getAssetMintAddress, isDevnetNetwork } from "@/lib/solana/constants";
import { normalizeIdempotencyKey } from "@/lib/payments/ledger";
import { parseAmountToBaseUnits } from "@/lib/payments/amount";
import { buildPaymentRequestFingerprint } from "@/lib/payments/fingerprint";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { resolveSettlementWallet } from "@/lib/merchant/wallets";
import { normalizeTransferMode } from "@/lib/payments/transferMode";

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

export async function POST(request: Request) {
  try {
    const address = getClientAddress(request);
    const rateLimit = await strictLimit(`session:${address}`, true);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many session requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
    const authHeader = request.headers.get("authorization");
    const auth = await authenticateApiKey(authHeader);

    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const expectedEnvironment = getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "sandbox";
    if (auth.environment !== expectedEnvironment) {
      return NextResponse.json({ error: "API key environment does not match the configured Solana cluster" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const orderId =
      typeof body?.order_id === "string" && body.order_id.trim()
        ? body.order_id.trim()
        : null;
    if (orderId && orderId.length > 128) {
      return NextResponse.json({ error: "order_id must be 128 characters or fewer" }, { status: 400 });
    }

    const amountFiatBaseUnits = parseAmountToBaseUnits(body?.amount_fiat ?? body?.amount ?? body?.amount_fiat_usd, 2);
    const amountFiat = amountFiatBaseUnits ? Number(amountFiatBaseUnits) / 100 : 0;

    const customerEmail =
      typeof body?.customer_email === "string" && body.customer_email.trim()
        ? body.customer_email.trim()
        : null;
    if (customerEmail && customerEmail.length > 254) {
      return NextResponse.json({ error: "customer_email is too long" }, { status: 400 });
    }

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
    const settlementAmountBaseUnits = Number.isFinite(settlementAmount)
      ? parseAmountToBaseUnits(settlementAmount.toFixed(6), 6)
      : null;

    if (!orderId || !amountFiatBaseUnits || !settlementAmountBaseUnits || settlementAmountBaseUnits >= 1_000_000_000_000n || settlementToken !== "USDC") {
      return NextResponse.json(
        { error: `A valid ${displayCurrency} amount with an available FX rate is required; only USDC settlement is supported` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Load merchant settlement wallet + display name
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, merchant_name, wallet_address, settlement_wallet_address, default_transfer_mode")
      .eq("id", auth.merchantId)
      .maybeSingle();

    if (merchantError || !merchant?.id) {
      return NextResponse.json(
        { error: "Merchant profile not found for this API key" },
        { status: 400 }
      );
    }

    const merchantWallet = resolveSettlementWallet(merchant).address;
    if (!merchantWallet) {
      return NextResponse.json(
        {
          error:
            "Settlement wallet missing. Save a settlement wallet in Developer → API Keys & Merchant Details.",
        },
        { status: 400 }
      );
    }
    const transferMode = normalizeTransferMode(merchant.default_transfer_mode);

    const idempotencyKey = normalizeIdempotencyKey(request.headers.get("Idempotency-Key") || body?.idempotency_key);
    const requestFingerprint = buildPaymentRequestFingerprint({
      orderId,
      amountFiatBaseUnits: amountFiatBaseUnits.toString(),
      displayCurrency,
      settlementToken,
      customerEmail,
      description,
    });
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("payment_ledger")
        .select("*")
        .eq("merchant_id", auth.merchantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing?.checkout_session_id) {
        if (existing.idempotency_fingerprint && existing.idempotency_fingerprint !== requestFingerprint) {
          return NextResponse.json({ error: "Idempotency key was already used for a different payment" }, { status: 409 });
        }
        const { data: existingSession } = await supabase
          .from("checkout_sessions")
          .select("id, solana_pay_url")
          .eq("id", existing.checkout_session_id)
          .maybeSingle();
        return NextResponse.json({ success: true, payment_intent_id: existing.checkout_session_id, session_id: existing.checkout_session_id, payment_url: existingSession?.solana_pay_url || "", idempotent: true, transaction: existing });
      }
    }

    const merchantName = String(merchant.merchant_name || "Opayque Merchant").trim();
    const sessionId = crypto.randomUUID();
    const origin = getRequestOrigin(request);

    // ✅ Use the WORKING terminal checkout route
    const paymentUrl =
      `${origin}/checkout` +
      `?address=${encodeURIComponent(merchantWallet)}` +
      `&amount=${encodeURIComponent((Number(settlementAmountBaseUnits) / 1_000_000).toFixed(6))}` +
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
        amount: Number(settlementAmountBaseUnits) / 1_000_000,
        amount_fiat: Number(amountFiatBaseUnits) / 100,
        amount_token: Number(settlementAmountBaseUnits) / 1_000_000,
        currency: displayCurrency,
        settlement_token: settlementToken,
        customer_email: customerEmail,
        reference_id: orderId,
        status: "pending",
        transfer_mode: transferMode,
        solana_pay_url: paymentUrl,
        created_at: new Date().toISOString(),
      },
    ]);

    // Keep session record for tracking (optional but useful)
    const { error: insertError } = await supabase.from("checkout_sessions").insert([
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

    // Do not hard-fail payment link if session table insert fails
    if (insertError) {
      console.error("POST /api/v1/sessions checkout_sessions insert failed", {
        code: insertError.code,
        message: insertError.message,
        merchantId: auth.merchantId,
        transferMode,
      });
      const schemaError = insertError.code === "42703" || insertError.code === "42P01";
      const constraintError = insertError.code === "23514";
      return NextResponse.json(
        {
          error: schemaError
            ? "Checkout database is missing the latest payment schema migration"
            : constraintError
              ? "Checkout database rejected the configured transfer mode"
              : "Failed to create checkout session",
        },
        { status: 500 }
      );
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("payment_ledger")
      .insert({
        merchant_id: auth.merchantId,
        checkout_session_id: sessionId,
        amount: Number(settlementAmountBaseUnits) / 1_000_000,
        amount_base_units: Number(settlementAmountBaseUnits),
        mint: getAssetMintAddress("USDC", isDevnetNetwork()),
        token_symbol: "USDC",
        recipient_address: merchantWallet,
        memo: description.slice(0, 256),
        environment: auth.environment,
        idempotency_key: idempotencyKey,
        idempotency_fingerprint: requestFingerprint,
        status: "created",
        transfer_mode: transferMode,
      })
      .select("*")
      .maybeSingle();
    if (transactionError || !transaction) {
      if (transactionError?.code === "23505" && idempotencyKey) {
        const { data: existing } = await supabase
          .from("payment_ledger")
          .select("*")
          .eq("merchant_id", auth.merchantId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing?.idempotency_fingerprint === requestFingerprint && existing.checkout_session_id) {
          const { data: existingSession } = await supabase
            .from("checkout_sessions")
            .select("solana_pay_url")
            .eq("id", existing.checkout_session_id)
            .maybeSingle();
          return NextResponse.json({ success: true, payment_intent_id: existing.checkout_session_id, session_id: existing.checkout_session_id, payment_url: existingSession?.solana_pay_url || "", idempotent: true, transaction: existing });
        }
        return NextResponse.json({ error: "Idempotency key was already used for a different payment" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create payment ledger intent" }, { status: 500 });
    }
    await dispatchWebhookEvent({ merchantId: auth.merchantId, environment: auth.environment === "mainnet" ? "mainnet" : "sandbox", eventType: "payment.created", payload: transaction });

    return NextResponse.json({
      success: true,
      payment_intent_id: sessionId,
      session_id: sessionId,
      payment_url: paymentUrl,
      merchant_wallet: merchantWallet,
      amount_fiat: amountFiat,
      amount_token: Number(settlementAmountBaseUnits) / 1_000_000,
      token: settlementToken,
      description,
      customer_email: customerEmail,
      transfer_mode: transferMode,
      network: "Solana",
      transaction,
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