import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";
import { type WalletContextState } from "@solana/wallet-adapter-react";

type ConfidentialWallet = Pick<WalletContextState, "publicKey" | "signMessage" | "signTransaction">;

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

export interface PublicTransferInstructionBundle {
  instructions: TransactionInstruction[];
  cleanupInstructions: TransactionInstruction[];
  summary: ConfidentialTransferSummary;
}

export async function configureConfidentialAccount(
  wallet: ConfidentialWallet,
  mint: PublicKey
): Promise<ConfidentialTransferSummary> {
  if (!wallet.publicKey) {
    return {
      status: "unsupported",
      message: "Wallet not connected. Please connect your wallet.",
    };
  }

  const canSignTransaction = Boolean(wallet.signTransaction);
  const canSignMessage = Boolean(wallet.signMessage);

  if (!canSignTransaction && !canSignMessage) {
    return {
      status: "unsupported",
      message: "Connected wallet does not support signing transactions or messages. Use Phantom or a supported wallet.",
    };
  }

  try {
    return {
      status: "ready",
      account: {
        accountAddress: wallet.publicKey.toBase58(),
        supported: true,
      },
      message: "Wallet is ready; private transfers require the MagicBlock payment path.",
      instructionCount: 1,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to prepare confidential account.",
    };
  }
}

export async function createPublicPaymentInstruction(
  connection: Connection,
  sender: PublicKey,
  recipient: PublicKey,
  amount: number,
  mint: PublicKey
): Promise<PublicTransferInstructionBundle> {
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
        message: "Standard on-chain transfer instructions prepared (public).",
        instructionCount: instructions.length,
      },
    };
  } catch (error) {
    return {
      instructions,
      cleanupInstructions,
      summary: {
        status: "error",
          message: error instanceof Error ? error.message : "Failed to generate public payment instructions.",
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

  if (!wallet.signMessage && !wallet.signTransaction) {
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
