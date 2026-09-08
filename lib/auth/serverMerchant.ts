import { createSupabaseServerClient } from '@/lib/supabase/server';

export type MerchantSessionContext = {
  user: { id: string; email?: string | null };
  merchant: { id: string; auth_user_id: string | null };
  supabase: ReturnType<typeof createSupabaseServerClient>;
};

export async function requireMerchantSession(request: Request) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 as const };

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id, auth_user_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (merchantError) return { error: 'Unable to resolve merchant profile', status: 500 as const };
  if (!merchant) return { error: 'Merchant profile not found', status: 403 as const };
  if (merchant.auth_user_id && merchant.auth_user_id !== user.id) {
    return { error: 'Merchant session does not match the authenticated user', status: 403 as const };
  }

  return { user, merchant, supabase } satisfies MerchantSessionContext;
}
