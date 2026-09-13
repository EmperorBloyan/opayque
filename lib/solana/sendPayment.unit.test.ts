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

  it("refreshes the blockhash and requests one replacement signature after expiry", async () => {
    const payer = Keypair.generate();
    const blockhashes = [
      Keypair.generate().publicKey.toBase58(),
      Keypair.generate().publicKey.toBase58(),
    ];
    const unsigned = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhashes[0],
        instructions: [],
      }).compileToV0Message(),
    );
    let blockhashRequest = 0;
    let signingRequest = 0;
    let submissionRequest = 0;
    const connection = {
      getLatestBlockhash: async () => ({
        blockhash: blockhashes[blockhashRequest++],
        lastValidBlockHeight: 100 + blockhashRequest,
      }),
      simulateTransaction: async () => ({ value: { err: null } }),
      sendRawTransaction: async () => {
        submissionRequest += 1;
        if (submissionRequest === 1) throw new Error("Blockhash not found");
        return "replacement-signature";
      },
      getSignatureStatuses: async () => ({ value: [{ confirmationStatus: "confirmed", err: null }] }),
    } as any;

    const signature = await sendPayment(connection, unsigned, async (transaction) => {
      signingRequest += 1;
      transaction.sign([payer]);
      return transaction;
    });

    expect(signature).toBe("replacement-signature");
    expect(signingRequest).toBe(2);
    expect(submissionRequest).toBe(2);
  });
});