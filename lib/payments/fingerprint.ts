import crypto from "node:crypto";

export function buildPaymentRequestFingerprint(input: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
