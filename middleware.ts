import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function applySecurityHeaders(response: NextResponse) {
  const headers = response.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https://*.walletconnect.com https://*.reown.com"
  );

  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isDeveloperRoute = pathname.startsWith("/developer");
  const isVaultRoute = pathname.startsWith("/vault");
  const isBotRoute = pathname.startsWith("/bot");
  const isRegistryRoute = pathname.startsWith("/registry");
  const isOnboardingPage = pathname === "/onboarding";
  const isLoginRoute = pathname === "/login";

  const isProtectedRoute =
    isDeveloperRoute || isVaultRoute || isBotRoute || isRegistryRoute;

  // Logged-out users cannot open dashboard routes
  if (!user && isProtectedRoute) {
    const nextTarget = request.nextUrl.pathname;
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", nextTarget);
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  let merchant: { id: string; settlement_wallet_address?: string | null } | null =
    null;

  if (user) {
    const { data } = await supabase
      .from("merchants")
      .select("id, settlement_wallet_address")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    merchant = data ?? null;
  }

  // Authenticated but no merchant row → onboarding
  if (user && !isOnboardingPage && isProtectedRoute && !merchant) {
    const redirectUrl = new URL("/onboarding", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    redirectUrl.searchParams.set("setup", "1");
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  // Authenticated with merchant → leave onboarding
  if (user && isOnboardingPage && merchant) {
    const nextTarget =
      request.nextUrl.searchParams.get("next") || "/vault/registry";
    return applySecurityHeaders(NextResponse.redirect(new URL(nextTarget, request.url)));
  }

  // Authenticated user on /login:
  // - default: send to app
  // - force=1: allow login page (switch account) after client sign-out may lag
  const forceLogin = request.nextUrl.searchParams.get("force") === "1";
  if (user && isLoginRoute && !forceLogin) {
    const nextTarget =
      request.nextUrl.searchParams.get("next") || "/vault/registry";
    return applySecurityHeaders(NextResponse.redirect(new URL(nextTarget, request.url)));
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};