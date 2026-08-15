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
  
  // 1. Define ALL protected routes here
  const isDeveloperRoute = pathname.startsWith('/developer');
  const isVaultRoute = pathname.startsWith('/vault');
  const isBotRoute = pathname.startsWith('/bot');           // <-- ADDED THIS
  const isRegistryRoute = pathname.startsWith('/registry'); // <-- ADDED THIS
  const isOnboardingRoute = pathname === '/onboarding' || pathname === '/developer/onboarding';
  const isLoginRoute = pathname === '/login';

  // 2. Protect unauthenticated users and track their intended destination
  const isProtectedRoute = isDeveloperRoute || isVaultRoute || isBotRoute || isRegistryRoute || isOnboardingRoute;

  if (!user && isProtectedRoute) {
    // Capture exactly where they were trying to go
    const nextTarget = request.nextUrl.pathname;
    
    const redirectUrl = new URL('/login', request.url);
    // Attach it to the URL (e.g., /login?next=/bot/unlock)
    redirectUrl.searchParams.set('next', nextTarget);
    
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Prevent logged-in users from getting stuck on the login page
  if (user && isLoginRoute) {
    // If they have a 'next' parameter, send them there. Otherwise, default to vault.
    const nextTarget = request.nextUrl.searchParams.get('next') || '/vault';
    return NextResponse.redirect(new URL(nextTarget, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
