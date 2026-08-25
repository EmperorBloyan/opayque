import { NextResponse } from "next/server";
import { getAssetMintAddress } from "@/lib/solana/constants";
import { verifySolanaTransaction } from "@/lib/solana/verify";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
    const transactionId = params.id?.trim();

    if (!transactionId || !signature) {
      return NextResponse.json({ success: false, error: "Transaction ID and signature are required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(request);
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id, merchant_id, terminal_id, amount, token_symbol, status")
      .eq("id", transactionId)
      .maybeSingle();

    if (transactionError) {
      return NextResponse.json({ success: false, error: transactionError.message }, { status: 500 });
    }

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Terminal transaction not found" }, { status: 404 });
    }

    if (transaction.status !== "pending") {
      return NextResponse.json({ success: false, error: "Terminal transaction is no longer pending" }, { status: 409 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("settlement_wallet_address, wallet_address")
      .eq("id", transaction.merchant_id)
      .maybeSingle();

    if (merchantError || !merchant) {
      return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
    }

    const merchantWallet = String(merchant.settlement_wallet_address || merchant.wallet_address || "").trim();
    if (!merchantWallet) {
      return NextResponse.json({ success: false, error: "Merchant settlement wallet not configured" }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const isDevnet = rpcUrl.includes("devnet") || process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet-beta";
    const tokenSymbol = String(transaction.token_symbol || "USDC").toUpperCase();

    if (tokenSymbol !== "USDC") {
      return NextResponse.json({ success: false, error: "Only USDC terminal payments are supported" }, { status: 400 });
    }

    const verification = await verifySolanaTransaction({
      signature,
      expectedMerchantWallet: merchantWallet,
      expectedAmount: Number(transaction.amount),
      expectedTokenMint: getAssetMintAddress("USDC", isDevnet),
      expectedTokenDecimals: 6,
      rpcUrl,
    });

    if (!verification.verified) {
      return NextResponse.json({ success: false, error: "On-chain payment verification failed", details: verification.reason }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("transactions")
      .update({ signature, status: "settled", updated_at: new Date().toISOString() })
      .eq("id", transactionId)
      .eq("status", "pending")
      .select("id, status, signature")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ success: false, error: "Terminal transaction was settled by another request" }, { status: 409 });
    }

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to settle terminal payment" }, { status: 500 });
  }
}