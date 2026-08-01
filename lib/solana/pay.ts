import { encodeURL } from "@solana/pay";
import { PublicKey } from "@solana/web3.js";
import { ASSET_MINTS } from "./constants";

export interface PaymentUrlOptions {
  recipient: string;
  amount?: number | string;
  splToken?: string | null;
  reference?: string;
  label?: string;
  message?: string;
}

function normalizeSplTokenMint(splToken?: string | null): string | null {
  const normalized = splToken?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "USDC":
      return ASSET_MINTS.USDC.devnet;
    case "USDT":
      return ASSET_MINTS.USDT.devnet;
    default:
      return normalized;
  }
}

function toSafeAmount(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function generatePaymentURL(options: PaymentUrlOptions): string {
  try {
    const recipientValue = options.recipient?.trim();
    if (!recipientValue) {
      return "";
    }

    const recipientPublicKey = new PublicKey(recipientValue);
    const splTokenMint = normalizeSplTokenMint(options.splToken);
    const amount = toSafeAmount(options.amount);

    const fields = {
      recipient: recipientPublicKey.toBase58(),
      amount,
      splToken: splTokenMint ?? undefined,
      label: options.label?.trim() || undefined,
      message: options.message?.trim() || undefined,
      memo: options.reference?.trim() || undefined,
    };

    if (!amount) {
      return "";
    }

    return encodeURL(fields).toString();
  } catch {
    return "";
  }
}

export interface TransactionRequestUrlOptions extends PaymentUrlOptions {
  baseUrl?: string;
  path?: string;
}

export function generateTransactionRequestURL(options: TransactionRequestUrlOptions): string {
  const baseUrl = options.baseUrl ?? "http://localhost:3000";
  const path = options.path ?? "/api/pay/request";
  const url = new URL(path, baseUrl);

  url.searchParams.set("recipient", options.recipient);

  if (options.amount !== undefined && options.amount !== null && options.amount !== "") {
    url.searchParams.set("amount", String(options.amount));
  }

  if (options.splToken) {
    url.searchParams.set("splToken", options.splToken);
  }

  if (options.reference) {
    url.searchParams.set("reference", options.reference);
  }

  if (options.label) {
    url.searchParams.set("label", options.label);
  }

  if (options.message) {
    url.searchParams.set("message", options.message);
  }

  return url.toString();
}
