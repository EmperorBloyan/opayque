import { createBrowserClient } from '@supabase/ssr';

function createFallbackClient() {
  const buildQueryChain = () => ({
    select: () => buildQueryChain(),
    eq: () => buildQueryChain(),
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
    order: () => buildQueryChain(),
  });

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: null }, error: null }),
      signUp: async () => ({ data: { user: null }, error: null }),
    },
    from: () => buildQueryChain(),
  } as any;
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return createFallbackClient();
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Backwards-compatible name used across the codebase
export function createSupabaseBrowserClient() {
  return createClient();
}
