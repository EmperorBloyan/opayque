import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isValidMerchantId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createPairingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "create";
    const merchantId = typeof body?.merchant_id === "string" ? body.merchant_id : null;
    const walletAddress = typeof body?.wallet_address === "string" ? body.wallet_address.trim() : null;
    const code = typeof body?.code === "string" ? body.code.toUpperCase() : null;

    const supabase = await createSupabaseServerClient();

    if (action === "create") {
      const pairingCode = createPairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase.from("terminal_pairing_codes").insert({
        code: pairingCode,
        merchant_id: isValidMerchantId(merchantId) ? merchantId : null,
        status: "PENDING",
        expires_at: expiresAt,
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, code: pairingCode, expiresAt });
    }

    if (action === "verify") {
      if (!code) {
        return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("terminal_pairing_codes")
        .select("code, status, expires_at, merchant_id")
        .eq("code", code)
        .single();

      if (error || !data) {
        return NextResponse.json({ success: false, error: "PAIRING CODE REJECTED" }, { status: 404 });
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      const isExpired = now > expiresAt;
      const isPending = data.status === "PENDING";

      if (!isPending || isExpired) {
        return NextResponse.json({ success: false, error: "PAIRING CODE REJECTED" }, { status: 409 });
      }

      const requestedMerchantId = isValidMerchantId(merchantId) ? merchantId : null;
      const storedMerchantId = isValidMerchantId(data.merchant_id) ? data.merchant_id : null;
      let resolvedMerchantId = requestedMerchantId ?? storedMerchantId;

      if (!resolvedMerchantId && walletAddress) {
        const { data: merchantByWallet, error: walletFetchError } = await supabase
          .from("merchants")
          .select("id")
          .eq("wallet_address", walletAddress)
          .single();

        if (!walletFetchError && merchantByWallet?.id && isValidMerchantId(merchantByWallet.id)) {
          resolvedMerchantId = merchantByWallet.id;
        }
      }

      if (!resolvedMerchantId) {
        return NextResponse.json({ success: false, error: "Merchant ID is required" }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from("terminal_pairing_codes")
        .update({ status: "USED", merchant_id: resolvedMerchantId })
        .eq("code", code);

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      const { data: merchantData, error: merchantError } = await supabase
        .from("merchants")
        .select("wallet_address")
        .eq("id", resolvedMerchantId)
        .single();

      if (merchantError || !merchantData?.wallet_address) {
        return NextResponse.json({ success: false, error: "Merchant wallet address not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, code, merchantId: resolvedMerchantId, walletAddress: merchantData.wallet_address });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Pairing failed" }, { status: 500 });
  }
}
