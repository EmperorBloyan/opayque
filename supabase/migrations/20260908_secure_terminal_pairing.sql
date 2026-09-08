-- Pairing codes are redeemed only by the server-side pairing route.
-- The RPC claims the code and creates the terminal in one database transaction.
CREATE TABLE IF NOT EXISTS public.terminal_pairing_codes (
  code text PRIMARY KEY,
  merchant_id uuid,
  terminal_id uuid,
  terminal_label text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'USED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.terminal_pairing_codes
  ADD COLUMN IF NOT EXISTS terminal_id uuid,
  ADD COLUMN IF NOT EXISTS terminal_label text;

ALTER TABLE public.terminal_pairing_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can manage pairing codes" ON public.terminal_pairing_codes;
DROP POLICY IF EXISTS "Public can read pairing codes" ON public.terminal_pairing_codes;
DROP POLICY IF EXISTS "Public can insert pairing codes" ON public.terminal_pairing_codes;
DROP POLICY IF EXISTS "Public can update pairing codes" ON public.terminal_pairing_codes;
DROP POLICY IF EXISTS "Public can delete pairing codes" ON public.terminal_pairing_codes;
DROP POLICY IF EXISTS "Merchant owners can manage pairing codes" ON public.terminal_pairing_codes;

REVOKE ALL ON TABLE public.terminal_pairing_codes FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON TABLE public.terminal_pairing_codes TO service_role;

DO $$
BEGIN
  IF to_regclass('public.pairing_codes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.pairing_codes FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_terminal_pairing(
  p_code text,
  p_merchant_id uuid,
  p_terminal_id uuid,
  p_terminal_label text,
  p_device_token_hash text
)
RETURNS TABLE (
  terminal_id uuid,
  merchant_id uuid,
  terminal_label text,
  pairing_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  pairing public.terminal_pairing_codes%ROWTYPE;
  resolved_label text;
BEGIN
  IF p_code IS NULL OR p_merchant_id IS NULL OR p_terminal_id IS NULL OR p_device_token_hash IS NULL OR pg_catalog.btrim(p_device_token_hash) = '' THEN
    RAISE EXCEPTION 'PAIRING_REQUEST_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
    INTO pairing
    FROM public.terminal_pairing_codes
   WHERE code = pg_catalog.upper(pg_catalog.btrim(p_code))
    AND status = 'PENDING'
    AND terminal_id IS NULL
     AND expires_at > pg_catalog.now()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAIRING_CODE_REJECTED' USING ERRCODE = 'P0001';
  END IF;

  IF pairing.merchant_id IS NULL OR pairing.merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'PAIRING_MERCHANT_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  resolved_label := pg_catalog.left(
    pg_catalog.coalesce(
      pg_catalog.nullif(pg_catalog.btrim(p_terminal_label), ''),
      pg_catalog.nullif(pg_catalog.btrim(pairing.terminal_label), ''),
      'Fleet Terminal'
    ),
    80
  );

  INSERT INTO public.terminals (
    id,
    merchant_id,
    terminal_label,
    label,
    status,
    last_active,
    is_active,
    device_token_hash,
    created_at,
    updated_at
  ) VALUES (
    p_terminal_id,
    p_merchant_id,
    resolved_label,
    resolved_label,
    'online',
    pg_catalog.now(),
    true,
    p_device_token_hash,
    pg_catalog.now(),
    pg_catalog.now()
  );

  UPDATE public.terminal_pairing_codes
     SET status = 'USED', terminal_id = p_terminal_id
   WHERE code = pairing.code
     AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAIRING_CODE_REJECTED' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT p_terminal_id, p_merchant_id, resolved_label, pairing.code;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_terminal_pairing(text, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_terminal_pairing(text, uuid, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.redeem_terminal_pairing(text, uuid, uuid, text, text)
  IS 'Server-only atomic terminal pairing redemption. Claims one pending code and creates one terminal.';

-- The legacy duplicate table is intentionally not dropped by this migration.
-- Inventory and retire public.pairing_codes separately after confirming no deployed client uses it.
