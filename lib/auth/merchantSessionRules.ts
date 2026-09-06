import { resolveSettlementWallet } from '@/lib/merchant/wallets';

export type MerchantSessionRequirementsInput = {
  id?: string | null;
  api_access_status?: string | null;
  api_key?: string | null;
  wallet_address?: string | null;
  settlement_wallet_address?: string | null;
};

export function validateMerchantSessionRequirements(merchant: MerchantSessionRequirementsInput | null | undefined) {
  if (!merchant) {
    return { ok: false, error: 'Merchant profile not found. Please complete merchant onboarding first.' };
  }

  const settlementWallet = resolveSettlementWallet(merchant).address;

  if (!settlementWallet) {
    return {
      ok: false,
      error: 'Please configure your settlement wallet address in the Keys page before generating a link.',
    };
  }

  const status = typeof merchant.api_access_status === 'string'
    ? merchant.api_access_status.trim().toLowerCase()
    : '';
  const hasApprovedAccess = status === 'active' || status === 'approved';
  if (!hasApprovedAccess) {
    return {
      ok: false,
      error: 'Your merchant profile is not active yet. Please finish onboarding and generate a valid API key in the Keys page.',
    };
  }

  return { ok: true };
}
