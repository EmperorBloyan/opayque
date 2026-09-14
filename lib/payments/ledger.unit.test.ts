import { describe, expect, it } from "vitest";
import { assertPaymentStatusTransition, canTransitionPaymentStatus, normalizeIdempotencyKey } from "./ledger";
import { parseAmountToBaseUnits } from "./amount";
import { buildPaymentRequestFingerprint } from "./fingerprint";

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

  it("parses exact base-unit amounts without floating-point rounding", () => {
    expect(parseAmountToBaseUnits("0.000001", 6)).toBe(1n);
    expect(parseAmountToBaseUnits("1000000.123456", 6)).toBe(1000000123456n);
    expect(parseAmountToBaseUnits("1.0000001", 6)).toBeNull();
    expect(parseAmountToBaseUnits("-1", 6)).toBeNull();
    expect(parseAmountToBaseUnits("1e-6", 6)).toBeNull();
    expect(parseAmountToBaseUnits(0, 6)).toBeNull();
  });

  it("fingerprints equivalent request objects deterministically", () => {
    expect(buildPaymentRequestFingerprint({ amount: "1.00", currency: "USDC" })).toBe(
      buildPaymentRequestFingerprint({ amount: "1.00", currency: "USDC" }),
    );
    expect(buildPaymentRequestFingerprint({ amount: "1.00", currency: "USDC" })).not.toBe(
      buildPaymentRequestFingerprint({ amount: "2.00", currency: "USDC" }),
    );
  });
});
