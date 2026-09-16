-- Legacy webhook rows may contain only secret_hash values. Hashes cannot be
-- reversed, so those rows must be rotated instead of being used for delivery.
UPDATE public.webhooks
SET is_active = false
WHERE secret_ciphertext IS NULL
  AND is_active = true;