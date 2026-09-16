import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveRefundWallet } from "@/lib/merchant/wallets";

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
    if (!refundWallet.address) {
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

    if (status !== "confirmed") {
      return NextResponse.json({ success: false, error: `Cannot refund transaction in status: ${transaction.status}` }, { status: 409 });
    }

    const originalAmount = Number(transaction.amount ?? 0);
    if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > originalAmount)) {
      return NextResponse.json({ success: false, error: "Invalid refund amount" }, { status: 400 });
    }

    const refundAmount = requestedAmount ?? originalAmount;

    // Keep the refund flow working during wallet migration. Dedicated refund wallets are preferred,
    // but old merchants may only have a settlement wallet configured.
    const refundSource = refundWallet.source;
    const refundWalletAddress = refundWallet.address;

    return NextResponse.json({
      success: true,
      message: refundSource === "refund"
        ? "Refund prepared using the configured refund wallet."
        : refundSource === "settlement"
          ? "Refund prepared using the settlement wallet fallback."
          : "Refund prepared using the legacy wallet fallback.",
      details: {
        transactionId: transaction.id,
        merchantId: merchant.id,
        terminalId: transaction.terminal_id,
        refundWalletAddress,
        refundSource,
        refundAmount,
        tokenSymbol: transaction.token_symbol,
        reason,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("POST /api/v1/refund error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
