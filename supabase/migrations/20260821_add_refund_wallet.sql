-- Refund wallet is the authenticated merchant's payout-out signing source.
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS refund_wallet_address TEXT;

COMMENT ON COLUMN public.merchants.refund_wallet_address IS
  'Payout-out signer for refunds; does not require a separate on-chain merchant vault.';