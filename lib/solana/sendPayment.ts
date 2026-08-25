import { Connection, VersionedTransaction } from "@solana/web3.js";

export class UserRejectedError extends Error { constructor() { super("Wallet approval was rejected"); this.name = "UserRejectedError"; } }
export class BlockhashExpiredError extends Error { constructor() { super("Transaction blockhash expired"); this.name = "BlockhashExpiredError"; } }
export class PaymentTimeoutError extends Error { constructor() { super("Transaction confirmation timed out"); this.name = "PaymentTimeoutError"; } }
export class PaymentRpcError extends Error { constructor(message: string) { super(message); this.name = "PaymentRpcError"; } }

export async function sendPayment(
  connection: Connection,
  unsigned: VersionedTransaction,
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>,
  timeoutMs = 90_000,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const validity = await connection.getLatestBlockhash("confirmed");
    const transaction = VersionedTransaction.deserialize(unsigned.serialize());
    transaction.message.recentBlockhash = validity.blockhash;

    let signed: VersionedTransaction;
    try {
      signed = await signTransaction(transaction);
    } catch (error) {
      throw new UserRejectedError();
    }

    let signature: string;
    try {
      const simulation = await connection.simulateTransaction(signed, { sigVerify: false });
      if (simulation.value.err) {
        const details = simulation.value.logs?.slice(-3).join("; ") || JSON.stringify(simulation.value.err);
        if (/insufficient|lamports|funds|balance/i.test(details)) throw new PaymentRpcError(`Insufficient funds: ${details}`);
        throw new PaymentRpcError(`Simulation failed: ${details}`);
      }
      signature = await connection.sendRawTransaction(signed.serialize(), {
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/blockhash|expired|last valid block/i.test(message) && attempt === 0) continue;
      throw new PaymentRpcError(message);
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = (await connection.getSignatureStatuses([signature])).value[0];
      if (status?.err) throw new PaymentRpcError(JSON.stringify(status.err));
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
      if (await connection.getBlockHeight("confirmed") > validity.lastValidBlockHeight) {
        if (attempt === 0) break;
        throw new BlockhashExpiredError();
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (attempt === 1) throw new PaymentTimeoutError();
  }
  throw new BlockhashExpiredError();
}