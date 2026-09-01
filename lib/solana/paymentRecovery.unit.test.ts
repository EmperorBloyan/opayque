import { describe, expect, it } from "vitest";
import { clearPendingPayment, readPendingPayment, writePendingPayment } from "./paymentRecovery";

describe("payment recovery state", () => {
  it("is safe to call during server-side rendering", () => {
    expect(readPendingPayment()).toBeNull();
    expect(() => writePendingPayment({
      intentId: "intent-1",
      sender: "sender",
      recipient: "recipient",
      amount: 2,
      phase: "submitted",
      startedAt: Date.now(),
    })).not.toThrow();
    expect(() => clearPendingPayment("intent-1")).not.toThrow();
  });
});