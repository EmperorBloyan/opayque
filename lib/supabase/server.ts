import { createClient } from '@supabase/supabase-js';

function createChainableFallbackClient(error: Error) {
  const buildQuery = () => ({
    select: () => buildQuery(),
    eq: () => buildQuery(),
    single: async () => ({ data: null, error }),
    insert: async () => ({ data: null, error }),
    update: async () => ({ data: null, error }),
    upsert: async () => ({ data: null, error }),
    delete: async () => ({ data: null, error }),
  });

  return {
    from: () => buildQuery(),
  } as any;
}

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingVars: string[] = [];

  if (!supabaseUrl) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missingVars.length > 0) {
    const message = `Supabase server client missing environment variables: ${missingVars.join(", ")}. Add these to your runtime environment.`;
    console.error(message);
    throw new Error(message);
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}
