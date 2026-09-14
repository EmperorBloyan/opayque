-- Keep terminal pairing compatible with databases created before the fleet schema.
ALTER TABLE public.terminals
  ADD COLUMN IF NOT EXISTS terminal_label TEXT,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.terminals
SET terminal_label = COALESCE(NULLIF(terminal_label, ''), NULLIF(label, ''), 'Fleet Terminal')
WHERE terminal_label IS NULL OR terminal_label = '';

ALTER TABLE public.terminals
  ALTER COLUMN terminal_label SET NOT NULL;