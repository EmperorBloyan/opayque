import { Connection, VersionedTransaction } from "@solana/web3.js";
import { getSolanaNetwork, getSolanaRpcUrls } from "./constants";
import { logLifecycle } from "../observability";

export interface RpcHealthState {
  isOnline: boolean;
  rpcLatency: number | null;
  retrying: boolean;
  attempts: number;
}

export interface RpcProbeResult {
  url: string;
  ok: boolean;
  latencyMs: number | null;
  slot: number | null;
  error?: string;
}

const unhealthyUntil = new Map<string, number>();
let rpcFailureLoggedUntil = 0;

export async function probeRpc(url: string, timeoutMs = 5_000): Promise<RpcProbeResult> {
  const startedAt = Date.now();
  try {
    const connection = new Connection(url, "confirmed");
    const slot = await Promise.race([
      connection.getSlot("confirmed"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC probe timed out")), timeoutMs)),
    ]);
    unhealthyUntil.delete(url);
    return { url, ok: true, latencyMs: Date.now() - startedAt, slot };
  } catch (error) {
    unhealthyUntil.set(url, Date.now() + 30_000);
    return { url, ok: false, latencyMs: null, slot: null, error: error instanceof Error ? error.message : "RPC probe failed" };
  }
}

export async function probeSolanaRpcs(urls = getSolanaRpcUrls()): Promise<RpcProbeResult[]> {
  return Promise.all([...new Set(urls)].map((url) => probeRpc(url)));
}

export async function selectHealthyRpcUrl(urls = getSolanaRpcUrls()): Promise<string> {
  const candidates = [...new Set(urls)].filter((url) => (unhealthyUntil.get(url) ?? 0) <= Date.now());
  const results = await probeSolanaRpcs(candidates.length > 0 ? candidates : urls);
  const healthy = results.filter((result) => result.ok).sort((left, right) => (left.latencyMs ?? Infinity) - (right.latencyMs ?? Infinity));
  if (healthy[0]) return healthy[0].url;
  if (Date.now() >= rpcFailureLoggedUntil) {
    rpcFailureLoggedUntil = Date.now() + 30_000;
    logLifecycle("error", "solana_rpc", "selection_failed", getSolanaNetwork(), "AllRpcEndpointsUnhealthy");
  }
  throw new Error("No healthy Solana RPC endpoint is available");
}

export interface RetryableRpcRequestOptions<T> {
  connection: Connection;
  operation: (connection: Connection) => Promise<T>;
  retries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withExponentialBackoff<T>({
  connection,
  operation,
  retries = 3,
  baseDelayMs = 500,
  onRetry,
}: RetryableRpcRequestOptions<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await operation(connection);
    } catch (error) {
      lastError = error;
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : null;
      const isRetriable = statusCode === 429 || statusCode === 408 || (error instanceof Error && /timeout|network|fetch/i.test(error.message));

      if (!isRetriable || attempt === retries) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt;
      onRetry?.(attempt + 1, error);
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError;
}

export async function withRpcRetry<T>(options: RetryableRpcRequestOptions<T>): Promise<T> {
  return withExponentialBackoff(options);
}

export async function getRpcHealth(connection: Connection): Promise<RpcHealthState> {
  const startedAt = Date.now();

  try {
    await withRpcRetry({
      connection,
      operation: async (conn) => {
        await conn.getSlot();
      },
      retries: 2,
      baseDelayMs: 250,
    });

    return {
      isOnline: true,
      rpcLatency: Date.now() - startedAt,
      retrying: false,
      attempts: 1,
    };
  } catch {
    return {
      isOnline: false,
      rpcLatency: null,
      retrying: false,
      attempts: 0,
    };
  }
}

export async function waitForSignatureConfirmation(
  connection: Connection,
  signature: string,
  validity?: { blockhash: string; lastValidBlockHeight: number },
  timeoutMs = 60_000,
  pollIntervalMs = 1500
) {
  const start = Date.now();
  const lastValidBlockHeight = validity?.lastValidBlockHeight;

  while (Date.now() - start < timeoutMs) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statuses?.value?.[0];

    if (status) {
      if (status.err) {
        const errorDetails = typeof status.err === 'object' ? JSON.stringify(status.err) : String(status.err);
        throw new Error(`Transaction failed: ${errorDetails}`);
      }

      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        return status;
      }
    }

    const currentBlockHeight = await connection.getBlockHeight('confirmed');
    if (lastValidBlockHeight !== undefined && currentBlockHeight > lastValidBlockHeight) {
      throw new Error('Transaction expired before confirmation. Please retry.');
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Transaction confirmation timed out after 60 seconds.');
}

export interface PaymentTransactionValidity {
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface PaymentSendResult {
  signature: string;
  validity: PaymentTransactionValidity;
}

function isBlockhashError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /blockhash|expired|last valid block height|transaction expiration/i.test(message);
}

export async function sendAndConfirmPayment(
  connection: Connection,
  unsignedTransaction: VersionedTransaction,
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>,
  onStage?: (stage: "approving" | "submitting" | "confirming") => void,
  maxAttempts = 3,
  sendTransaction?: (transaction: VersionedTransaction, connection: Connection) => Promise<string>
): Promise<PaymentSendResult> {
  const serializedUnsigned = unsignedTransaction.serialize();
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const validity = await connection.getLatestBlockhash("confirmed");
    const transaction = VersionedTransaction.deserialize(serializedUnsigned);
    transaction.message.recentBlockhash = validity.blockhash;

    try {
      onStage?.("approving");
      const signature = sendTransaction
        ? await sendTransaction(transaction, connection)
        : await connection.sendRawTransaction((await signTransaction(transaction)).serialize(), {
            preflightCommitment: "confirmed",
            maxRetries: 0,
          });
      onStage?.("submitting");
      onStage?.("confirming");
      await waitForSignatureConfirmation(connection, signature, validity, 90_000);
      return { signature, validity };
    } catch (error) {
      lastError = error;
      if (!isBlockhashError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Payment failed. Please retry.");
}
