import { Connection, VersionedTransaction } from "@solana/web3.js";

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

export async function sendPayment(
  connection: Connection,
  unsigned: VersionedTransaction,
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>,
  timeoutMs = 90_000,
  onStage?: (stage: "approving" | "submitting" | "confirming") => void,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const validity = await withTimeout(connection.getLatestBlockhash("confirmed"), 10_000, "Blockhash request");
    const transaction = VersionedTransaction.deserialize(unsigned.serialize());
    transaction.message.recentBlockhash = validity.blockhash;

    let signed: VersionedTransaction;
    try {
      onStage?.("approving");
      console.info(JSON.stringify({ event: "wallet_payment", stage: "approving" }));
      signed = await withTimeout(signTransaction(transaction), 120_000, "Wallet approval");
    } catch (error) {
      if (isWalletRejection(error)) throw new UserRejectedError();
      if (error instanceof PaymentTimeoutError) throw error;
      throw new PaymentRpcError(error instanceof Error ? error.message : String(error));
    }

    let signature: string;
    try {
      const simulation = await withTimeout(
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
          maxRetries: 0,
        }), 20_000, "Transaction submission");
      onStage?.("submitting");
      console.info(JSON.stringify({ event: "wallet_payment", stage: "submitting" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/blockhash|expired|last valid block/i.test(message) && attempt === 0) continue;
      if (error instanceof PaymentTimeoutError) throw error;
      throw new PaymentRpcError(message);
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = (await withTimeout(
        connection.getSignatureStatuses([signature]),
        10_000,
        "Transaction status request"
      )).value[0];
      onStage?.("confirming");
      console.info(JSON.stringify({ event: "wallet_payment", stage: "confirming" }));
      if (status?.err) throw new PaymentRpcError(JSON.stringify(status.err));
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
      if (await withTimeout(connection.getBlockHeight("confirmed"), 10_000, "Block height request") > validity.lastValidBlockHeight) {
        if (attempt === 0) break;
        throw new BlockhashExpiredError();
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (attempt === 1) throw new PaymentTimeoutError();
  }
  throw new BlockhashExpiredError();
}