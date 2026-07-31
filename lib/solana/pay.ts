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
      return "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    case "USDT":
      return "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    default:
      return normalized;
  }
}

export function generatePaymentURL(options: PaymentUrlOptions): string {
  const params = new URLSearchParams();
  const recipient = options.recipient.trim();
  const splTokenMint = normalizeSplTokenMint(options.splToken);

  if (options.amount !== undefined && options.amount !== null && options.amount !== "") {
    params.set("amount", String(options.amount));
  }

  if (splTokenMint) {
    params.set("spl-token", splTokenMint);
  }

  if (options.reference) {
    params.set("reference", options.reference);
  }

  if (options.label) {
    params.set("label", options.label);
  }

  if (options.message) {
    params.set("message", options.message);
  }

  const query = params.toString();
  return `solana:${recipient}${query ? `?${query}` : ""}`;
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
