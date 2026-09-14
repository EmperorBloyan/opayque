CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.terminals ADD COLUMN IF NOT EXISTS device_token_hash TEXT;

ALTER TABLE public.terminals DROP COLUMN IF EXISTS device_token;
CREATE UNIQUE INDEX IF NOT EXISTS terminals_device_token_hash_unique
  ON public.terminals(device_token_hash)
  WHERE device_token_hash IS NOT NULL;