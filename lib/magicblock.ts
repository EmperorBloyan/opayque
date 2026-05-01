import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import IDL_JSON from "./idl/opayque.json";

// 2026 Beta Endpoints
const PER_RPC = "https://rpc.magicblock.app/v1/per";
const PAYMENTS_GATEWAY = "https://payments.magicblock.app/v1";

// ✅ Real program ID from your Anchor build
export const PROGRAM_ID = new PublicKey("5k1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmgp");

export const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export function getOpayqueProgram(provider: AnchorProvider) {
  return new Program(IDL_JSON as Idl, PROGRAM_ID, provider);
}

/**
 * 1. getPrivateBalance
 * Fetches the shielded (private) balance from the MagicBlock TEE.
 */
export async function getPrivateBalance(merchantPubkey: string): Promise<number> {
  try {
    const response = await fetch(`${PER_RPC}/get-private-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        address: merchantPubkey,
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC Devnet
      }),
    });
    const data = await response.json();
    return data.shieldedAmount || 0;
  } catch (error) {
    console.error("TEE Query Error:", error);
    return 0;
  }
}

/**
 * 2. buildShieldedTransfer
 * Initiates a confidential transfer through the Private Payments API.
 * Used on the /checkout page.
 */
export async function buildShieldedTransfer(
  sender: string,
  merchant: string,
  amount: number
) {
  try {
    const response = await fetch(`${PAYMENTS_GATEWAY}/create-transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        recipient: merchant,
        amount,
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        isConfidential: true, // Triggers TEE-shielding
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Shielded transfer failed");
    return data;
  } catch (error) {
    console.error("Payment API Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown transfer error" };
  }
}

/**
 * 3. buildWithdraw
 * Withdraws funds from Private TEE balance back to the public wallet.
 * Used on the /merchant dashboard.
 */
export async function buildWithdraw(
  owner: string,
  amount: number
) {
  try {
    const response = await fetch(`${PAYMENTS_GATEWAY}/spl/withdraw`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Idempotency-Key": `withdraw_${owner}_${Date.now()}`
      },
      body: JSON.stringify({
        owner,
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Withdrawal failed");
    return data;
  } catch (error) {
    console.error("Withdrawal API Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown withdrawal error" };
  }
}
