import { createServerClient } from '@supabase/ssr';
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
    auth: {
      getUser: async () => ({ data: null, error }),
    },
  } as any;
}

function getRequestCookies(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf('=');
      return separator === -1
        ? { name: part, value: '' }
        : { name: part.slice(0, separator), value: decodeURIComponent(part.slice(separator + 1)) };
    });
}

export function createSupabaseServerClient(request?: Request | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || (!request && !supabaseServiceKey)) {
    const err = new Error(
      request
        ? 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
        : 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
    return createChainableFallbackClient(err);
  }

  if (!request) {
    if (!supabaseServiceKey) {
      return createChainableFallbackClient(new Error('Supabase not configured. Set SUPABASE_SERVICE_ROLE_KEY'));
    }
    return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  }

  const cookies = getRequestCookies(request);
  const authHeader = request.headers.get('authorization') || undefined;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookies,
      setAll: () => {
        // Route handlers cannot mutate the response through this shared client.
        // Middleware refreshes the session cookies before protected requests run.
      },
    },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

export async function getAuthenticatedUserId(request: Request) {
  const supabase = createSupabaseServerClient(request);
  try {
    const { data, error } = await (supabase.auth as any).getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (e) {
    console.error('Error fetching authenticated user', e);
    return null;
  }
}
