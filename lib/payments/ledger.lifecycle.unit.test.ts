import { describe, expect, it } from "vitest";
import {
  assertPaymentStatusTransition,
  canTransitionPaymentStatus,
  normalizeIdempotencyKey,
  paymentEventName,
} from "./ledger";

describe("payment ledger lifecycle", () => {
  it.each([
    ["created", "pending_signature"],
    ["created", "submitted"],
    ["pending_signature", "submitted"],
    ["submitted", "confirmed"],
    ["submitted", "failed"],
    ["submitted", "expired"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionPaymentStatus(from, to)).toBe(true);
    expect(() => assertPaymentStatusTransition(from, to)).not.toThrow();
  });

  it.each([
    ["confirmed", "submitted"],
    ["confirmed", "failed"],
    ["failed", "confirmed"],
    ["expired", "submitted"],
  ] as const)("rejects terminal rewrite %s -> %s", (from, to) => {
    expect(canTransitionPaymentStatus(from, to)).toBe(false);
    expect(() => assertPaymentStatusTransition(from, to)).toThrow(`Invalid payment status transition: ${from} -> ${to}`);
  });

  it("allows an idempotent same-status update", () => {
    expect(canTransitionPaymentStatus("confirmed", "confirmed")).toBe(true);
    expect(paymentEventName("confirmed")).toBe("payment.confirmed");
  });

  it("rejects malformed or oversized idempotency keys without coercing input", () => {
    expect(normalizeIdempotencyKey(null)).toBeNull();
    expect(normalizeIdempotencyKey(123)).toBeNull();
    expect(normalizeIdempotencyKey("   ")).toBeNull();
    expect(normalizeIdempotencyKey("x".repeat(256))).toBeNull();
    expect(normalizeIdempotencyKey("  checkout-42  ")).toBe("checkout-42");
  });
});
