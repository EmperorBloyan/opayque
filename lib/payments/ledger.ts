import type { PaymentStatus } from "@/lib/types";

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

export function paymentEventName(status: PaymentStatus): string {
  return `payment.${status}`;
}