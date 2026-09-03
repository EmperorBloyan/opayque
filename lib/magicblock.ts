import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { assertProductionConfig, getAssetMintAddress, getSolanaNetwork, getSolanaRpcUrls, isDevnetNetwork } from "@/lib/solana/constants";
import { getPriorityFeeConfig } from "@/lib/solana/priorityFee";
import { selectHealthyRpcUrl } from "@/lib/solana/rpc";
import { logLifecycle } from "@/lib/observability";

export const PAYMENTS_API =
  process.env.NEXT_PUBLIC_MAGICBLOCK_API || "https://payments.magicblock.app";
export const TEE_RPC =
  getSolanaRpcUrls()[0];
const isDevnet = isDevnetNetwork();
export const USDC_MINT = new PublicKey(getAssetMintAddress("USDC", isDevnet));
let magicBlockUnavailableUntil = 0;
let consecutiveFailures = 0;
let circuitOpenLogged = false;

function recordMagicBlockFailure(error: unknown): void {
  consecutiveFailures += 1;
  const errorClass = error instanceof Error ? error.name : "MagicBlockRequestError";
  if (consecutiveFailures >= 3) {
    magicBlockUnavailableUntil = Date.now() + 30_000;
    if (!circuitOpenLogged) {
      circuitOpenLogged = true;
      logLifecycle("error", "private_transfer", "circuit_open", getSolanaNetwork(), errorClass);
    }
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== "string") {
    throw new Error("Missing transaction payload from transfer API.");
  }

  const normalizedBase64 = base64.replace(/\s+/g, "");
  const binaryString =
    typeof window !== "undefined"
      ? atob(normalizedBase64)
      : Buffer.from(normalizedBase64, "base64").toString("binary");

  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(ms / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestPrivateSplTransfer({
  sender,
  recipient,
  mint,
  amountBaseUnits,
  memo,
}: {
  sender: string;
  recipient: string;
  mint: string;
  amountBaseUnits: number;
  memo?: string;
}): Promise<{ transaction: string; blockhash?: string; lastValidBlockHeight?: number; rpcUrl?: string }> {
  assertProductionConfig();
  if (Date.now() < magicBlockUnavailableUntil) {
    throw new Error("Private transfer service is temporarily unavailable; please retry shortly.");
  }
  if (circuitOpenLogged && Date.now() >= magicBlockUnavailableUntil) circuitOpenLogged = false;
    logLifecycle("info", "private_transfer", "build", getSolanaNetwork());
  const endpoint = `${PAYMENTS_API.replace(/\/$/, "")}/v1/spl/transfer`;
  const priorityFee = getPriorityFeeConfig();
  const rpcUrl = await selectHealthyRpcUrl();
  let response: Response;
  try {
    response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MAGICBLOCK_API_KEY
        ? { Authorization: `Bearer ${process.env.MAGICBLOCK_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      from: sender,
      to: recipient,
      mint,
      amount: amountBaseUnits,
      visibility: "private",
      fromBalance: "base",
      toBalance: "base",
      initIfMissing: true,
      initAtasIfMissing: true,
      initVaultIfMissing: true,
      memo,
      minDelayMs: 0,
      maxDelayMs: 0,
      split: 1,
      computeUnitLimit: priorityFee.computeUnitLimit,
      priorityFeeMicroLamports: priorityFee.microLamports,
      rpcUrl,
      cluster: getSolanaNetwork() === "mainnet-beta" ? "mainnet" : "devnet",
    }),
    }, 25000);
  } catch (error) {
    recordMagicBlockFailure(error);
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  const transaction = typeof payload === "string"
    ? payload
    : payload?.transactionBase64 || payload?.transaction || payload?.serializedTransaction || payload?.data?.transactionBase64 || payload?.data?.transaction;

  if (!response.ok || typeof transaction !== "string" || transaction.length === 0) {
    recordMagicBlockFailure(new Error("MagicBlockResponseError"));
    const detail = payload?.error || payload?.message || `MagicBlock private transfer failed (HTTP ${response.status})`;
    throw new Error(String(detail));
  }

  consecutiveFailures = 0;
  magicBlockUnavailableUntil = 0;
  circuitOpenLogged = false;
  logLifecycle("info", "private_transfer", "build_ready", getSolanaNetwork());

  return {
    transaction,
    blockhash: typeof payload?.blockhash === "string" ? payload.blockhash : undefined,
    lastValidBlockHeight: Number.isFinite(Number(payload?.lastValidBlockHeight)) ? Number(payload.lastValidBlockHeight) : undefined,
    rpcUrl: typeof payload?.rpcUrl === "string" ? payload.rpcUrl : typeof payload?.sendTo === "string" ? payload.sendTo : undefined,
  };
}

export async function getPrivateBalance(address: string): Promise<number> {
  try {
    const response = await fetchWithTimeout(
      `${PAYMENTS_API}/balance/private`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, mint: USDC_MINT.toBase58() }),
      },
      15000
    );

    if (!response.ok) {
      throw new Error("Failed to fetch balance");
    }

    const data = await response.json();
    return (data.balance ?? 0) / 1_000_000;
  } catch (error) {
    console.error("Private balance error:", error);
    return 0;
  }
}

export async function buildShieldedTransfer(
  sender: string,
  recipient: string,
  amount: number,
  intentId: string
): Promise<{ transaction: VersionedTransaction | Transaction; blockhash: string; lastValidBlockHeight: number; rpcUrl?: string; mode: "private" }> {
  const response = await fetchWithTimeout(
    "/api/transfer",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        recipient,
        amount,
        intent_id: intentId,
        mint: USDC_MINT.toBase58(),
        private: true,
      }),
    },
    20000
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.transaction || typeof data.transaction !== "string") {
    console.error("Transfer API error:", data);

    let errorMessage = "Transfer API rejected the request.";
    if (typeof data?.message === "string") errorMessage = data.message;
    else if (typeof data?.error === "string") errorMessage = data.error;
    else if (data?.message || data?.error) {
      errorMessage = JSON.stringify(data.message || data.error);
    } else if (!response.ok) {
      errorMessage = `Transfer failed (HTTP ${response.status})`;
    }

    throw new Error(errorMessage);
  }

  try {
    const transactionBytes = base64ToUint8Array(data.transaction);
    let transaction: VersionedTransaction | Transaction;
    try {
      transaction = VersionedTransaction.deserialize(transactionBytes);
    } catch {
      transaction = Transaction.from(transactionBytes);
    }
    return {
      transaction,
      blockhash: typeof data.blockhash === "string" ? data.blockhash : "",
      lastValidBlockHeight: Number(data.lastValidBlockHeight),
      rpcUrl: typeof data.rpcUrl === "string" ? data.rpcUrl : undefined,
      mode: "private",
    };
  } catch (err) {
    console.error("Failed to deserialize transaction:", err, data);
    throw new Error("Invalid transaction payload from transfer API.");
  }
}

export async function buildWithdraw(
  merchantPubkey: string,
  destination: string,
  amount: number
): Promise<VersionedTransaction> {
  const response = await fetchWithTimeout(
    `${PAYMENTS_API}/withdraw`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: merchantPubkey,
        destination,
        amount: Math.floor(amount * 1_000_000),
        mint: USDC_MINT.toBase58(),
      }),
    },
    20000
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.transaction || typeof data.transaction !== "string") {
    console.error("Withdraw API error:", data);

    let errorMessage = "Withdraw request was rejected.";
    if (typeof data?.message === "string") errorMessage = data.message;
    else if (typeof data?.error === "string") errorMessage = data.error;
    else if (data?.message || data?.error) {
      errorMessage = JSON.stringify(data.message || data.error);
    }

    throw new Error(errorMessage);
  }

  try {
    return VersionedTransaction.deserialize(
      base64ToUint8Array(data.transaction)
    );
  } catch (err) {
    console.error("Failed to deserialize withdraw transaction:", err, data);
    throw new Error("Invalid withdrawal transaction payload.");
  }
}