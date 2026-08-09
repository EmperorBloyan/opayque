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

function getAuthToken(request?: Request | null) {
  if (!request) return null;

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createSupabaseServerClient(request?: Request | null) {
function getAuthToken(request?: Request | null) {
  if (!request) return null;

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createSupabaseServerClient(request?: Request | null) {
>>>>>>> 5142c43 (feat: complete developer hub, sandbox environment, and webhook api integrations)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    const err = new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return createChainableFallbackClient(err);
  }
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  const token = getAuthToken(request);
  if (token) {
    try {
      (supabase.auth as any).setAuth?.(token);
    } catch (e) {
      console.error('Failed to set Supabase auth token', e);
    }
  }

  return supabase;
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
