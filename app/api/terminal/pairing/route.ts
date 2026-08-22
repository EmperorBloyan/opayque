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

function normalizeWalletAddress(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
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
      if (!isValidMerchantId(merchantId) || merchantId === "merchant-vault") {
        return NextResponse.json({ success: false, error: "Valid merchant wallet context required. Use vault registry to generate codes." }, { status: 400 });
      }

      const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
      const pairingCode = createPairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const terminalLabel = typeof body?.terminal_label === "string" ? body.terminal_label.trim() : null;

      if (normalizedWalletAddress) {
        const { error: merchantUpdateError } = await supabase
          .from("merchants")
          .update({ wallet_address: normalizedWalletAddress, updated_at: new Date().toISOString() })
          .eq("id", merchantId);

        if (merchantUpdateError) {
          console.warn("Failed to link merchant wallet to pairing record", merchantUpdateError);
        }
      }

      const { error } = await supabase.from("terminal_pairing_codes").insert({
        code: pairingCode,
        merchant_id: merchantId,
        status: "PENDING",
        expires_at: expiresAt,
        terminal_label: terminalLabel,
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, code: pairingCode, expiresAt, terminalLabel });
    }

    if (action === "verify") {
      if (!code) {
        return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
      }

      const { data, error } = await supabase
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
      const { data: fetchedMerchantData, error: merchantError } = await supabase
        .from("merchants")
        .select("id, wallet_address, settlement_wallet_address, merchant_name, merchant_logo")
        .eq("id", resolvedMerchantId)
        .single();

      merchantData = fetchedMerchantData ?? null;
      const suppliedWalletAddress = normalizeWalletAddress(walletAddress);
      let merchantWalletAddress = normalizeWalletAddress(merchantData?.wallet_address ?? merchantData?.settlement_wallet_address ?? "");

      if (!merchantError && !merchantWalletAddress && suppliedWalletAddress && resolvedMerchantId) {
        const { error: walletPatchError } = await supabase
          .from("merchants")
          .update({ wallet_address: suppliedWalletAddress, updated_at: new Date().toISOString() })
          .eq("id", resolvedMerchantId);

        if (!walletPatchError) {
          merchantWalletAddress = suppliedWalletAddress;
          merchantData = { ...(merchantData ?? { id: resolvedMerchantId }), wallet_address: suppliedWalletAddress };
        }
      }

      if (merchantError || !merchantWalletAddress) {
        return NextResponse.json({
          success: false,
          error: "This pairing code is not linked to a vault merchant wallet. Use a code generated in the vault registry.",
        }, { status: 404 });
      }

      if (suppliedWalletAddress && suppliedWalletAddress !== merchantWalletAddress) {
        return NextResponse.json({
          success: false,
          error: "This pairing code is not linked to a vault merchant wallet. Use a code generated in the vault registry.",
        }, { status: 409 });
      }

      // Mark pairing code as used
      const { error: updateError } = await supabase
        .from("terminal_pairing_codes")
        .update({ status: "USED", merchant_id: resolvedMerchantId })
        .eq("code", code);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      const terminalLabel =
        (typeof data.terminal_label === "string" && data.terminal_label.trim()) ||
        "Fleet Terminal";

      const nowIso = new Date().toISOString();
      const terminalId = `term_${resolvedMerchantId.slice(0, 8)}_${code}`;

      // Minimal core fields first (always safe)
      const coreUpdate = {
        status: "online",
        label: terminalLabel,
        terminal_label: terminalLabel,
      };

      // Optional enrichment (may not exist on every schema)
      const richUpdate = {
        ...coreUpdate,
        last_active: nowIso,
        is_active: true,
        device_token: code,
      };

      const richInsert = {
        id: terminalId,
        merchant_id: resolvedMerchantId,
        label: terminalLabel,
        terminal_label: terminalLabel,
        status: "online",
        created_at: nowIso,
        last_active: nowIso,
        is_active: true,
        device_token: code,
      };

      let { error: terminalInsertError } = await supabase
        .from("terminals")
        .insert(richInsert);

      // Fallback to minimal insert when optional columns are unavailable.
      if (terminalInsertError) {
        const retry = await supabase.from("terminals").insert({
          id: terminalId,
          merchant_id: resolvedMerchantId,
          label: terminalLabel,
          terminal_label: terminalLabel,
          status: "online",
          created_at: nowIso,
        });
        terminalInsertError = retry.error;
      }

      if (terminalInsertError) {
        console.warn("Failed to insert terminal fleet row", terminalInsertError);
      }

      return NextResponse.json({
        success: true,
        code,
        terminalId,
        deviceToken: code,
        merchantId: resolvedMerchantId,
        walletAddress: merchantWalletAddress,
        merchantName: merchantData?.merchant_name ?? null,
        merchantLogo: merchantData?.merchant_logo ?? null,
        terminalLabel,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Pairing failed" }, { status: 500 });
  }
}