-- Keep the deployed schema aligned with fields used by the terminal and payment APIs.
ALTER TABLE public.terminals
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_terminals_merchant_status
  ON public.terminals(merchant_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_created
  ON public.transactions(merchant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_terminal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS terminals_set_updated_at ON public.terminals;
CREATE TRIGGER terminals_set_updated_at
  BEFORE UPDATE ON public.terminals
  FOR EACH ROW EXECUTE FUNCTION public.set_terminal_updated_at();

DROP TRIGGER IF EXISTS transactions_set_updated_at ON public.transactions;
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_terminal_updated_at();

ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant owners can manage terminals" ON public.terminals;
CREATE POLICY "Merchant owners can manage terminals"
  ON public.terminals
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

DROP POLICY IF EXISTS "Merchant owners can manage transactions" ON public.transactions;
CREATE POLICY "Merchant owners can manage transactions"
  ON public.transactions
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