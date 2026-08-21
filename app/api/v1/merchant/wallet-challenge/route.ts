import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createWalletChallenge } from "@/lib/auth/walletChallenge";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (merchantError) {
      return NextResponse.json({ success: false, error: merchantError.message }, { status: 500 });
    }

    if (!merchant?.id) {
      return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const purpose = body?.purpose === "refund" ? "refund" : "settlement";
    if (typeof body?.newWalletAddress !== "string" || !body.newWalletAddress.trim()) {
      return NextResponse.json({ success: false, error: "newWalletAddress is required" }, { status: 400 });
    }

    let newWalletAddress: string;
    try {
      newWalletAddress = new PublicKey(body.newWalletAddress.trim()).toBase58();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid Solana wallet address" }, { status: 400 });
    }

    const challenge = createWalletChallenge({
      merchantId: merchant.id,
      newWalletAddress,
      purpose,
    });

    return NextResponse.json({
      success: true,
      message: challenge.message,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt,
      purpose: challenge.purpose,
    });
  } catch (error) {
    console.error("POST /api/v1/merchant/wallet-challenge error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
