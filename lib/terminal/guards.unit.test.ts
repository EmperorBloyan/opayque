import { describe, expect, it } from "vitest";
import { assertTerminalReady, isRealMerchantId, resolveTerminalContext } from "./guards";

const merchantId = "550e8400-e29b-41d4-a716-446655440000";

describe("terminal readiness and ownership guards", () => {
  it("accepts UUID merchant IDs and rejects placeholders", () => {
    expect(isRealMerchantId(merchantId)).toBe(true);
    expect(isRealMerchantId("merchant-vault")).toBe(false);
    expect(isRealMerchantId("merchant-123")).toBe(false);
    expect(isRealMerchantId(null)).toBe(false);
  });

  it("prefers complete device credentials", () => {
    const context = resolveTerminalContext({
      device: { terminalId: "term-1", merchantId, deviceToken: "secret", merchantWallet: "wallet", pairedAt: Date.now() },
      session: { merchantId, walletAddress: "session-wallet" },
    });

    expect(context).toEqual({
      status: "ready",
      terminalId: "term-1",
      merchantId,
      deviceToken: "secret",
      merchantWallet: "wallet",
    });
    expect(() => assertTerminalReady(context)).not.toThrow();
  });

  it("fails closed for incomplete or invalid credentials", () => {
    const context = resolveTerminalContext({
      device: { terminalId: "term-1", merchantId, deviceToken: "", merchantWallet: "wallet", pairedAt: Date.now() },
      ownerMerchantId: merchantId,
    });

    expect(context).toEqual({ status: "unavailable", reason: "wallet" });
    expect(() => assertTerminalReady(context)).toThrow("Terminal is not ready for payments");
  });

  it("does not treat an owner merchant as payment-ready without a paired device", () => {
    expect(resolveTerminalContext({ ownerMerchantId: merchantId })).toEqual({ status: "unavailable", reason: "wallet" });
    expect(resolveTerminalContext({})).toEqual({ status: "unavailable", reason: "merchant" });
  });
});
