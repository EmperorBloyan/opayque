-- API credentials are represented only by hashes in api_keys.
ALTER TABLE public.merchants DROP COLUMN IF EXISTS api_key;

ALTER TABLE public.terminal_pairing_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant owners can manage pairing codes" ON public.terminal_pairing_codes;
CREATE POLICY "Merchant owners can manage pairing codes"
  ON public.terminal_pairing_codes
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.api_keys IS
  'Store only key_hash; never persist raw API credentials. Service-role routes may authenticate hashes.';