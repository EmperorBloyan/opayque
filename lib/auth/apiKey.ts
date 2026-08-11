import { createSupabaseServerClient } from '@/lib/supabase/server';
import crypto from 'node:crypto';

const supabaseAdmin = createSupabaseServerClient();

export async function authenticateApiKey(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header' };
  }

  const rawKey = authHeader.replace('Bearer ', '').trim();
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { data: keyRecord, error } = await supabaseAdmin
    .from('api_keys')
    .select('merchant_id, environment')
    .eq('key_hash', keyHash)
    .single();

  if (error || !keyRecord) {
    return { error: 'Invalid API Key' };
  }

  // Update last_used_at timestamp non-blockingly
  supabaseAdmin.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
    .then();

  return { merchantId: keyRecord.merchant_id, environment: keyRecord.environment };
}
