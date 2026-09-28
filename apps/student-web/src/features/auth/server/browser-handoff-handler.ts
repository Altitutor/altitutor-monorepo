import { getClaimsWithJwtIssuedInFutureRetry } from "@altitutor/shared";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isBrowserDestination,
  openBrowserHandoff,
  sealBrowserHandoff,
  type BrowserDestination,
} from "./browser-handoff-ticket";

const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) throw new Error("Handoff unavailable");
  return { url, anon, secret };
}

const isolatedAuth = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};

const clockSkewRetryMs = 1_000;

async function body(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const text = await request.text();
  if (text.length > 8192) return null;
  const parsed: unknown = JSON.parse(text);
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function studentAllowed(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.active_staff_role === "ADMINSTAFF" || record.active_staff_role === "TUTOR") return false;
  return typeof record.student_id === "string" && record.student_id.length > 0;
}

type CookieEntry = { name: string; value: string; options: CookieOptions };

/** Issue a one-time browser session from the signed-in student app. */
export async function issueBrowserHandoff(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return json({ error: "Authentication required" }, 401);
    const input = await body(request);
    if (!input || !isBrowserDestination(input.path)) return json({ error: "Invalid handoff request" }, 400);
    const { url, anon, secret } = config();
    const caller = createClient(url, anon, {
      auth: isolatedAuth,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const identity = createClient(url, anon, { auth: isolatedAuth });
    const verified = await getClaimsWithJwtIssuedInFutureRetry(
      () => identity.auth.getUser(token),
      () => new Promise((resolve) => setTimeout(resolve, clockSkewRetryMs)),
      () => {
        console.warn("[browser handoff] recovered from JWT clock skew");
      },
    );
    const user = verified.data.user;
    const error = verified.error;
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) {
      console.error("[browser handoff] rejected", {
        reason: error ? "get_user" : !user?.email ? "missing_email" : !user.email_confirmed_at ? "unconfirmed" : "anonymous",
        code: error && typeof error === "object" && "code" in error ? String(error.code) : null,
        message: error instanceof Error ? error.message : null,
      });
      return json({ error: "Authentication required" }, 401);
    }
    const access = await caller.rpc("current_student_portal_access");
    if (access.error || !studentAllowed(access.data)) return json({ error: "Student access required" }, 403);
    const admin = createClient(url, secret, { auth: isolatedAuth });
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (generated.error || generated.data.user?.id !== user.id || !generated.data.properties?.hashed_token)
      throw new Error("Handoff unavailable");
    return json({
      ticket: sealBrowserHandoff(
        {
          purpose: "browser",
          userId: user.id,
          tokenHash: generated.data.properties.hashed_token,
          path: input.path as BrowserDestination,
        },
        secret,
      ),
    });
  } catch {
    return json({ error: "Unable to open your account. Please try again." }, 400);
  }
}

export async function exchangeBrowserHandoff(request: NextRequest) {
  const refreshedCookies: CookieEntry[] = [];
  const reply = (data: unknown, status = 200) => {
    const response = json(data, status);
    for (const cookie of refreshedCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  };
  try {
    if (!sameOrigin(request) || request.headers.has("authorization")) return reply({ error: "Not allowed" }, 403);
    const input = await body(request);
    if (!input) return reply({ error: "Invalid handoff request" }, 400);
    const { url, anon, secret } = config();
    const payload = openBrowserHandoff(input.ticket, secret);
    if (input.confirmed !== true) {
      const source = createServerClient(url, anon, {
        cookieOptions: { name: "student-auth" },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (entries) => {
            refreshedCookies.push(...entries);
          },
        },
      });
      const current = await source.auth.getUser();
      if (current.error || current.data.user?.id !== payload.userId) {
        const admin = createClient(url, secret, { auth: isolatedAuth });
        const target = await admin.auth.admin.getUserById(payload.userId);
        if (
          target.error ||
          target.data.user?.id !== payload.userId ||
          !target.data.user.email ||
          !target.data.user.email_confirmed_at ||
          target.data.user.is_anonymous
        )
          throw new Error("Invalid handoff");
        return reply({ confirmationRequired: true, email: target.data.user.email });
      }
    }
    const pendingCookies: CookieEntry[] = [];
    const client = createServerClient(url, anon, {
      cookieOptions: { name: "student-auth" },
      cookies: {
        getAll: () => [],
        setAll: (entries) => {
          pendingCookies.push(...entries);
        },
      },
    });
    const { data, error } = await client.auth.verifyOtp({
      type: "email",
      token_hash: payload.tokenHash,
    });
    if (error || !data.session || data.user?.id !== payload.userId || data.session.user.id !== payload.userId)
      throw new Error("Invalid handoff");
    const response = reply({ path: payload.path });
    for (const cookie of request.cookies.getAll()) {
      if (/^student-auth(?:\.\d+)?$/.test(cookie.name))
        response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
    for (const cookie of pendingCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch {
    return reply({ error: "Invalid or expired sign-in. Please try again." }, 400);
  }
}
