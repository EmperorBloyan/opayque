ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS screening_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS risk_score TEXT,
  ADD COLUMN IF NOT EXISTS provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS screened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS screening_country TEXT,
  ADD COLUMN IF NOT EXISTS screening_business_name TEXT;

ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS merchants_screening_status_check;
ALTER TABLE public.merchants ADD CONSTRAINT merchants_screening_status_check CHECK (screening_status IN ('pending', 'approved', 'rejected', 'review'));