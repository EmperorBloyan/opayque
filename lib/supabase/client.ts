import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Backwards-compatible name used across the codebase
export function createSupabaseBrowserClient() {
  return createClient();
}
