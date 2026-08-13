import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isTargetingOnboarding = request.nextUrl.pathname === '/developer/onboarding';

  // If there is no user and they are trying to access the developer hub,
  // redirect them to the onboarding page to sign up.
  if (!user && request.nextUrl.pathname.startsWith('/developer') && !isTargetingOnboarding) {
    return NextResponse.redirect(new URL('/developer/onboarding', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/developer/:path*'],
};
