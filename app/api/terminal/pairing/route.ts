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
  for (let index = 0; index < 6; index += 1) {
    code += chars[random[index] % chars.length];
  }
  return code;
}

function normalizeWalletAddress(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

async function insertCompatibleTerminalRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  merchantId: string,
  terminalLabel: string,
  deviceToken: string,
  createdAt: string,
): Promise<{ id: string } | null> {
  const terminalId = randomUUID();
  const commonFields = {
    id: terminalId,
    merchant_id: merchantId,
    status: "online",
    created_at: createdAt,
  };

  const insertCandidates = [
    {
      ...commonFields,
      label: terminalLabel,
      terminal_label: terminalLabel,
      last_active: createdAt,
      is_active: true,
      device_token_hash: hashDeviceToken(deviceToken),
    },
    {
      ...commonFields,
      label: terminalLabel,
      terminal_label: terminalLabel,
      last_active: createdAt,
      is_active: true,
      device_token: deviceToken,
    },
    {
      ...commonFields,
      label: terminalLabel,
      terminal_label: terminalLabel,
      last_active: createdAt,
      is_active: true,
    },
    {
      ...commonFields,
      label: terminalLabel,
      last_active: createdAt,
      is_active: true,
      device_token: deviceToken,
    },
    {
      ...commonFields,
      label: terminalLabel,
      terminal_label: terminalLabel,
      device_token_hash: hashDeviceToken(deviceToken),
    },
  ];

  let lastError: unknown = null;

  for (const candidate of insertCandidates) {
    const { data, error } = await supabase.from("terminals").insert(candidate).select("id").maybeSingle();
    if (!error && data?.id) {
      return data;
    }
    lastError = error ?? new Error("Terminal row insertion failed");
  }

  throw lastError instanceof Error ? lastError : new Error("Terminal row insertion failed");
}

export async function POST(request: Request) {
  try {
    const rateLimit = await strictLimit(
      `terminal:pairing:${getClientAddress(request)}`,
      process.env.NODE_ENV === "production"
    );
    if (!rateLimit.allowed) return NextResponse.json({ success: false, error: rateLimit.error || "Too many pairing requests" }, { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "create";
    const merchantId = typeof body?.merchant_id === "string" ? body.merchant_id : null;
    const walletAddress = typeof body?.wallet_address === "string" ? body.wallet_address.trim() : null;
    const code = typeof body?.code === "string" ? body.code.toUpperCase() : null;

    const supabase = await createSupabaseServerClient(request);

    if (action === "create") {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      const { data: ownedMerchant, error: merchantLookupError } = await supabase
        .from("merchants")
        .select("id, wallet_address, settlement_wallet_address")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (merchantLookupError || !ownedMerchant) return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 403 });
      if (isValidMerchantId(merchantId) && merchantId !== ownedMerchant.id) {
        return NextResponse.json({ success: false, error: "Merchant does not belong to the authenticated session" }, { status: 403 });
      }
      const ownedMerchantId = ownedMerchant.id;

      const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
      const merchantWalletAddress = normalizeWalletAddress(
        ownedMerchant.settlement_wallet_address ?? ownedMerchant.wallet_address ?? ""
      );
      if (!merchantWalletAddress) {
        return NextResponse.json({
          success: false,
          error: "Save a settlement wallet in Vault before generating a pairing code.",
        }, { status: 409 });
      }
      const pairingCode = createPairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const terminalLabel = typeof body?.terminal_label === "string" ? body.terminal_label.trim() : null;
      if (terminalLabel && terminalLabel.length > 80) {
        return NextResponse.json({ success: false, error: "terminal_label must be 80 characters or fewer" }, { status: 400 });
      }

      if (normalizedWalletAddress && normalizedWalletAddress !== merchantWalletAddress) {
        return NextResponse.json({
          success: false,
          error: "The pairing wallet does not match the merchant settlement wallet. Refresh Vault and try again.",
        }, { status: 409 });
      }

      if (normalizedWalletAddress && normalizedWalletAddress === merchantWalletAddress && !ownedMerchant.wallet_address) {
        const { error: merchantUpdateError } = await supabase
          .from("merchants")
          .update({ wallet_address: normalizedWalletAddress, updated_at: new Date().toISOString() })
          .eq("id", ownedMerchantId);

        if (merchantUpdateError) {
          console.warn("Failed to link merchant wallet to pairing record", merchantUpdateError);
        }
      }

      const { error } = await supabase.from("terminal_pairing_codes").insert({
        code: pairingCode,
        merchant_id: ownedMerchantId,
        status: "PENDING",
        expires_at: expiresAt,
        terminal_label: terminalLabel,
      });

      if (error) {
        return NextResponse.json({ success: false, error: safeErrorMessage(error, "Pairing code creation failed") }, { status: 500 });
      }

      return NextResponse.json({ success: true, code: pairingCode, expiresAt, terminalLabel });
    }

    if (action === "verify") {
      if (!code) {
        return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
      }

      const adminSupabase = createSupabaseServerClient();
      const { data, error } = await adminSupabase
        .from("terminal_pairing_codes")
        .select("code, status, expires_at, merchant_id, terminal_label")
        .eq("code", code)
        .single();

      if (error || !data) {
        return NextResponse.json({ success: false, error: "PAIRING CODE REJECTED" }, { status: 404 });
      }

      const expiresAtMs = new Date(data.expires_at).getTime();
      const isExpired = Number.isNaN(expiresAtMs) || Date.now() >= expiresAtMs;
      const isPending = data.status === "PENDING";

      if (!isPending || isExpired) {
        return NextResponse.json({ success: false, error: "PAIRING CODE REJECTED" }, { status: 409 });
      }

      const requestedMerchantId = isValidMerchantId(merchantId) ? merchantId : null;
      const storedMerchantId = isValidMerchantId(data.merchant_id) ? data.merchant_id : null;

      if (requestedMerchantId && storedMerchantId && requestedMerchantId !== storedMerchantId) {
        return NextResponse.json({ success: false, error: "This pairing code belongs to a different vault merchant." }, { status: 409 });
      }

      const resolvedMerchantId = storedMerchantId ?? requestedMerchantId;

      if (!resolvedMerchantId) {
        return NextResponse.json({ success: false, error: "This pairing code is not linked to a vault merchant." }, { status: 400 });
      }

      let merchantData: { id: string; wallet_address?: string | null; settlement_wallet_address?: string | null; merchant_name?: string | null; merchant_logo?: string | null } | null = null;
      const { data: fetchedMerchantData, error: merchantError } = await adminSupabase
        .from("merchants")
        .select("id, wallet_address, settlement_wallet_address, merchant_name, merchant_logo")
        .eq("id", resolvedMerchantId)
        .single();

      merchantData = fetchedMerchantData ?? null;
      const suppliedWalletAddress = normalizeWalletAddress(walletAddress);
      let merchantWalletAddress = normalizeWalletAddress(merchantData?.wallet_address ?? merchantData?.settlement_wallet_address ?? "");

      if (merchantError || !merchantWalletAddress) {
        return NextResponse.json({
          success: false,
          error: "Merchant has no settlement wallet. Save a settlement address in Vault → API Keys & Merchant Details, then generate a new code.",
        }, { status: 404 });
      }

      if (suppliedWalletAddress && suppliedWalletAddress !== merchantWalletAddress) {
        return NextResponse.json({
          success: false,
          error: "Wallet mismatch. The wallet address from Vault does not match this terminal's session. Clear terminal storage and pair with a fresh code.",
        }, { status: 409 });
      }

      // Mark pairing code as used
      const { data: usedCode, error: updateError } = await adminSupabase
        .from("terminal_pairing_codes")
        .update({ status: "USED", merchant_id: resolvedMerchantId })
        .eq("code", code)
        .eq("status", "PENDING")
        .select("code")
        .maybeSingle();

      if (updateError || !usedCode) {
        return NextResponse.json(
          { success: false, error: safeErrorMessage(updateError, "PAIRING CODE REJECTED") },
          { status: updateError ? 500 : 409 }
        );
      }

      const terminalLabel =
        (typeof data.terminal_label === "string" && data.terminal_label.trim()) ||
        "Fleet Terminal";

      const nowIso = new Date().toISOString();
      const deviceToken = randomBytes(32).toString("base64url");

      let terminalId: string;
      try {
        const persisted = await insertCompatibleTerminalRow(adminSupabase, resolvedMerchantId, terminalLabel, deviceToken, nowIso);
        terminalId = persisted?.id ?? randomUUID();
      } catch (insertError) {
        console.warn("Failed to insert terminal fleet row", insertError);
        await adminSupabase
          .from("terminal_pairing_codes")
          .update({ status: "PENDING" })
          .eq("code", code)
          .eq("status", "USED");
        return NextResponse.json({ success: false, error: "Terminal pairing could not be persisted. Please try again." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        code,
        terminalId,
        deviceToken,
        merchantId: resolvedMerchantId,
        walletAddress: merchantWalletAddress,
        merchantName: merchantData?.merchant_name ?? null,
        merchantLogo: merchantData?.merchant_logo ?? null,
        terminalLabel,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: safeErrorMessage(error, "Pairing failed") }, { status: 500 });
  }
}