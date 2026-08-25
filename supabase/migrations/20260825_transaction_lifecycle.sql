ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

UPDATE public.transactions SET status = 'created' WHERE status = 'pending';
UPDATE public.transactions SET status = 'confirmed' WHERE status = 'settled';

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('created', 'pending_signature', 'submitted', 'confirmed', 'failed', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS transactions_signature_unique
  ON public.transactions(signature)
  WHERE signature IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS onchain_transactions_signature_unique
  ON public.onchain_transactions(signature)
  WHERE signature IS NOT NULL;