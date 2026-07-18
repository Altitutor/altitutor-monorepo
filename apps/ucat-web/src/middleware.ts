import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@altitutor/shared";

export async function middleware(request: NextRequest) {
  const { pathname, origin } = new URL(request.url);

  if (pathname.startsWith("/auth/callback&")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.search = pathname.slice("/auth/callback&".length);
    return NextResponse.redirect(redirectUrl);
  }

  // PKCE magic links: do not run Supabase session logic here. getUser() refreshes cookies and
  // can clear PKCE verifier storage before /auth/callback runs exchangeCodeForSession.
  if (pathname === "/auth/callback") {
    return NextResponse.next({ request });
  }

  if (pathname === "/pricing") {
    return NextResponse.redirect(new URL("/subscribe", origin));
  }

  const publicPaths = ["/login", "/signup", "/forgot-password"];
  const isDevelopmentSentryExample =
    process.env.NODE_ENV === "development" &&
    pathname === "/sentry-example-page";
  const isPublicPath =
    publicPaths.includes(pathname) || isDevelopmentSentryExample;
  const isNoAuthPublicPath =
    pathname === "/reset-password" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/ucat/subscription-config";

  if (isNoAuthPublicPath) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    cookieOptions: {
      name: "student-auth",
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && pathname.startsWith("/subscribe")) {
    const signupUrl = new URL("/signup", origin);
    signupUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signupUrl);
  }

  if (!user && pathname === "/checkout") {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "redirect",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  if (user && pathname === "/forgot-password") {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectTo =
      request.nextUrl.searchParams.get("redirect")?.startsWith("/") === true
        ? request.nextUrl.searchParams.get("redirect")!
        : "/dashboard";
    return NextResponse.redirect(new URL(redirectTo, origin));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2)$).*)",
  ],
};
