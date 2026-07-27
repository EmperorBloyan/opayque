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
