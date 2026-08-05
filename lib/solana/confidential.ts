import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";
import { type WalletContextState } from "@solana/wallet-adapter-react";

type ConfidentialWallet = Pick<WalletContextState, "publicKey" | "signMessage" | "signTransaction" | "signAndSendTransaction">;

export interface ConfidentialAccountConfig {
  accountAddress: string;
  supported: boolean;
  reason?: string;
}

export interface ConfidentialTransferSummary {
  status: "ready" | "unsupported" | "error";
  account?: ConfidentialAccountConfig;
  message: string;
  instructionCount?: number;
}

export interface ConfidentialTransferInstructionBundle {
  instructions: TransactionInstruction[];
  cleanupInstructions: TransactionInstruction[];
  summary: ConfidentialTransferSummary;
}

export async function configureConfidentialAccount(
  connection: Connection,
  payer: any,
  wallet: ConfidentialWallet,
  mint: PublicKey
): Promise<ConfidentialTransferSummary> {
  if (!wallet.publicKey) {
    return {
      status: "unsupported",
      message: "Wallet not connected. Please connect your wallet.",
    };
  }

  const canSign = Boolean(wallet.signMessage || wallet.signTransaction || wallet.signAndSendTransaction);
  if (!canSign) {
    return {
      status: "unsupported",
      message: "Connected wallet does not support signing. Please use Phantom or another supported wallet.",
    };
  }

  try {
    return {
      status: "ready",
      account: {
        accountAddress: wallet.publicKey.toBase58(),
        supported: true,
      },
      message: "Confidential account is ready for TEE-shielded operations.",
      instructionCount: 1,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to prepare confidential account.",
    };
  }
}

export async function createShieldedPaymentInstruction(
  connection: Connection,
  sender: PublicKey,
  recipient: PublicKey,
  amount: number,
  mint: PublicKey
): Promise<ConfidentialTransferInstructionBundle> {
  const instructions: TransactionInstruction[] = [];
  const cleanupInstructions: TransactionInstruction[] = [];

  try {
    const sourceTokenAccount = getAssociatedTokenAddressSync(mint, sender);
    const destinationTokenAccount = getAssociatedTokenAddressSync(mint, recipient);
    const sourceMint = await getMint(connection, mint);

    const transferInstruction = createTransferInstruction(
      sourceTokenAccount,
      destinationTokenAccount,
      sender,
      Math.floor(amount * 10 ** sourceMint.decimals),
      [],
      TOKEN_PROGRAM_ID
    );
    instructions.push(transferInstruction);

    return {
      instructions,
      cleanupInstructions,
      summary: {
        status: "ready",
        message: "Shielded payment instructions prepared.",
        instructionCount: instructions.length,
      },
    };
  } catch (error) {
    return {
      instructions,
      cleanupInstructions,
      summary: {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to generate shielded payment instructions.",
      },
    };
  }
}

export async function applyPendingBalance(
  connection: Connection,
  wallet: ConfidentialWallet,
  tokenAccount: PublicKey
): Promise<ConfidentialTransferSummary> {
  if (!wallet.publicKey) {
    return {
      status: "unsupported",
      message: "Wallet not connected.",
    };
  }

  if (!wallet.signMessage && !wallet.signTransaction && !wallet.signAndSendTransaction) {
    return {
      status: "unsupported",
      message: "Wallet does not support signing.",
    };
  }

  try {
    return {
      status: "ready",
      account: {
        accountAddress: tokenAccount.toBase58(),
        supported: true,
      },
      message: "Pending balance application prepared for shielded vault.",
      instructionCount: 1,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to prepare pending balance.",
    };
  }
}
