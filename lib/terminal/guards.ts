import type { TerminalDeviceCredential, TerminalSession } from "@/lib/crypto/session";

const MERCHANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRealMerchantId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value !== "merchant-vault" && MERCHANT_ID_PATTERN.test(value.trim());
}

export interface TerminalReady {
  status: "ready";
  merchantId: string;
  merchantWallet: string;
  terminalId?: string;
  deviceToken?: string;
}

export interface TerminalUnavailable {
  status: "unavailable";
  reason: "merchant" | "wallet" | "credentials";
}

export type TerminalResolveState = TerminalReady | TerminalUnavailable;

interface TerminalContextInput {
  device?: TerminalDeviceCredential | null;
  session?: Pick<TerminalSession, "merchantId" | "walletAddress"> | null;
  ownerMerchantId?: string | null;
}

export function resolveTerminalContext({ device, session, ownerMerchantId }: TerminalContextInput): TerminalResolveState {
  if (device && isRealMerchantId(device.merchantId) && device.merchantWallet.trim() && device.terminalId.trim() && device.deviceToken.trim()) {
    return {
      status: "ready",
      merchantId: device.merchantId.trim(),
      merchantWallet: device.merchantWallet.trim(),
      terminalId: device.terminalId.trim(),
      deviceToken: device.deviceToken.trim(),
    };
  }

  if (session && isRealMerchantId(session.merchantId) && session.walletAddress.trim()) {
    return {
      status: "ready",
      merchantId: session.merchantId.trim(),
      merchantWallet: session.walletAddress.trim(),
    };
  }

  if (isRealMerchantId(ownerMerchantId)) {
    return { status: "unavailable", reason: "wallet" };
  }

  return { status: "unavailable", reason: device || session ? "credentials" : "merchant" };
}

export function assertTerminalReady(context: TerminalResolveState): asserts context is TerminalReady {
  if (context.status !== "ready") {
    throw new Error("Terminal is not ready for payments");
  }
}