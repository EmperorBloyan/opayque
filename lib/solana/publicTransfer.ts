import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

const USDC_DECIMALS = 6;

export async function buildPublicUsdcTransfer({
  sender,
  recipient,
  mint,
  amountBaseUnits,
  rpcUrl,
}: {
  sender: string;
  recipient: string;
  mint: string;
  amountBaseUnits: number;
  rpcUrl: string;
}): Promise<{
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
  rpcUrl: string;
  mode: "public";
}> {
  const connection = new Connection(rpcUrl, "confirmed");
  const senderKey = new PublicKey(sender);
  const recipientKey = new PublicKey(recipient);
  const mintKey = new PublicKey(mint);
  const senderTokenAccount = await getAssociatedTokenAddress(mintKey, senderKey);
  const recipientTokenAccount = await getAssociatedTokenAddress(mintKey, recipientKey);
  const instructions = [];

  try {
    await getAccount(connection, recipientTokenAccount, "confirmed", TOKEN_PROGRAM_ID);
  } catch {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        senderKey,
        recipientTokenAccount,
        recipientKey,
        mintKey,
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  instructions.push(
    createTransferCheckedInstruction(
      senderTokenAccount,
      mintKey,
      recipientTokenAccount,
      senderKey,
      BigInt(amountBaseUnits),
      USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: senderKey,
    recentBlockhash: latest.blockhash,
  }).add(...instructions);
  const versioned = new VersionedTransaction(
    transaction.compileMessage(),
  );

  return {
    transaction: Buffer.from(versioned.serialize()).toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    rpcUrl,
    mode: "public",
  };
}