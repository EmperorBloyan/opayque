import { afterEach, describe, expect, it } from "vitest";
import { clearPendingPayment, readPendingPayment, writePendingPayment } from "./paymentRecovery";

describe("payment recovery state", () => {
  afterEach(() => window.localStorage.clear());

  it("round-trips pending state and clears only the matching intent", () => {
    const payment = {
      intentId: "intent-1",
      sender: "sender",
      recipient: "recipient",
      amount: 2,
      phase: "submitted" as const,
      signature: "signature",
      startedAt: Date.now(),
    };
    writePendingPayment(payment);
    expect(readPendingPayment()).toEqual(payment);
    clearPendingPayment("other-intent");
    expect(readPendingPayment()).toEqual(payment);
    clearPendingPayment("intent-1");
    expect(readPendingPayment()).toBeNull();
  });
});