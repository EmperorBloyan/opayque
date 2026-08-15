import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth session if expired
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isDeveloperRoute = pathname.startsWith('/developer');
  const isVaultRoute = pathname.startsWith('/vault');
  const isOnboardingRoute = pathname === '/onboarding' || pathname === '/developer/onboarding';
  const isLoginRoute = pathname === '/login';

  if (!user && (isDeveloperRoute || isVaultRoute || isOnboardingRoute)) {
    const nextTarget = request.nextUrl.pathname === '/' ? '/vault' : request.nextUrl.pathname;
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', nextTarget);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
