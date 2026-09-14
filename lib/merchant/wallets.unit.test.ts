import { describe, expect, it } from "vitest";
import { resolveRefundWallet, resolveSettlementWallet } from "./wallets";

describe("merchant wallet resolution", () => {
  it("prefers the explicit settlement wallet", () => {
    expect(resolveSettlementWallet({ settlement_wallet_address: "  settle  ", wallet_address: "legacy" })).toEqual({ address: "settle", source: "settlement" });
  });

  it("uses the legacy wallet only as a migration fallback", () => {
    expect(resolveSettlementWallet({ wallet_address: " legacy " })).toEqual({ address: "legacy", source: "legacy" });
  });

  it("does not invent a wallet", () => {
    expect(resolveSettlementWallet({})).toEqual({ address: "", source: "missing" });
  });

  it("prefers a dedicated refund wallet and otherwise falls back to settlement", () => {
    expect(resolveRefundWallet({ refund_wallet_address: "refund", settlement_wallet_address: "settle" })).toEqual({ address: "refund", source: "refund" });
    expect(resolveRefundWallet({ settlement_wallet_address: "settle" })).toEqual({ address: "settle", source: "settlement" });
  });
});
