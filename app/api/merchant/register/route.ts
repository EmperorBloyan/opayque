import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/error-handler";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";
import { PublicKey } from "@solana/web3.js";

interface RegisterMerchantRequest {
  wallet_address?: string;
  publicKey?: string;
  merchant_name?: string;
  merchant_logo?: string;
  vaultInitialized?: boolean;
}

export async function POST(request: Request) {
  try {
    const rateLimit = await strictLimit(`merchant:register:${getClientAddress(request)}`, true);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: rateLimit.error || "Too many registration attempts" },
        { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = (await request.json()) as RegisterMerchantRequest;
    const walletAddress = (body.wallet_address || body.publicKey)?.trim();
    const merchantName = body.merchant_name?.trim();
    const merchantLogo = typeof body.merchant_logo === "string" ? body.merchant_logo.trim() || null : null;

    if (!walletAddress || (!merchantName && !body.vaultInitialized)) {
      return NextResponse.json({ success: false, error: "wallet_address and merchant_name are required" }, { status: 400 });
    }
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ success: false, error: "A valid Solana wallet address is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    if (body.vaultInitialized) {
      const { data, error } = await supabase
        .from("merchants")
        .update({ onboarding_status: "completed" })
        .eq("wallet_address", walletAddress)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ success: false, error: safeErrorMessage(error, "Merchant setup failed") }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: { merchant: data } });
    }

    const { data, error } = await supabase
      .from("merchants")
      .upsert({ wallet_address: walletAddress, merchant_name: merchantName, merchant_logo: merchantLogo }, { onConflict: "wallet_address" })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: safeErrorMessage(error, "Merchant registration failed") }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { merchant: data } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Registration failed" }, { status: 500 });
  }
}
