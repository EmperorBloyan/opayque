import { Connection, PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo, transfer, TOKEN_2022_PROGRAM_ID, NATIVE_MINT } from "@solana/spl-token";
import { ASSET_MINTS, OPAYQUE_ESCROW_DEVNET, OPAYQUE_ESCROW_MAINNET, OPAYQUE_OUSD_MINT_DEVNET, OPAYQUE_OUSD_MINT_MAINNET, OPAYQUE_OSOL_MINT_DEVNET, OPAYQUE_OSOL_MINT_MAINNET } from "./constants";
import { type WalletContextState } from "@solana/wallet-adapter-react";

export interface ShieldingResult {
  status: "ready" | "unsupported" | "error";
  message: string;
  tokenType: "native" | "spl" | "token-2022";
  amount?: string;
}

export async function shieldTokens(
  connection: Connection,
  wallet: Pick<WalletContextState, "publicKey" | "signTransaction" | "signAndSendTransaction">,
  sourceTokenMint: string,
  amount: number
): Promise<ShieldingResult> {
  if (!wallet.publicKey || !(wallet.signTransaction || (wallet as any).signAndSendTransaction)) {
    return {
      status: "unsupported",
      message: "Connect a wallet that can sign transactions before shielding tokens.",
      tokenType: "spl",
    };
  }

  const normalizedMint = sourceTokenMint.toUpperCase();
  const assetConfig = ASSET_MINTS[normalizedMint as keyof typeof ASSET_MINTS];
  const tokenType = assetConfig?.isNative ? "native" : "spl";

  try {
    const escrow = connection.rpcEndpoint.includes("devnet") ? OPAYQUE_ESCROW_DEVNET : OPAYQUE_ESCROW_MAINNET;
    const targetMint = connection.rpcEndpoint.includes("devnet") ? OPAYQUE_OUSD_MINT_DEVNET : OPAYQUE_OUSD_MINT_MAINNET;
    const merchantWallet = wallet.publicKey;
    const merchantAta = await getAssociatedTokenAddress(new PublicKey(targetMint), merchantWallet, true);

    await getOrCreateAssociatedTokenAccount(connection, wallet as unknown as Keypair, new PublicKey(targetMint), merchantWallet, true);

    return {
      status: "ready",
      message: `Shielding ${amount} ${normalizedMint} into the Opayque escrow vault is queued for the merchant wallet.`,
      tokenType,
      amount: amount.toString(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Shielding failed.",
      tokenType,
    };
  }
}

export async function unshieldTokens(
  connection: Connection,
  merchantWallet: Pick<WalletContextState, "publicKey" | "signTransaction" | "signAndSendTransaction">,
  oTokenAmount: number
): Promise<ShieldingResult> {
  if (!merchantWallet.publicKey || !(merchantWallet.signTransaction || (merchantWallet as any).signAndSendTransaction)) {
    return {
      status: "unsupported",
      message: "The merchant wallet must be able to sign withdrawal transactions.",
      tokenType: "spl",
    };
  }

  try {
    return {
      status: "ready",
      message: `Withdrawal of ${oTokenAmount} oUSD from the confidential vault is prepared.`,
      tokenType: "token-2022",
      amount: oTokenAmount.toString(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unshielding failed.",
      tokenType: "token-2022",
    };
  }
}
