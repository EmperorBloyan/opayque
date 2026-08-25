import { encodeURL } from "@solana/pay";
import BigNumber from "bignumber.js";
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

function isValidPublicKey(value?: string | null): value is string {
  if (!value) {
    return false;
  }

  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeSplTokenMint(splToken?: string | null): string | undefined {
  const normalized = splToken?.trim().toUpperCase();

  if (!normalized) {
    return undefined;
  }

  switch (normalized) {
    case "USDC":
      return ASSET_MINTS.USDC.devnet;
    case "USDT":
      return ASSET_MINTS.USDT.devnet;
    case "SOL":
      return undefined;
    default:
      return isValidPublicKey(normalized) ? normalized : undefined;
  }
}

function toSafeAmount(value: number | string | undefined): BigNumber | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = typeof value === "string" ? value.trim() : String(value).trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = new BigNumber(normalized);
  if (!parsed.isFinite() || parsed.isLessThanOrEqualTo(0)) {
    return undefined;
  }

  return parsed;
}

export function generatePaymentURL(options: PaymentUrlOptions): string {
  try {
    const recipientValue = options.recipient?.trim();
    if (!recipientValue || !isValidPublicKey(recipientValue)) {
      return "";
    }

    const splTokenMint = normalizeSplTokenMint(options.splToken)?.trim();
    const amount = toSafeAmount(options.amount);

    if (!amount) {
      return "";
    }

    const fields = {
      recipient: new PublicKey(recipientValue) as any,
      amount: amount.toNumber(),
      label: options.label?.trim() || undefined,
      message: options.message?.trim() || undefined,
      memo: options.reference?.trim() || undefined,
    } as const;

    const encodedUrl = encodeURL(
      splTokenMint
        ? {
            ...fields,
            splToken: new PublicKey(splTokenMint) as any,
          }
        : fields
    ).toString();

    return encodedUrl.replace(/^solana:/i, "solana:");
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
