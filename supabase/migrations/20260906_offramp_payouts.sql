CREATE TABLE IF NOT EXISTS public.offramp_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payout_id text NOT NULL UNIQUE,
  amount_usdc numeric NOT NULL CHECK (amount_usdc > 0),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offramp_payouts_merchant_created
  ON public.offramp_payouts(merchant_id, created_at DESC);

ALTER TABLE public.offramp_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant owners can view offramp payouts" ON public.offramp_payouts;
CREATE POLICY "Merchant owners can view offramp payouts"
  ON public.offramp_payouts
  FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()));