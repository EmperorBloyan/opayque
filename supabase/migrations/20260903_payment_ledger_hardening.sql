-- Payment ledger hardening. Apply after all existing migrations, in Supabase SQL Editor.
-- Additive only: extends public.transactions and creates delivery-log indexes/policies.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid,
  ADD COLUMN IF NOT EXISTS amount_base_units bigint,
  ADD COLUMN IF NOT EXISTS mint text NOT NULL DEFAULT 'USDC',
  ADD COLUMN IF NOT EXISTS sender_address text,
  ADD COLUMN IF NOT EXISTS recipient_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_notes text;

UPDATE public.transactions t
SET amount_base_units = round(t.amount * 1000000)::bigint
WHERE t.amount_base_units IS NULL AND t.amount IS NOT NULL;
UPDATE public.transactions t
SET recipient_address = COALESCE(NULLIF(t.recipient_address, ''), m.settlement_wallet_address, m.wallet_address, '')
FROM public.merchants m
WHERE t.merchant_id = m.id AND COALESCE(t.recipient_address, '') = '';

DO $$
BEGIN
  IF to_regclass('public.checkout_sessions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'transactions_checkout_session_id_fkey'
         AND conrelid = 'public.transactions'::regclass
     ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_checkout_session_id_fkey
      FOREIGN KEY (checkout_session_id) REFERENCES public.checkout_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check,
  DROP CONSTRAINT IF EXISTS transactions_environment_check,
  DROP CONSTRAINT IF EXISTS transactions_reconciliation_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('created', 'pending_signature', 'submitted', 'confirmed', 'failed', 'expired')),
  ADD CONSTRAINT transactions_environment_check
    CHECK (environment IN ('sandbox', 'mainnet')),
  ADD CONSTRAINT transactions_reconciliation_status_check
    CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'not_found'));

CREATE UNIQUE INDEX IF NOT EXISTS transactions_signature_unique
  ON public.transactions(signature) WHERE signature IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_idempotency_unique
  ON public.transactions(merchant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_status ON public.transactions(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation ON public.transactions(reconciliation_status, last_reconciled_at);
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_session ON public.transactions(checkout_session_id);

CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status_code integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_created
  ON public.webhook_delivery_logs(webhook_id, created_at DESC);
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Merchant owners can view webhook delivery logs" ON public.webhook_delivery_logs;
CREATE POLICY "Merchant owners can view webhook delivery logs"
  ON public.webhook_delivery_logs FOR SELECT
  USING (webhook_id IN (
    SELECT w.id FROM public.webhooks w
    JOIN public.merchants m ON m.id = w.merchant_id
    WHERE m.auth_user_id = auth.uid()
  ));

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Merchant owners can manage transactions" ON public.transactions;
CREATE POLICY "Merchant owners can manage transactions"
  ON public.transactions FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE auth_user_id = auth.uid()));
