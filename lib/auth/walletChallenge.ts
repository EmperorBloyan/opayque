import { randomBytes } from "node:crypto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface WalletChallenge {
  merchantId: string;
  newWalletAddress: string;
  purpose: "settlement" | "refund";
  message: string;
  nonce: string;
  expiresAt: string;
}

const challenges = new Map<string, WalletChallenge>();

function removeExpiredChallenges(now = Date.now()) {
  for (const [nonce, challenge] of challenges) {
    if (new Date(challenge.expiresAt).getTime() <= now) {
      challenges.delete(nonce);
    }
  }
}

export function createWalletChallenge(input: {
  merchantId: string;
  newWalletAddress: string;
  purpose?: "settlement" | "refund";
}): WalletChallenge {
  removeExpiredChallenges();

  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const purpose = input.purpose ?? "settlement";
  const message = [
    purpose === "refund" ? "Opayque Refund Wallet Update" : "Opayque Settlement Wallet Update",
    `Merchant: ${input.merchantId}`,
    `New Address: ${input.newWalletAddress}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join("\n");

  const challenge = {
    merchantId: input.merchantId,
    newWalletAddress: input.newWalletAddress,
    purpose,
    message,
    nonce,
    expiresAt,
  };
  challenges.set(nonce, challenge);
  return challenge;
}

export function consumeWalletChallenge(nonce: string): WalletChallenge | null {
  removeExpiredChallenges();
  const challenge = challenges.get(nonce) ?? null;
  if (challenge) challenges.delete(nonce);
  return challenge;
}

export function getWalletChallenge(nonce: string): WalletChallenge | null {
  removeExpiredChallenges();
  return challenges.get(nonce) ?? null;
}
