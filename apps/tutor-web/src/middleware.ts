import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@altitutor/shared";

const MIDDLEWARE_DEADLINE_MS = 10_000;
const RETRY_AFTER_SECONDS = 5;

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

class MiddlewareDeadlineError extends Error {
  constructor() {
    super("Tutor middleware dependency deadline exceeded");
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
  cookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function unavailableResponse(cookies: CookieToSet[]) {
  return applyResponseMetadata(
    new NextResponse(
      "Tutor services are temporarily unavailable. Please try again.",
      {
        status: 503,
        headers: { "Retry-After": String(RETRY_AFTER_SECONDS) },
      },
    ),
    cookies,
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, search, origin } = new URL(req.url);
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/form/") ||
    pathname.startsWith("/sentry-example-page");

  if (pathname.startsWith("/api") || isPublicPath) {
    return NextResponse.next({ request: req });
  }

  const cookiesToSet: CookieToSet[] = [];
  let response = NextResponse.next({ request: req });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Tutor middleware Supabase environment is unavailable");
    return unavailableResponse(cookiesToSet);
  }

  const deadline = createInvocationDeadline();
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(updatedCookies) {
        updatedCookies.forEach(({ name, value }) =>
          req.cookies.set(name, value),
        );
        updatedCookies.forEach((cookie) => {
          const existingIndex = cookiesToSet.findIndex(
            (existing) => existing.name === cookie.name,
          );
          if (existingIndex >= 0) cookiesToSet[existingIndex] = cookie;
          else cookiesToSet.push(cookie);
        });
        response = NextResponse.next({ request: req });
        applyResponseMetadata(response, cookiesToSet);
      },
    },
    cookieOptions: { name: "tutor-auth" },
    global: { fetch: deadline.fetch },
  });

  try {
    let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      claimsResult = await deadline.race(supabase.auth.getClaims());
    } catch (error) {
      console.error("Tutor middleware authentication dependency failed", error);
      return unavailableResponse(cookiesToSet);
    }
    const { data: claimsData, error: claimsError } = claimsResult;
    const isMissingSession = claimsError?.name === "AuthSessionMissingError";
    if (claimsError && !isMissingSession) {
      console.error(
        "Tutor middleware authentication dependency failed",
        claimsError,
      );
      return unavailableResponse(cookiesToSet);
    }
    const userId = claimsData?.claims?.sub;

    if (!userId && pathname !== "/") {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return applyResponseMetadata(
        NextResponse.redirect(loginUrl),
        cookiesToSet,
      );
    }
    if (!userId) return applyResponseMetadata(response, cookiesToSet);

    let profileResult: {
      data: { role: "ADMINSTAFF" | "TUTOR"; status: string | null } | null;
      error: { message: string } | null;
    };
    try {
      profileResult = await deadline.race(
        supabase.from("vtutor_profile").select("role, status").maybeSingle(),
      );
    } catch (error) {
      console.error("Tutor middleware profile dependency failed", error);
      return unavailableResponse(cookiesToSet);
    }
    if (profileResult.error) {
      console.error(
        "Tutor middleware profile dependency failed",
        profileResult.error,
      );
      return unavailableResponse(cookiesToSet);
    }
    const isActiveStaff =
      profileResult.data?.status === "ACTIVE" &&
      (profileResult.data.role === "TUTOR" ||
        profileResult.data.role === "ADMINSTAFF");
    if (!isActiveStaff) {
      return applyResponseMetadata(
        NextResponse.redirect(new URL("/login?error=access_denied", origin)),
        cookiesToSet,
      );
    }

    if (pathname === "/") {
      return applyResponseMetadata(
        NextResponse.redirect(new URL("/dashboard", origin)),
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
