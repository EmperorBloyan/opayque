export type MerchantWalletFields = {
  wallet_address?: string | null;
  settlement_wallet_address?: string | null;
  refund_wallet_address?: string | null;
};

function normalizeWallet(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSettlementWallet(merchant: MerchantWalletFields | null | undefined) {
  const settlementWallet = normalizeWallet(merchant?.settlement_wallet_address);
  if (settlementWallet) return { address: settlementWallet, source: "settlement" as const };

  const legacyWallet = normalizeWallet(merchant?.wallet_address);
  if (legacyWallet) return { address: legacyWallet, source: "legacy" as const };

  return { address: "", source: "missing" as const };
}

export function resolveRefundWallet(merchant: MerchantWalletFields | null | undefined) {
  const refundWallet = normalizeWallet(merchant?.refund_wallet_address);
  if (refundWallet) return { address: refundWallet, source: "refund" as const };

  const settlementWallet = normalizeWallet(merchant?.settlement_wallet_address);
  if (settlementWallet) return { address: settlementWallet, source: "settlement" as const };

  const legacyWallet = normalizeWallet(merchant?.wallet_address);
  if (legacyWallet) return { address: legacyWallet, source: "legacy" as const };

  return { address: "", source: "missing" as const };
}
