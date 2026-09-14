import { describe, expect, it } from "vitest";
import { UserRejectedError, sendPayment, sendStandardPayment } from "./sendPayment";
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

  it("confirms standard payments with the blockhash used for signing", async () => {
    const payer = Keypair.generate();
    const builtBlockhash = Keypair.generate().publicKey.toBase58();
    const freshBlockhash = Keypair.generate().publicKey.toBase58();
    const unsigned = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: builtBlockhash,
        instructions: [],
      }).compileToV0Message(),
    );
    let signedBlockhash = "";
    let confirmed: any = null;
    const connection = {
      getLatestBlockhash: async () => ({ blockhash: freshBlockhash, lastValidBlockHeight: 250 }),
      sendRawTransaction: async () => "standard-signature",
      confirmTransaction: async (strategy: any) => {
        confirmed = strategy;
        return { value: { err: null } };
      },
    } as any;

    const signature = await sendStandardPayment(connection, unsigned, async (transaction) => {
      signedBlockhash = transaction.message.recentBlockhash;
      transaction.sign([payer]);
      return transaction;
    });

    expect(signature).toBe("standard-signature");
    expect(signedBlockhash).toBe(freshBlockhash);
    expect(confirmed).toMatchObject({
      signature: "standard-signature",
      blockhash: freshBlockhash,
      lastValidBlockHeight: 250,
    });
  });
});