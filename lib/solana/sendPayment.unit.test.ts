import { describe, expect, it } from "vitest";
import { UserRejectedError, sendPayment } from "./sendPayment";
import { Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

describe("sendPayment", () => {
  it("maps wallet rejection to a typed error", async () => {
    const connection = { getLatestBlockhash: async () => ({ blockhash: "x", lastValidBlockHeight: 1 }) } as any;
    const payer = Keypair.generate().publicKey;
    const message = new TransactionMessage({ payerKey: payer, recentBlockhash: payer.toBase58(), instructions: [] }).compileToV0Message();
    const unsigned = new VersionedTransaction(message);
    await expect(sendPayment(connection, unsigned, async () => { throw new Error("User rejected"); })).rejects.toBeInstanceOf(UserRejectedError);
  });
});