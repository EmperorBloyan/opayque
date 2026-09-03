import { describe, expect, it } from "vitest";
import { assertPaymentStatusTransition, canTransitionPaymentStatus, normalizeIdempotencyKey } from "./ledger";

describe("payment ledger invariants", () => {
  it("allows forward payment transitions and rejects terminal rewrites", () => {
    expect(canTransitionPaymentStatus("created", "pending_signature")).toBe(true);
    expect(canTransitionPaymentStatus("submitted", "confirmed")).toBe(true);
    expect(canTransitionPaymentStatus("confirmed", "failed")).toBe(false);
    expect(() => assertPaymentStatusTransition("expired", "submitted")).toThrow();
  });

  it("normalizes bounded idempotency keys", () => {
    expect(normalizeIdempotencyKey("  retry-1 ")).toBe("retry-1");
    expect(normalizeIdempotencyKey(" ")).toBeNull();
    expect(normalizeIdempotencyKey("x".repeat(256))).toBeNull();
  });
});
