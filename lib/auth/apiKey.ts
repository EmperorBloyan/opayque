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
    .select('merchant_id, environment, status, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (!error && keyRecord?.merchant_id && keyRecord.status !== 'revoked' && !keyRecord.revoked_at) {
    supabaseAdmin.from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash)
      .then();

    const keyMatch = rawKey.match(/^osk_(live|test)(?:_pub)?_[A-Za-z0-9_-]{16,}$/i);
    if (!keyMatch) return { error: 'Invalid API Key' };
    const expectedEnvironment = keyMatch[1].toLowerCase() === 'live' ? 'mainnet' : 'sandbox';
    if ((keyRecord.environment ?? 'sandbox') !== expectedEnvironment) return { error: 'Invalid API Key' };
    return { merchantId: keyRecord.merchant_id, environment: keyRecord.environment ?? 'sandbox', keyType: rawKey.includes('_pub_') ? 'publishable' : 'secret' as const };
  }

  return { error: 'Invalid API Key' };
}
