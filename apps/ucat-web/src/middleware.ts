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

const MIDDLEWARE_DEADLINE_MS = 10_000;
const RETRY_AFTER_SECONDS = 5;

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

type SignupAccessResult = {
  data: Pick<
    Database["public"]["Views"]["vstudent_ucat_my_access"]["Row"],
    "ucat_signup_completed_at"
  > | null;
  error: { message: string } | null;
};

type StaffAccessResult = {
  data: string | null;
  error: { message: string } | null;
};

class MiddlewareDeadlineError extends Error {
  constructor() {
    super("UCAT middleware dependency deadline exceeded");
    this.name = "MiddlewareDeadlineError";
  }
}

function createInvocationDeadline() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const expiration = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new MiddlewareDeadlineError());
    }, MIDDLEWARE_DEADLINE_MS);
  });

  return {
    async fetch(input: RequestInfo | URL, init: RequestInit = {}) {
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      const signals = [controller.signal, init.signal].filter(
        (signal): signal is AbortSignal => Boolean(signal),
      );
      signals.forEach((signal) => {
        if (signal.aborted) abortRequest();
        else signal.addEventListener("abort", abortRequest, { once: true });
      });

      try {
        return await fetch(input, {
          ...init,
          signal: requestController.signal,
        });
      } finally {
        signals.forEach((signal) =>
          signal.removeEventListener("abort", abortRequest),
        );
      }
    },
    race<T>(operation: PromiseLike<T>) {
      return Promise.race([Promise.resolve(operation), expiration]);
    },
    dispose() {
      clearTimeout(timeout);
    },
  };
}

function applyResponseMetadata(response: NextResponse, cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function unavailableResponse(cookies: CookieToSet[]) {
  const response = new NextResponse(
    "We couldn't verify account access. Please try again.",
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": String(RETRY_AFTER_SECONDS),
      },
    },
  );
  return applyResponseMetadata(response, cookies);
}

export async function middleware(request: NextRequest) {
  const { pathname, origin } = new URL(request.url);

  if (pathname.startsWith("/auth/callback&")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.search = pathname.slice("/auth/callback&".length);
    return NextResponse.redirect(redirectUrl);
  }

  // PKCE magic links: do not run Supabase session logic here. Session refresh can clear
  // PKCE verifier storage before /auth/callback runs exchangeCodeForSession.
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
  const cookiesToSet: CookieToSet[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("UCAT middleware Supabase environment is unavailable");
    return unavailableResponse(cookiesToSet);
  }

  const deadline = createInvocationDeadline();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(updatedCookies) {
        updatedCookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        updatedCookies.forEach((cookie) => {
          const existingIndex = cookiesToSet.findIndex(
            (existing) => existing.name === cookie.name,
          );
          if (existingIndex >= 0) {
            cookiesToSet[existingIndex] = cookie;
          } else {
            cookiesToSet.push(cookie);
          }
        });
        response = NextResponse.next({
          request,
        });
        applyResponseMetadata(response, cookiesToSet);
      },
    },
    cookieOptions: {
      name: "student-auth",
    },
    global: {
      fetch: deadline.fetch,
    },
  }) as unknown as SupabaseClient<Database>;

  try {
    let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      claimsResult = await deadline.race(supabase.auth.getClaims());
    } catch (error) {
      console.error("UCAT middleware authentication dependency failed", error);
      return unavailableResponse(cookiesToSet);
    }
    const { data: claimsData, error: claimsError } = claimsResult;
    const isMissingSession = claimsError?.name === "AuthSessionMissingError";
    if (claimsError && !isMissingSession) {
      console.error(
        "UCAT middleware authentication dependency failed",
        claimsError,
      );
      return unavailableResponse(cookiesToSet);
    }
    const userId = claimsData?.claims?.sub;

    if (!userId && pathname.startsWith("/subscribe")) {
      const signupUrl = new URL(
        authEntryPath(
          "/signup",
          `${pathname}${request.nextUrl.search}`,
          request.nextUrl.searchParams,
        ),
        origin,
      );
      return applyResponseMetadata(
        NextResponse.redirect(signupUrl),
        cookiesToSet,
      );
    }

    if (!userId && !isPublicPath) {
      const loginUrl = new URL(
        authEntryPath(
          "/login",
          `${pathname}${request.nextUrl.search}`,
          request.nextUrl.searchParams,
        ),
        origin,
      );
      return applyResponseMetadata(
        NextResponse.redirect(loginUrl),
        cookiesToSet,
      );
    }

    let signupCompleted: boolean | null = null;
    let activeStaffRole: string | null = null;
    if (userId && !isApiPath) {
      let accessResult: SignupAccessResult;
      let staffResult: StaffAccessResult;
      try {
        [accessResult, staffResult] = await deadline.race(
          Promise.all([
            supabase
              .from("vstudent_ucat_my_access")
              .select("ucat_signup_completed_at")
              .maybeSingle(),
            supabase.rpc("current_ucat_signup_staff_role"),
          ]),
        );
      } catch (error) {
        console.error(
          "UCAT middleware account-access dependency failed",
          error,
        );
        return unavailableResponse(cookiesToSet);
      }

      if (accessResult.error) {
        console.error(
          "UCAT middleware signup-access dependency failed",
          accessResult.error,
        );
        return unavailableResponse(cookiesToSet);
      }
      signupCompleted =
        accessResult.data == null
          ? null
          : Boolean(accessResult.data.ucat_signup_completed_at);
      if (staffResult.error) {
        console.error(
          "UCAT middleware staff-access dependency failed",
          staffResult.error,
        );
        return unavailableResponse(cookiesToSet);
      }
      activeStaffRole = staffResult.data;
    }

    if (userId && activeStaffRole) {
      return applyResponseMetadata(
        NextResponse.redirect(new URL("/auth/staff-account", origin)),
        cookiesToSet,
      );
    }

    if (userId && pathname === "/") {
      const dest =
        signupCompleted === false ? "/signup/complete" : "/dashboard";
      return applyResponseMetadata(
        NextResponse.redirect(new URL(dest, origin)),
        cookiesToSet,
      );
    }

    if (userId && pathname === "/forgot-password") {
      const dest =
        signupCompleted === false ? "/signup/complete" : "/dashboard";
      return applyResponseMetadata(
        NextResponse.redirect(new URL(dest, origin)),
        cookiesToSet,
      );
    }

    if (userId && (pathname === "/login" || pathname === "/signup")) {
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
      return applyResponseMetadata(
        NextResponse.redirect(new URL(destination, origin)),
        cookiesToSet,
      );
    }

    if (
      userId &&
      signupCompleted === false &&
      !isAllowedBeforeSignupComplete(pathname)
    ) {
      return applyResponseMetadata(
        NextResponse.redirect(
          new URL(
            pathWithReturnIntent(
              "/signup/complete",
              `${pathname}${request.nextUrl.search}`,
            ),
            origin,
          ),
        ),
        cookiesToSet,
      );
    }

    return applyResponseMetadata(response, cookiesToSet);
  } finally {
    deadline.dispose();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2)$).*)",
  ],
};
