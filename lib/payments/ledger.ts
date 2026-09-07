import type { PaymentStatus } from "@/lib/types";
import crypto from "node:crypto";

const transitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["pending_signature", "submitted", "failed", "expired"],
  pending_signature: ["submitted", "failed", "expired"],
  submitted: ["confirmed", "failed", "expired"],
  confirmed: [],
  failed: [],
  expired: [],
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertPaymentStatusTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error(`Invalid payment status transition: ${from} -> ${to}`);
  }
}

export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key && key.length <= 255 ? key : null;
}

export function buildPaymentRequestFingerprint(input: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function parseAmountToBaseUnits(value: unknown, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const text = typeof value === "number" && Number.isFinite(value) ? value.toString() : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;
  const baseUnits = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, "0") || "0");
  return baseUnits > 0n ? baseUnits : null;
}

export function paymentEventName(status: PaymentStatus): string {
  return `payment.${status}`;
}