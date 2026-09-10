ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS default_transfer_mode text NOT NULL DEFAULT 'private';

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_default_transfer_mode_check;

ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_default_transfer_mode_check
  CHECK (default_transfer_mode IN ('private', 'public'));

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS transfer_mode text NOT NULL DEFAULT 'private';

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_transfer_mode_check;

ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_transfer_mode_check
  CHECK (transfer_mode IN ('private', 'public'));

ALTER TABLE public.payment_ledger
  ADD COLUMN IF NOT EXISTS transfer_mode text NOT NULL DEFAULT 'private';

ALTER TABLE public.payment_ledger
  DROP CONSTRAINT IF EXISTS payment_ledger_transfer_mode_check;

ALTER TABLE public.payment_ledger
  ADD CONSTRAINT payment_ledger_transfer_mode_check
  CHECK (transfer_mode IN ('private', 'public'));