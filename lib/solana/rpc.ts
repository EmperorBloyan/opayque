import { Connection } from "@solana/web3.js";

export interface RpcHealthState {
  isOnline: boolean;
  rpcLatency: number | null;
  retrying: boolean;
  attempts: number;
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
  timeoutMs = 60_000,
  pollIntervalMs = 1500
) {
  const start = Date.now();
  const latest = await connection.getLatestBlockhash('finalized');
  const lastValidBlockHeight = latest.lastValidBlockHeight;

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

    const currentBlockHeight = await connection.getBlockHeight();
    if (currentBlockHeight > lastValidBlockHeight) {
      throw new Error('Transaction expired before confirmation. Please retry.');
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Transaction confirmation timed out after 60 seconds.');
}
