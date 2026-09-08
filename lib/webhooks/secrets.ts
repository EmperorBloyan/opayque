import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const configured = process.env.WEBHOOK_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("WEBHOOK_ENCRYPTION_KEY is not configured");
  return crypto.createHash("sha256").update(configured).digest();
}

export function encryptWebhookSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptWebhookSecret(value: string): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted webhook secret");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}
