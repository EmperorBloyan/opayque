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
  const isBotRoute = pathname.startsWith('/bot');
  const isRegistryRoute = pathname.startsWith('/registry');
  const isOnboardingRoute = pathname === '/onboarding';
  const isLoginRoute = pathname === '/login';

  // 2. Protect unauthenticated users and track their intended destination
  const isProtectedRoute = isDeveloperRoute || isVaultRoute || isBotRoute || isRegistryRoute || isOnboardingRoute;
  const isOnboardingPage = pathname === '/onboarding';

  if (!user && isProtectedRoute) {
    const nextTarget = request.nextUrl.pathname;
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', nextTarget);
    return NextResponse.redirect(redirectUrl);
  }

  let merchant: { id: string; settlement_wallet_address?: string | null } | null = null;

  if (user && isProtectedRoute) {
    const { data } = await supabase
      .from('merchants')
      .select('id, settlement_wallet_address')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    merchant = data ?? null;
  }

  if (user && !isOnboardingPage && isProtectedRoute && !merchant) {
    const redirectUrl = new URL('/onboarding', request.url);
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isOnboardingPage && merchant) {
    const nextTarget = request.nextUrl.searchParams.get('next') || '/vault/registry';
    return NextResponse.redirect(new URL(nextTarget, request.url));
  }

  if (user && isLoginRoute) {
    const nextTarget = request.nextUrl.searchParams.get('next') || '/vault/registry';
    return NextResponse.redirect(new URL(nextTarget, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
