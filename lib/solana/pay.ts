import { createTransfer, encodeURL } from "@solana/pay";
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

export function generatePaymentURL(options: PaymentUrlOptions): string {
  const recipient = options.recipient.trim();
  const splTokenMint = normalizeSplTokenMint(options.splToken);
  const amountValue = options.amount !== undefined && options.amount !== null && options.amount !== ""
    ? String(options.amount)
    : "0.00";

  const amount = Number(amountValue);
  const recipientPublicKey = new PublicKey(recipient);

  const transfer = createTransfer({
    recipient: recipientPublicKey,
    amount,
    splToken: splTokenMint ? new PublicKey(splTokenMint) : undefined,
    reference: options.reference ? [new PublicKey(options.reference)] : undefined,
    label: options.label,
    message: options.message,
  });

  const url = encodeURL(transfer);
  return url.toString();
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
