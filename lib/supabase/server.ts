import { createClient } from '@supabase/supabase-js';

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // Return a minimal stub that defers errors until runtime use so builds don't fail
    const err = new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    const stub = {
      from: () => ({
        insert: async () => { throw err; },
        upsert: async () => { throw err; },
        select: async () => { throw err; },
        update: async () => { throw err; },
        delete: async () => { throw err; },
      }),
    } as any;
    return stub;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}
