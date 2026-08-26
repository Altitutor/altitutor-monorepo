import * as Sentry from "@sentry/nextjs";
import type { Database } from "@altitutor/shared";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";
import { MARKETING_LANDING_URL } from "@/shared/lib/marketing-home-url";

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
      reject(new Error("Student session dependency deadline exceeded"));
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
    fingerprint: ["middleware-dependency-unavailable", "student-web", "authentication"],
    tags: {
      app: "student-web",
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
    new NextResponse("Student portal services are temporarily unavailable. Please retry.", {
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
  const { pathname, search, origin } = request.nextUrl;
  if (request.method === "OPTIONS") return NextResponse.next({ request });

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
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/register/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/b/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/form/") ||
    pathname.startsWith("/booking/trial-session") ||
    pathname.startsWith("/booking-success") ||
    pathname.startsWith("/sentry-example-page");
  if (pathname.startsWith("/api") || isPublic) return NextResponse.next({ request });

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
    }),
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
    if (missingSession || !claims.data?.claims?.sub) {
      if (pathname === "/") {
        return applyMetadata(NextResponse.redirect(MARKETING_LANDING_URL), cookies, responseHeaders);
      }
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return applyMetadata(NextResponse.redirect(loginUrl), cookies, responseHeaders);
    }
    if (pathname === "/") {
      return applyMetadata(NextResponse.redirect(new URL("/dashboard", origin)), cookies, responseHeaders);
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
