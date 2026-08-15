import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { isAllowedBeforeSignupComplete } from "@/features/signup-onboarding/lib/signup-complete-paths";
import { resolvePostAuthDestination } from "@/features/auth/lib/social-auth";
import {
  authEntryPath,
  pathWithReturnIntent,
  safePostAuthReturnPath,
} from "@/features/auth/lib/return-intent";

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
  const isApiPath = pathname.startsWith("/api/");
  const isNoAuthPublicPath =
    pathname === "/reset-password" ||
    pathname.startsWith("/marketing-preview/") ||
    pathname === "/api/ucat/public-interest" ||
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
  }) as unknown as SupabaseClient<Database>;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && pathname.startsWith("/subscribe")) {
    const signupUrl = new URL(
      authEntryPath(
        "/signup",
        `${pathname}${request.nextUrl.search}`,
        request.nextUrl.searchParams,
      ),
      origin,
    );
    return NextResponse.redirect(signupUrl);
  }

  if (!user && !isPublicPath) {
    const loginUrl = new URL(
      authEntryPath(
        "/login",
        `${pathname}${request.nextUrl.search}`,
        request.nextUrl.searchParams,
      ),
      origin,
    );
    return NextResponse.redirect(loginUrl);
  }

  let signupCompleted: boolean | null = null;
  let activeStaffRole: string | null = null;
  if (user && !isApiPath) {
    const [accessResult, staffResult] = await Promise.all([
      supabase
        .from("vstudent_ucat_my_access")
        .select("ucat_signup_completed_at")
        .maybeSingle(),
      supabase.rpc("current_ucat_signup_staff_role"),
    ]);

    // Fail open on lookup errors / missing row so a transient
    // current_student_id() blip cannot invent "incomplete" and bounce
    // /dashboard ↔ /signup/complete.
    if (!accessResult.error) {
      signupCompleted =
        accessResult.data == null
          ? null
          : Boolean(accessResult.data.ucat_signup_completed_at);
    }
    if (staffResult.error) {
      return new NextResponse(
        "We couldn't verify account access. Please try again.",
        { status: 503 },
      );
    }
    activeStaffRole = staffResult.data;
  }

  if (user && activeStaffRole) {
    return NextResponse.redirect(new URL("/auth/staff-account", origin));
  }

  if (user && pathname === "/") {
    const dest = signupCompleted === false ? "/signup/complete" : "/dashboard";
    return NextResponse.redirect(new URL(dest, origin));
  }

  if (user && pathname === "/forgot-password") {
    const dest = signupCompleted === false ? "/signup/complete" : "/dashboard";
    return NextResponse.redirect(new URL(dest, origin));
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectTo = safePostAuthReturnPath(
      request.nextUrl.searchParams.get("redirect"),
    );
    const destination =
      signupCompleted === null
        ? redirectTo
        : resolvePostAuthDestination({
            intent: "login",
            provider: null,
            next: redirectTo,
            signupCompleted,
          });
    return NextResponse.redirect(new URL(destination, origin));
  }

  if (
    user &&
    signupCompleted === false &&
    !isAllowedBeforeSignupComplete(pathname)
  ) {
    return NextResponse.redirect(
      new URL(
        pathWithReturnIntent(
          "/signup/complete",
          `${pathname}${request.nextUrl.search}`,
        ),
        origin,
      ),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2)$).*)",
  ],
};
