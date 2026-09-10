import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { hashDeviceToken } from "@/lib/terminal/deviceAuth";
import { safeErrorMessage } from "@/lib/error-handler";

function isValidMerchantId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createPairingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = randomBytes(6);
  let code = "";
  for (let index = 0; index < 6; index += 1) code += chars[random[index] % chars.length];
  return code;
}

function normalizeWalletAddress(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const rateLimit = await strictLimit(
      `terminal:pairing:${getClientAddress(request)}`,
      process.env.NODE_ENV === "production"
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: rateLimit.error || "Too many pairing requests" },
        { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "create";
    const merchantId = typeof body?.merchant_id === "string" ? body.merchant_id : null;
    const walletAddress = typeof body?.wallet_address === "string" ? body.wallet_address.trim() : null;
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : null;
    const supabase = createSupabaseServerClient(request);

    if (action === "create") {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

      const { data: merchant, error: merchantError } = await supabase
        .from("merchants")
        .select("id, wallet_address, settlement_wallet_address")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (merchantError || !merchant) return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 403 });
      if (isValidMerchantId(merchantId) && merchantId !== merchant.id) {
        return NextResponse.json({ success: false, error: "Merchant does not belong to the authenticated session" }, { status: 403 });
      }

      const merchantWallet = normalizeWalletAddress(merchant.settlement_wallet_address || merchant.wallet_address);
      if (!merchantWallet) {
        return NextResponse.json({ success: false, error: "Save a settlement wallet in Vault before generating a pairing code." }, { status: 409 });
      }
      if (walletAddress && walletAddress !== merchantWallet) {
        return NextResponse.json({ success: false, error: "The pairing wallet does not match the merchant settlement wallet." }, { status: 409 });
      }

      const terminalLabel = typeof body?.terminal_label === "string" ? body.terminal_label.trim() : null;
      if (terminalLabel && terminalLabel.length > 80) {
        return NextResponse.json({ success: false, error: "terminal_label must be 80 characters or fewer" }, { status: 400 });
      }

      const adminSupabase = createSupabaseServerClient();
      const pairingCode = createPairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await adminSupabase.from("terminal_pairing_codes").insert({
        code: pairingCode,
        merchant_id: merchant.id,
        status: "PENDING",
        expires_at: expiresAt,
        terminal_label: terminalLabel,
      });
      if (error) return NextResponse.json({ success: false, error: safeErrorMessage(error, "Pairing code creation failed") }, { status: 500 });

      return NextResponse.json(
        { success: true, code: pairingCode, expiresAt, terminalLabel },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    if (action === "verify") {
      if (!code) return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });

      const adminSupabase = createSupabaseServerClient();
      const { data: pairing, error: pairingError } = await adminSupabase
        .from("terminal_pairing_codes")
        .select("code, status, expires_at, merchant_id, terminal_label")
        .eq("code", code)
        .maybeSingle();
      if (pairingError || !pairing) return NextResponse.json({ success: false, error: "PAIRING CODE REJECTED" }, { status: 409 });

      const expiresAt = new Date(pairing.expires_at).getTime();
      if (pairing.status !== "PENDING" || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
        return NextResponse.json({ success: false, error: "PAIRING CODE REJECTED" }, { status: 409 });
      }

      const requestedMerchantId = isValidMerchantId(merchantId) ? merchantId : null;
      const storedMerchantId = isValidMerchantId(pairing.merchant_id) ? pairing.merchant_id : null;
      if (requestedMerchantId && storedMerchantId && requestedMerchantId !== storedMerchantId) {
        return NextResponse.json({ success: false, error: "This pairing code belongs to a different vault merchant." }, { status: 409 });
      }
      const resolvedMerchantId = storedMerchantId || requestedMerchantId;
      if (!resolvedMerchantId) return NextResponse.json({ success: false, error: "This pairing code is not linked to a vault merchant." }, { status: 400 });

      const { data: merchant, error: merchantError } = await adminSupabase
        .from("merchants")
        .select("id, wallet_address, settlement_wallet_address, merchant_name, merchant_logo")
        .eq("id", resolvedMerchantId)
        .maybeSingle();
      const merchantWallet = normalizeWalletAddress(merchant?.settlement_wallet_address || merchant?.wallet_address);
      if (merchantError || !merchant || !merchantWallet) {
        return NextResponse.json({ success: false, error: "Merchant has no settlement wallet. Save a settlement address and generate a new code." }, { status: 404 });
      }
      if (walletAddress && walletAddress !== merchantWallet) {
        return NextResponse.json({ success: false, error: "Wallet mismatch. Pair with a fresh code from the correct vault." }, { status: 409 });
      }

      const terminalId = randomUUID();
      const deviceToken = randomBytes(32).toString("base64url");
      const terminalLabel = typeof pairing.terminal_label === "string" && pairing.terminal_label.trim()
        ? pairing.terminal_label.trim()
        : "Fleet Terminal";
      const { data: redeemed, error: redemptionError } = await adminSupabase.rpc("redeem_terminal_pairing", {
        p_code: code,
        p_merchant_id: resolvedMerchantId,
        p_terminal_id: terminalId,
        p_terminal_label: terminalLabel,
        p_device_token_hash: hashDeviceToken(deviceToken),
      });

      if (redemptionError || !redeemed?.[0]) {
        const message = redemptionError?.message?.includes("PAIRING_CODE_REJECTED")
          ? "PAIRING CODE REJECTED"
          : redemptionError?.message?.includes("PAIRING_MERCHANT_MISMATCH")
            ? "This pairing code belongs to a different vault merchant."
            : redemptionError?.message?.includes("PAIRING_REQUEST_INVALID")
              ? "Invalid pairing request."
            : "Terminal pairing could not be persisted. Please try again.";
        return NextResponse.json({ success: false, error: message }, { status: message === "PAIRING CODE REJECTED" || message === "Invalid pairing request." ? 409 : 500 });
      }

      const { data: terminal, error: terminalError } = await adminSupabase
        .from("terminals")
        .select("id, merchant_id, terminal_label, label, status, is_active, last_active")
        .eq("id", terminalId)
        .maybeSingle();
      if (terminalError || !terminal) {
        return NextResponse.json({ success: false, error: "Terminal pairing was saved but the terminal record could not be loaded." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        code,
        terminalId,
        deviceToken,
        merchantId: resolvedMerchantId,
        walletAddress: merchantWallet,
        merchantName: merchant.merchant_name ?? null,
        merchantLogo: merchant.merchant_logo ?? null,
        terminalLabel: terminal.terminal_label,
        terminal,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: safeErrorMessage(error, "Pairing failed") }, { status: 500 });
  }
}
