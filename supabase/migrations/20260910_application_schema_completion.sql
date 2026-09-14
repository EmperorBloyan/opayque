-- Complete the application schema required by checkout, settlement, webhook,
-- reconciliation, and reporting routes. This migration is data-free.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  terminal_id uuid REFERENCES public.terminals(id),
  checkout_session_id uuid,
  amount numeric NOT NULL,
  amount_base_units bigint,
  mint text NOT NULL,
  token_symbol text NOT NULL DEFAULT 'USDC',
  sender_address text,
  recipient_address text NOT NULL,
  signature text,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending_signature', 'submitted', 'confirmed', 'failed', 'expired')),
  memo text,
  environment text CHECK (environment IN ('sandbox', 'mainnet')),
  idempotency_key text,
  payload_hash text,
  failed_reason text,
  confirmed_at timestamptz,
  reconciliation_status text NOT NULL DEFAULT 'pending'
    CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'not_found')),
  last_reconciled_at timestamptz,
  reconciliation_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  environment varchar(50) CHECK (environment IN ('mainnet', 'sandbox')),
  amount numeric NOT NULL,
  currency varchar(10) DEFAULT 'USDC',
  customer_email varchar(255),
  reference_id varchar(255),
  status varchar(50) DEFAULT 'pending',
  solana_pay_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text,
  account_name text NOT NULL,
  account_number text NOT NULL,
  routing_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending',
  payout_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL DEFAULT 'default_merchant',
  destination_url text DEFAULT '',
  signing_secret text NOT NULL DEFAULT ('whsec_' || encode(extensions.gen_random_bytes(16), 'hex')),
  subscribed_events text[] DEFAULT ARRAY['checkout.session.completed', 'tx.shielded.settled', 'terminal.node.paired'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT webhook_configs_merchant_id_key UNIQUE (merchant_id)
);

CREATE TABLE IF NOT EXISTS public.onchain_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  signature varchar(128) NOT NULL UNIQUE,
  jito_bundle_id varchar(128),
  slot bigint,
  block_time timestamptz,
  amount numeric NOT NULL,
  fee_lamports bigint,
  status varchar(50) DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_ledger
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid;

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

CREATE OR REPLACE FUNCTION public.set_payment_ledger_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_merchants_wallet_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.wallet_address := NEW.settlement_wallet_address;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_ledger_set_updated_at ON public.payment_ledger;
CREATE TRIGGER payment_ledger_set_updated_at
  BEFORE UPDATE ON public.payment_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_ledger_updated_at();

DROP TRIGGER IF EXISTS trg_sync_merchants_wallet_address ON public.merchants;
CREATE TRIGGER trg_sync_merchants_wallet_address
  BEFORE INSERT OR UPDATE OF settlement_wallet_address ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.sync_merchants_wallet_address();

CREATE INDEX IF NOT EXISTS payment_ledger_merchant_id_idx ON public.payment_ledger(merchant_id);
CREATE INDEX IF NOT EXISTS payment_ledger_merchant_created_idx ON public.payment_ledger(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_ledger_status_idx ON public.payment_ledger(status);
CREATE INDEX IF NOT EXISTS payment_ledger_merchant_status_idx ON public.payment_ledger(merchant_id, status);
CREATE INDEX IF NOT EXISTS payment_ledger_reconciliation_idx ON public.payment_ledger(reconciliation_status, last_reconciled_at);
CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_signature_unique_idx ON public.payment_ledger(signature) WHERE signature IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_merchant_idempotency_unique_idx ON public.payment_ledger(merchant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_sessions_merchant_id_idx ON public.checkout_sessions(merchant_id);
CREATE INDEX IF NOT EXISTS onchain_transactions_checkout_session_id_idx ON public.onchain_transactions(checkout_session_id);
CREATE INDEX IF NOT EXISTS onchain_transactions_merchant_id_idx ON public.onchain_transactions(merchant_id);

ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onchain_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_ledger_owner_all ON public.payment_ledger;
CREATE POLICY payment_ledger_owner_all ON public.payment_ledger
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.auth_user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.auth_user_id = (select auth.uid())));
DROP POLICY IF EXISTS payment_ledger_service_all ON public.payment_ledger;
CREATE POLICY payment_ledger_service_all ON public.payment_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['checkout_sessions', 'bank_accounts', 'settlements', 'webhook_configs', 'onchain_transactions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_owner_all', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_service_all', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name || '_service_all', table_name);
  END LOOP;
END $$;

CREATE POLICY checkout_sessions_owner_all ON public.checkout_sessions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.auth_user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.auth_user_id = (select auth.uid())));

CREATE POLICY bank_accounts_owner_all ON public.bank_accounts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id AND m.auth_user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id AND m.auth_user_id = (select auth.uid())));

CREATE POLICY settlements_owner_all ON public.settlements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id AND m.auth_user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id AND m.auth_user_id = (select auth.uid())));

CREATE POLICY webhook_configs_owner_all ON public.webhook_configs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id AND m.auth_user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id::text = merchant_id AND m.auth_user_id = (select auth.uid())));

CREATE POLICY onchain_transactions_owner_all ON public.onchain_transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.auth_user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.auth_user_id = (select auth.uid())));