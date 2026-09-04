import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRealMerchantId } from "@/lib/terminal/guards";
import { hashDeviceToken } from "@/lib/terminal/deviceAuth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const terminalId = url.searchParams.get("terminalId")?.trim();
  const deviceToken = url.searchParams.get("deviceToken")?.trim();

  if (!terminalId || !deviceToken) {
    return NextResponse.json({ success: false, error: "Terminal credentials are required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: terminal, error } = await supabase
    .from("terminals")
    .select("id, merchant_id, device_token_hash, status")
    .eq("id", terminalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (
    !terminal ||
    !terminal.device_token_hash ||
    terminal.device_token_hash !== hashDeviceToken(deviceToken) ||
    ["revoked", "unpaired", "deleted"].includes(String(terminal.status).toLowerCase())
  ) {
    return NextResponse.json({ success: false, error: "Terminal is not paired" }, { status: 401 });
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, merchant_name, merchant_logo, wallet_address, settlement_wallet_address")
    .eq("id", terminal.merchant_id)
    .maybeSingle();

  if (merchantError || !merchant) {
    return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
  }

  const merchantWallet = (merchant.settlement_wallet_address || merchant.wallet_address || "").trim();
  if (!isRealMerchantId(merchant.id)) {
    return NextResponse.json({ success: false, error: "Merchant profile is not configured" }, { status: 409 });
  }
  if (!merchantWallet) {
    return NextResponse.json({ success: false, error: "Merchant wallet is not configured" }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    terminalId: terminal.id,
    merchantId: merchant.id,
    merchantWallet,
    merchantName: merchant.merchant_name,
    merchantLogo: merchant.merchant_logo,
  });
}
