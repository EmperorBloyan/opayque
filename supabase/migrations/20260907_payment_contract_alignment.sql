-- Align the deployed database contract with the payment routes.
-- Older migrations called the ledger `transactions`; the application contract is `payment_ledger`.
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL
     AND to_regclass('public.payment_ledger') IS NULL THEN
    ALTER TABLE public.transactions RENAME TO payment_ledger;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'mainnet')),
  amount numeric NOT NULL CHECK (amount > 0),
  amount_fiat numeric,
  amount_token numeric NOT NULL CHECK (amount_token > 0),
  currency text NOT NULL,
  settlement_token text NOT NULL DEFAULT 'USDC',
  customer_email text,
  reference_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  solana_pay_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  terminal_id uuid REFERENCES public.terminals(id) ON DELETE SET NULL,
  checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  signature text,
  token_symbol text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  amount_base_units bigint NOT NULL CHECK (amount_base_units > 0),
  mint text NOT NULL,
  sender_address text,
  recipient_address text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending_signature', 'submitted', 'confirmed', 'failed', 'expired')),
  memo text,
  payload_hash text,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'mainnet')),
  idempotency_key text,
  idempotency_fingerprint text,
  failed_reason text,
  confirmed_at timestamptz,
  reconciliation_status text NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'not_found')),
  last_reconciled_at timestamptz,
  reconciliation_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_ledger
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid,
  ADD COLUMN IF NOT EXISTS amount_base_units bigint,
  ADD COLUMN IF NOT EXISTS mint text NOT NULL DEFAULT 'USDC',
  ADD COLUMN IF NOT EXISTS sender_address text,
  ADD COLUMN IF NOT EXISTS recipient_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint text,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_ledger_checkout_session_id_fkey'
      AND conrelid = 'public.payment_ledger'::regclass
  ) THEN
    ALTER TABLE public.payment_ledger
      ADD CONSTRAINT payment_ledger_checkout_session_id_fkey
      FOREIGN KEY (checkout_session_id) REFERENCES public.checkout_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_signature_unique
  ON public.payment_ledger(signature) WHERE signature IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_merchant_idempotency_unique
  ON public.payment_ledger(merchant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_ledger_merchant_status
  ON public.payment_ledger(merchant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_ledger_reconciliation
  ON public.payment_ledger(reconciliation_status, last_reconciled_at);
CREATE INDEX IF NOT EXISTS checkout_sessions_merchant_created
  ON public.checkout_sessions(merchant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.payment_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_ledger_set_updated_at ON public.payment_ledger;
CREATE TRIGGER payment_ledger_set_updated_at
  BEFORE UPDATE ON public.payment_ledger
  FOR EACH ROW EXECUTE FUNCTION public.payment_ledger_updated_at();

DROP TRIGGER IF EXISTS checkout_sessions_set_updated_at ON public.checkout_sessions;
CREATE TRIGGER checkout_sessions_set_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.payment_ledger_updated_at();

ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant owners can manage payment ledger" ON public.payment_ledger;
CREATE POLICY "Merchant owners can manage payment ledger"
  ON public.payment_ledger FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Merchant owners can manage checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Merchant owners can manage checkout sessions"
  ON public.checkout_sessions FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()));
