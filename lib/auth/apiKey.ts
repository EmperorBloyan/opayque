import { createSupabaseServerClient } from '@/lib/supabase/server';
import crypto from 'node:crypto';

export function normalizeApiKeyHeader(authHeader: string | null) {
  if (!authHeader) return null;

  const normalized = authHeader.trim();
  if (!normalized) return null;

  const match = normalized.match(/^Bearer\s+(.+)$/i);
  const rawKey = match ? match[1] : normalized;
  const trimmed = rawKey.trim();

  return trimmed || null;
}

export function buildKeyHash(rawKey: string) {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

export { isValidPublishableKey, resolveMerchantAccessStatus } from '@/lib/auth/merchantAccess';

export async function authenticateApiKey(authHeader: string | null) {
  const rawKey = normalizeApiKeyHeader(authHeader);
  if (!rawKey) {
    return { error: 'Missing or invalid Authorization header' };
  }

  const supabaseAdmin = createSupabaseServerClient();
  const keyHash = buildKeyHash(rawKey);

  const { data: keyRecord, error } = await supabaseAdmin
    .from('api_keys')
    .select('merchant_id, environment')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (!error && keyRecord?.merchant_id) {
    supabaseAdmin.from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash)
      .then();

    return { merchantId: keyRecord.merchant_id, environment: keyRecord.environment ?? 'sandbox' };
  }

  const { data: legacyMerchant, error: legacyError } = await supabaseAdmin
    .from('merchants')
    .select('id')
    .eq('api_key', rawKey)
    .maybeSingle();

  if (!legacyError && legacyMerchant?.id) {
    return { merchantId: legacyMerchant.id, environment: 'sandbox' };
  }

  return { error: 'Invalid API Key' };
}
