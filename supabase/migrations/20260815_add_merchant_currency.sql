-- Add preferred_currency column to merchants table
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_merchants_preferred_currency 
ON public.merchants(preferred_currency);
