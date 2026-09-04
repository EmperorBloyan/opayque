import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function createSupabaseFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore cookie writes in a server component context.
          }
        },
      },
    }
  );
}

function resolveRefundWallet(merchant: {
  refund_wallet_address?: string | null;
  settlement_wallet_address?: string | null;
  wallet_address?: string | null;
}) {
  return (
    merchant.refund_wallet_address?.trim() ||
    merchant.settlement_wallet_address?.trim() ||
    merchant.wallet_address?.trim() ||
    null
  );
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseFromCookies(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const transactionId = String(body.transactionId || body.paymentId || "").trim();
    const requestedAmount = body.amount === undefined || body.amount === null
      ? null
      : Number(body.amount);
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

    if (!transactionId) {
      return NextResponse.json({ success: false, error: "transactionId is required" }, { status: 400 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, refund_wallet_address, settlement_wallet_address, wallet_address")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (merchantError) {
      return NextResponse.json({ success: false, error: merchantError.message }, { status: 500 });
    }

    if (!merchant?.id) {
      return NextResponse.json({ success: false, error: "Merchant not found" }, { status: 404 });
    }

    const refundWallet = resolveRefundWallet(merchant);
    if (!refundWallet) {
      return NextResponse.json({
        success: false,
        error: "No refund wallet configured. Connect a refund or settlement wallet first.",
      }, { status: 400 });
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("payment_ledger")
      .select("id, merchant_id, terminal_id, amount, status, signature, token_symbol")
      .eq("id", transactionId)
      .eq("merchant_id", merchant.id)
      .maybeSingle();

    if (transactionError) {
      return NextResponse.json({ success: false, error: transactionError.message }, { status: 500 });
    }

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Transaction not found for this merchant" }, { status: 404 });
    }

    const status = String(transaction.status || "").toLowerCase();
    if (["refunded", "refund_pending"].includes(status)) {
      return NextResponse.json({ success: false, error: `Transaction already ${status}` }, { status: 409 });
    }

    if (status && !["pending", "settled", "completed", "success", "paid"].includes(status)) {
      return NextResponse.json({ success: false, error: `Cannot refund transaction in status: ${transaction.status}` }, { status: 400 });
    }

    const originalAmount = Number(transaction.amount ?? 0);
    if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > originalAmount)) {
      return NextResponse.json({ success: false, error: "Invalid refund amount" }, { status: 400 });
    }

    const refundAmount = requestedAmount ?? originalAmount;

    // Refund wallet is payout-out signer only; no separate on-chain merchant vault is required.
    // The current program has no refund instruction, so fail closed until a refund relayer exists.
    return NextResponse.json({
      success: false,
      error: "On-chain refund not implemented",
      code: "REFUND_ONCHAIN_NOT_IMPLEMENTED",
      details: {
        transactionId: transaction.id,
        merchantId: merchant.id,
        terminalId: transaction.terminal_id,
        refundWallet,
        refundAmount,
        tokenSymbol: transaction.token_symbol,
        reason,
      },
    }, { status: 501 });
  } catch (error) {
    console.error("POST /api/v1/refund error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
