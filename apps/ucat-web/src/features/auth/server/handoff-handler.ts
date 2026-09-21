import { resolveUcatPortalAccess } from "./portal-access";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isBrowserDestination,
  isChallenge,
  matchesVerifier,
  openHandoff,
  sealHandoff,
  type HandoffPayload,
  type BrowserDestination,
} from "./handoff-ticket";

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
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) throw new Error("Handoff unavailable");
  return { url, anon, secret };
}
const isolatedAuth = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
async function body(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return null;
  const text = await request.text();
  if (text.length > 8192) return null;
  const parsed: unknown = JSON.parse(text);
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/** Issue only from an independently verified caller; never accept an email/user ID from the body. */
export async function issueHandoff(
  request: NextRequest,
  purpose: HandoffPayload["purpose"],
) {
  const refreshedCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];
  const reply = (data: unknown, status = 200) => {
    const response = json(data, status);
    for (const cookie of refreshedCookies)
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  };
  try {
    const authorization = request.headers.get("authorization");
    if (
      purpose === "native" &&
      (!sameOrigin(request) || authorization !== null)
    )
      return reply({ error: "Not allowed" }, 403);
    if (purpose === "browser" && !authorization?.match(/^Bearer [^\s]+$/i))
      return reply({ error: "Authentication required" }, 401);
    const input = await body(request);
    if (
      !input ||
      (purpose === "native"
        ? !isChallenge(input.challenge)
        : !isBrowserDestination(input.path))
    )
      return reply({ error: "Invalid handoff request" }, 400);
    const { url, anon, secret } = config();
    const caller =
      purpose === "native"
        ? createServerClient(url, anon, {
            cookieOptions: { name: "student-auth" },
            cookies: {
              getAll: () => request.cookies.getAll(),
              setAll: (entries) => {
                refreshedCookies.push(...entries);
              },
            },
          })
        : createClient(url, anon, { auth: isolatedAuth });
    const {
      data: { user },
      error,
    } =
      purpose === "native"
        ? await caller.auth.getUser()
        : await caller.auth.getUser(authorization!.slice(7));
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous)
      return reply({ error: "Authentication required" }, 401);
    const portal = await resolveUcatPortalAccess(user.id);
    if (
      portal.status !== "allowed" ||
      !portal.access.studentId ||
      portal.access.activeStaffRole ||
      !portal.access.signupCompleted ||
      !portal.access.hasUcatAccess
    )
      return reply({ error: "UCAT student access required" }, 403);
    // A separate admin client generates a one-time token, without emailing or reusing a refresh token.
    const admin = createClient(url, secret, { auth: isolatedAuth });
    const generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });
    if (
      generated.error ||
      generated.data.user?.id !== user.id ||
      !generated.data.properties?.hashed_token
    )
      throw new Error("Handoff unavailable");
    const common = {
      userId: user.id,
      tokenHash: generated.data.properties.hashed_token,
    };
    const payload: HandoffPayload =
      purpose === "native"
        ? { ...common, purpose, challenge: input.challenge as string }
        : { ...common, purpose, path: input.path as BrowserDestination };
    return reply({ ticket: sealHandoff(payload, secret) });
  } catch {
    return reply({ error: "Unable to start sign-in. Please try again." }, 400);
  }
}

export async function exchangeHandoff(
  request: NextRequest,
  purpose: HandoffPayload["purpose"],
) {
  const refreshedCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];
  const reply = (data: unknown, status = 200) => {
    const response = json(data, status);
    for (const cookie of refreshedCookies)
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  };
  try {
    if (
      purpose === "browser" &&
      (!sameOrigin(request) || request.headers.has("authorization"))
    )
      return reply({ error: "Not allowed" }, 403);
    const input = await body(request);
    if (!input) return reply({ error: "Invalid handoff request" }, 400);
    const { url, anon, secret } = config();
    const payload = openHandoff(input.ticket, secret, purpose);
    if (
      payload.purpose === "native" &&
      !matchesVerifier(payload.challenge, input.verifier)
    )
      return reply(
        { error: "Invalid or expired sign-in. Please try again." },
        400,
      );
    if (payload.purpose === "browser" && input.confirmed !== true) {
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
        // The page must ask consent before replacing an absent or different browser identity.
        return reply({
          confirmationRequired: true,
          email: target.data.user.email,
        });
      }
    }
    const pendingCookies: {
      name: string;
      value: string;
      options: CookieOptions;
    }[] = [];
    // Ignore incoming browser cookies: verification must create a distinct session.
    const client =
      purpose === "browser"
        ? createServerClient(url, anon, {
            cookieOptions: { name: "student-auth" },
            cookies: {
              getAll: () => [],
              setAll: (entries) => {
                pendingCookies.push(...entries);
              },
            },
          })
        : createClient(url, anon, { auth: isolatedAuth });
    const { data, error } = await client.auth.verifyOtp({
      type: "email",
      token_hash: payload.tokenHash,
    });
    if (
      error ||
      !data.session ||
      data.user?.id !== payload.userId ||
      data.session.user.id !== payload.userId
    )
      throw new Error("Invalid handoff");
    if (payload.purpose === "native")
      return reply({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    const response = reply({ path: payload.path });
    // Remove old chunks before writing the new identity; never return session tokens to browser JavaScript.
    for (const cookie of request.cookies.getAll()) {
      if (/^student-auth(?:\.\d+)?$/.test(cookie.name))
        response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
    for (const cookie of pendingCookies)
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch {
    return reply(
      { error: "Invalid or expired sign-in. Please try again." },
      400,
    );
  }
}
