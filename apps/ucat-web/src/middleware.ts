import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authEntryPath } from "@/features/auth/lib/return-intent";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";

const SESSION_DEADLINE_MS = 10_000;
const RETRY_AFTER_SECONDS = 5;

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function createDeadline() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const expiration = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("UCAT session dependency deadline exceeded"));
    }, SESSION_DEADLINE_MS);
  });
  return {
    fetch: (input: RequestInfo | URL, init: RequestInit = {}) =>
      fetch(input, { ...init, signal: controller.signal }),
    race<T>(operation: PromiseLike<T>) {
      return Promise.race([Promise.resolve(operation), expiration]);
    },
    dispose: () => clearTimeout(timeout),
  };
}

function field(error: unknown, key: string) {
  if (typeof error !== "object" || error === null) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function applyMetadata(response: NextResponse, cookies: CookieToSet[], headers: Record<string, string>) {
  cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function unavailable(
  request: NextRequest,
  startedAt: number,
  error: unknown,
  cookies: CookieToSet[],
  headers: Record<string, string>,
) {
  Sentry.captureMessage("Middleware dependency unavailable", {
    level: "error",
    fingerprint: ["middleware-dependency-unavailable", "ucat-web", "authentication"],
    tags: {
      app: "ucat-web",
      dependency_stage: "authentication",
      http_status: "503",
      supabase_error_code: field(error, "code") ?? field(error, "name") ?? "unknown",
    },
    extra: {
      elapsed_ms: Math.max(0, Date.now() - startedAt),
      error_message: field(error, "message"),
      request_method: request.method,
      request_path: request.nextUrl.pathname,
    },
  });
  return applyMetadata(
    new NextResponse("We couldn't verify account access. Please try again.", {
      status: 503,
      headers: { "Retry-After": String(RETRY_AFTER_SECONDS) },
    }),
    cookies,
    headers,
  );
}

/** Version-neutral auth core. Next 16 only needs this exported as `proxy`. */
export async function handleAuthRequest(request: NextRequest) {
  const startedAt = Date.now();
  const { pathname, origin } = request.nextUrl;
  if (request.method === "OPTIONS") return NextResponse.next({ request });

  if (pathname.startsWith("/auth/callback&")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.search = pathname.slice("/auth/callback&".length);
    return NextResponse.redirect(redirectUrl);
  }
  if (pathname === "/auth/callback") return NextResponse.next({ request });
  if (pathname === "/pricing") return NextResponse.redirect(new URL("/subscribe", origin));

  const isNoSessionPath =
    pathname === "/reset-password" ||
    pathname.startsWith("/marketing-preview/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    (process.env.NODE_ENV === "development" && pathname === "/sentry-example-page");
  if (isNoSessionPath) return NextResponse.next({ request });

  const isPublicEntry =
    pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookies: CookieToSet[] = [];
  const responseHeaders: Record<string, string> = {};
  if (!supabaseUrl || !supabaseAnonKey) {
    return unavailable(request, startedAt, { code: "missing_environment" }, cookies, responseHeaders);
  }

  let response = NextResponse.next({ request });
  const deadline = createDeadline();
  const supabase = instrumentSupabaseClient(
    createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(updatedCookies, updatedHeaders) {
          updatedCookies.forEach(({ name, value }) => request.cookies.set(name, value));
          updatedCookies.forEach((cookie) => {
            const index = cookies.findIndex((current) => current.name === cookie.name);
            if (index >= 0) cookies[index] = cookie;
            else cookies.push(cookie);
          });
          Object.assign(responseHeaders, updatedHeaders);
          response = applyMetadata(NextResponse.next({ request }), cookies, responseHeaders);
        },
      },
      cookieOptions: { name: "student-auth" },
      global: { fetch: deadline.fetch },
    }) as unknown as SupabaseClient<Database>,
  );

  try {
    let claims: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      claims = await deadline.race(supabase.auth.getClaims());
    } catch (error) {
      return unavailable(request, startedAt, error, cookies, responseHeaders);
    }
    const missingSession = claims.error?.name === "AuthSessionMissingError";
    if (claims.error && !missingSession) {
      return unavailable(request, startedAt, claims.error, cookies, responseHeaders);
    }
    const userId = claims.data?.claims?.sub;
    if (!userId && pathname.startsWith("/subscribe")) {
      const signupUrl = new URL(
        authEntryPath(
          "/signup",
          `${pathname}${request.nextUrl.search}`,
          request.nextUrl.searchParams,
        ),
        origin,
      );
      return applyMetadata(NextResponse.redirect(signupUrl), cookies, responseHeaders);
    }
    if (!userId && !isPublicEntry) {
      const loginUrl = new URL(
        authEntryPath(
          "/login",
          `${pathname}${request.nextUrl.search}`,
          request.nextUrl.searchParams,
        ),
        origin,
      );
      return applyMetadata(NextResponse.redirect(loginUrl), cookies, responseHeaders);
    }
    return applyMetadata(response, cookies, responseHeaders);
  } finally {
    deadline.dispose();
  }
}

export const middleware = handleAuthRequest;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json|woff|woff2)$).*)",
  ],
};
