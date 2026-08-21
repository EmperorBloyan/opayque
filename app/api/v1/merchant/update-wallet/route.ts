import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  consumeWalletChallenge,
  getWalletChallenge,
} from "@/lib/auth/walletChallenge";

function decodeSignature(value: string): Uint8Array | null {
  const candidates: Uint8Array[] = [];

  try {
    candidates.push(new Uint8Array(Buffer.from(value, "base64")));
  } catch {
    // Try base58 below.
  }

  try {
    candidates.push(bs58.decode(value));
  } catch {
    // Invalid signature encoding.
  }

  return candidates.find((candidate) => candidate.length === nacl.sign.signatureLength) ?? null;
}

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
    const newWalletAddress = typeof body?.newWalletAddress === "string"
      ? body.newWalletAddress.trim()
      : "";
    const message = typeof body?.message === "string" ? body.message : "";
    const signature = typeof body?.signature === "string" ? body.signature : "";
    const nonce = typeof body?.nonce === "string" ? body.nonce : "";
    const purpose = body?.purpose === "refund" ? "refund" : "settlement";

    if (!newWalletAddress || !message || !signature || !nonce) {
      return NextResponse.json({ success: false, error: "Wallet update payload is incomplete" }, { status: 400 });
    }

    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(newWalletAddress);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid Solana wallet address" }, { status: 400 });
    }

    const canonicalAddress = publicKey.toBase58();
    const challenge = getWalletChallenge(nonce);
    if (!challenge) {
      return NextResponse.json({ success: false, error: "Wallet challenge is missing or expired" }, { status: 410 });
    }

    if (challenge.merchantId !== merchant.id) {
      return NextResponse.json({ success: false, error: "Wallet challenge does not belong to this merchant" }, { status: 409 });
    }

    if (challenge.purpose !== purpose) {
      return NextResponse.json({ success: false, error: "Wallet challenge purpose does not match this update" }, { status: 409 });
    }

    if (challenge.newWalletAddress !== canonicalAddress || challenge.message !== message) {
      return NextResponse.json({ success: false, error: "Wallet challenge does not match this update" }, { status: 409 });
    }

    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json({ success: false, error: "Wallet challenge has expired" }, { status: 410 });
    }

    const signatureBytes = decodeSignature(signature);
    if (!signatureBytes) {
      return NextResponse.json({ success: false, error: "Invalid signature encoding" }, { status: 400 });
    }

    const isValidSignature = nacl.sign.detached.verify(
      new TextEncoder().encode(challenge.message),
      signatureBytes,
      bs58.decode(canonicalAddress)
    );

    if (!isValidSignature) {
      return NextResponse.json({ success: false, error: "Wallet signature verification failed" }, { status: 401 });
    }

    // settlement_wallet_address is the payout target in DB; on-chain vault authority may still be the vault-init wallet. Do not move vault funds here.
    // refund_wallet_address is payout-out signer only; it does not require a separate on-chain merchant vault.
    const { data: updatedMerchant, error: updateError } = await supabase
      .from("merchants")
      .update({
        ...(purpose === "refund"
          ? { refund_wallet_address: canonicalAddress }
          : { settlement_wallet_address: canonicalAddress }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", merchant.id)
      .eq("auth_user_id", user.id)
      .select("id, settlement_wallet_address, refund_wallet_address, updated_at")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedMerchant) {
      return NextResponse.json({ success: false, error: "Merchant profile update failed" }, { status: 404 });
    }

    consumeWalletChallenge(nonce);

    return NextResponse.json({
      success: true,
      merchant: updatedMerchant,
    });
  } catch (error) {
    console.error("POST /api/v1/merchant/update-wallet error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
