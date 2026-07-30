import { createBrowserClient } from "@supabase/ssr";

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
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
      subscribe: async () => ({})
    }),
    removeChannel: () => undefined,
  } as any;
}

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return createChainableFallbackClient(new Error("Supabase environment variables are not configured."));
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
