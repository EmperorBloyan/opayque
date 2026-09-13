import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getSolanaNetwork } from "./constants";
import { logLifecycle } from "../observability";

export class UserRejectedError extends Error { constructor() { super("Wallet approval was rejected"); this.name = "UserRejectedError"; } }
export class BlockhashExpiredError extends Error { constructor() { super("Transaction blockhash expired"); this.name = "BlockhashExpiredError"; } }
export class PaymentTimeoutError extends Error { constructor(message = "Transaction confirmation timed out") { super(message); this.name = "PaymentTimeoutError"; } }
export class PaymentRpcError extends Error { constructor(message: string) { super(message); this.name = "PaymentRpcError"; } }

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PaymentTimeoutError(`${label} timed out`)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function isWalletRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rejected|denied|declined|user cancel|user denied/i.test(message);
}

async function waitForSignature(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = (await withTimeout(
      connection.getSignatureStatuses([signature]),
      10_000,
      "Transaction status request",
    )).value[0];
    if (status?.err) throw new PaymentRpcError(JSON.stringify(status.err));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (await withTimeout(connection.getBlockHeight("confirmed"), 10_000, "Block height request") > lastValidBlockHeight) {
      throw new BlockhashExpiredError();
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new PaymentTimeoutError();
}

export async function sendPayment(
  connection: Connection,
  unsigned: VersionedTransaction,
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>,
  timeoutMs = 90_000,
  onStage?: (stage: "approving" | "submitting" | "confirming") => void,
): Promise<string> {
  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const validity = await withTimeout(connection.getLatestBlockhash("confirmed"), 10_000, "Blockhash request");
    const transaction = VersionedTransaction.deserialize(unsigned.serialize());
    transaction.message.recentBlockhash = validity.blockhash;

    let signed: VersionedTransaction;
    try {
      onStage?.("approving");
      logLifecycle("info", "wallet_payment", "approving", getSolanaNetwork());
      signed = await withTimeout(signTransaction(transaction), 120_000, "Wallet approval");
    } catch (error) {
      if (isWalletRejection(error)) throw new UserRejectedError();
      if (error instanceof PaymentTimeoutError) throw error;
      throw new PaymentRpcError(error instanceof Error ? error.message : String(error));
    }

    let signature: string;
    try {
      const simulation: any = await withTimeout(
        connection.simulateTransaction(signed, { sigVerify: false }),
        15_000,
        "Transaction simulation"
      );
      if (simulation.value.err) {
        const details = simulation.value.logs?.slice(-3).join("; ") || JSON.stringify(simulation.value.err);
        if (/insufficient|lamports|funds|balance/i.test(details)) throw new PaymentRpcError(`Insufficient funds: ${details}`);
        throw new PaymentRpcError(`Simulation failed: ${details}`);
      }
      signature = await withTimeout(connection.sendRawTransaction(signed.serialize(), {
          preflightCommitment: "confirmed",
          maxRetries: 3,
        }), 20_000, "Transaction submission");
      onStage?.("submitting");
      logLifecycle("info", "wallet_payment", "submitting", getSolanaNetwork());
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (/blockhash|expired|last valid block/i.test(message)) {
        if (attempt < maxAttempts - 1) continue;
        throw new BlockhashExpiredError();
      }
      if (error instanceof PaymentTimeoutError) throw error;
      throw new PaymentRpcError(message);
    }

    try {
      onStage?.("confirming");
      logLifecycle("info", "wallet_payment", "confirming", getSolanaNetwork());
      await waitForSignature(connection, signature, validity.lastValidBlockHeight, timeoutMs);
      return signature;
    } catch (error) {
      lastError = error;
      if (error instanceof BlockhashExpiredError && attempt < maxAttempts - 1) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new BlockhashExpiredError();
}

export async function sendLegacyPayment(
  connection: Connection,
  unsigned: Transaction,
  signTransaction: (transaction: Transaction) => Promise<Transaction>,
  timeoutMs = 90_000,
  onStage?: (stage: "approving" | "submitting" | "confirming") => void,
): Promise<string> {
  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const validity = await withTimeout(connection.getLatestBlockhash("confirmed"), 10_000, "Blockhash request");
    const transaction = Transaction.from(unsigned.serialize({ requireAllSignatures: false, verifySignatures: false }));
    transaction.recentBlockhash = validity.blockhash;
    transaction.lastValidBlockHeight = validity.lastValidBlockHeight;

    try {
      onStage?.("approving");
      const signed = await withTimeout(signTransaction(transaction), 120_000, "Wallet approval");
      const simulation: any = await withTimeout(
        (connection.simulateTransaction as any)(signed, { sigVerify: false }),
        15_000,
        "Transaction simulation",
      );
      if (simulation.value.err) {
        throw new PaymentRpcError(simulation.value.logs?.slice(-3).join("; ") || JSON.stringify(simulation.value.err));
      }
      onStage?.("submitting");
      const signature = await withTimeout(connection.sendRawTransaction(signed.serialize(), {
        preflightCommitment: "confirmed",
        maxRetries: 3,
      }), 20_000, "Transaction submission");
      onStage?.("confirming");
      await waitForSignature(connection, signature, validity.lastValidBlockHeight, timeoutMs);
      return signature;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (isWalletRejection(error)) throw new UserRejectedError();
      if (error instanceof BlockhashExpiredError || /blockhash|expired|last valid block/i.test(message)) {
        if (attempt < maxAttempts - 1) continue;
        throw new BlockhashExpiredError();
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new BlockhashExpiredError();
}