ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_status_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_status_check CHECK (status IN ('active', 'revoked'));