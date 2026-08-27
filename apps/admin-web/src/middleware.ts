import * as Sentry from "@sentry/nextjs";
import {
  getClaimsWithJwtIssuedInFutureRetry,
  headersWithVerifiedUser,
  isUnauthenticatedSessionError,
  type Database,
} from "@altitutor/shared";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";

const SESSION_DEADLINE_MS = 10_000;
const JWT_CLOCK_SKEW_RETRY_MS = 1_000;
const RETRY_AFTER_SECONDS = 5;

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function forwardRequest(request: NextRequest, userId: string | null) {
  return NextResponse.next({
    request: { headers: headersWithVerifiedUser(request.headers, userId) },
  });
}

function createDeadline() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const expiration = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("Admin session dependency deadline exceeded"));
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

function applyMetadata(
  response: NextResponse,
  cookies: CookieToSet[],
  headers: Record<string, string>,
) {
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
    fingerprint: ["middleware-dependency-unavailable", "admin-web", "authentication"],
    tags: {
      app: "admin-web",
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
    new NextResponse(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Temporarily unavailable</title></head><body><main><h1>Temporarily unavailable</h1><p>Admin services are taking too long to respond. Please try again in a moment.</p></main></body></html>',
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Retry-After": String(RETRY_AFTER_SECONDS),
        },
      },
    ),
    cookies,
    headers,
  );
}

function captureRecoveredClockSkew(startedAt: number) {
  Sentry.captureMessage("Middleware JWT clock skew recovered", {
    level: "warning",
    fingerprint: ["middleware-jwt-clock-skew", "admin-web"],
    tags: {
      app: "admin-web",
      dependency_stage: "authentication",
      retry_outcome: "recovered",
    },
    extra: { elapsed_ms: Math.max(0, Date.now() - startedAt) },
  });
}

/** Version-neutral auth core. Next 16 only needs this exported as `proxy`. */
export async function handleAuthRequest(request: NextRequest) {
  const startedAt = Date.now();
  const { pathname, origin } = request.nextUrl;
  if (request.method === "OPTIONS") return forwardRequest(request, null);

  if (pathname.startsWith("/auth/callback&")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.search = pathname.slice("/auth/callback&".length);
    return NextResponse.redirect(redirectUrl);
  }

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/sentry-example-page");
  if (pathname.startsWith("/api") || isPublic)
    return forwardRequest(request, null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookies: CookieToSet[] = [];
  const responseHeaders: Record<string, string> = {};
  if (!supabaseUrl || !supabaseAnonKey) {
    return unavailable(request, startedAt, { code: "missing_environment" }, cookies, responseHeaders);
  }

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
        },
      },
      cookieOptions: {
        name: "admin-auth",
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      global: { fetch: deadline.fetch },
    }),
  );

  try {
    let claims: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      claims = await getClaimsWithJwtIssuedInFutureRetry(
        () => deadline.race(supabase.auth.getClaims()),
        () =>
          deadline.race(
            new Promise((resolve) =>
              setTimeout(resolve, JWT_CLOCK_SKEW_RETRY_MS),
            ),
          ),
        () => captureRecoveredClockSkew(startedAt),
      );
    } catch (error) {
      if (isUnauthenticatedSessionError(error)) {
        return applyMetadata(
          NextResponse.redirect(new URL("/login", origin)),
          cookies,
          responseHeaders,
        );
      }
      return unavailable(request, startedAt, error, cookies, responseHeaders);
    }
    if (isUnauthenticatedSessionError(claims.error)) {
      return applyMetadata(NextResponse.redirect(new URL("/login", origin)), cookies, responseHeaders);
    }
    if (claims.error) return unavailable(request, startedAt, claims.error, cookies, responseHeaders);
    const userId = claims.data?.claims?.sub;
    if (!userId) {
      return applyMetadata(NextResponse.redirect(new URL("/login", origin)), cookies, responseHeaders);
    }
    if (pathname === "/") {
      return applyMetadata(NextResponse.redirect(new URL("/dashboard", origin)), cookies, responseHeaders);
    }
    return applyMetadata(
      forwardRequest(request, userId),
      cookies,
      responseHeaders,
    );
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
