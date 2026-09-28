import { loadStudentPortalAccess } from "./portal-access";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isChallenge, matchesVerifier, openHandoff, sealHandoff, type HandoffPayload } from "./handoff-ticket";

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

async function body(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const text = await request.text();
  if (text.length > 8192) return null;
  const parsed: unknown = JSON.parse(text);
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/** Issue only from the signed-in browser; never accept an email or user ID from the body. */
export async function issueNativeHandoff(request: NextRequest) {
  const refreshedCookies: { name: string; value: string; options: CookieOptions }[] = [];
  const reply = (data: unknown, status = 200) => {
    const response = json(data, status);
    for (const cookie of refreshedCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  };
  try {
    const authorization = request.headers.get("authorization");
    if (!sameOrigin(request) || authorization !== null) return reply({ error: "Not allowed" }, 403);
    const input = await body(request);
    if (!input || !isChallenge(input.challenge)) return reply({ error: "Invalid handoff request" }, 400);
    const { url, anon, secret } = config();
    const caller = createServerClient(url, anon, {
      cookieOptions: { name: "student-auth" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (entries) => {
          refreshedCookies.push(...entries);
        },
      },
    });
    const {
      data: { user },
      error,
    } = await caller.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous)
      return reply({ error: "Authentication required" }, 401);
    const portal = await loadStudentPortalAccess(user.id);
    if (portal.status !== "allowed") return reply({ error: "Student access required" }, 403);
    const admin = createClient(url, secret, { auth: isolatedAuth });
    const generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });
    if (generated.error || generated.data.user?.id !== user.id || !generated.data.properties?.hashed_token)
      throw new Error("Handoff unavailable");
    const payload: HandoffPayload = {
      purpose: "native",
      userId: user.id,
      tokenHash: generated.data.properties.hashed_token,
      challenge: input.challenge,
    };
    return reply({ ticket: sealHandoff(payload, secret) });
  } catch {
    return reply({ error: "Unable to start sign-in. Please try again." }, 400);
  }
}

export async function exchangeNativeHandoff(request: NextRequest) {
  try {
    const input = await body(request);
    if (!input) return json({ error: "Invalid handoff request" }, 400);
    const { url, anon, secret } = config();
    const payload = openHandoff(input.ticket, secret);
    if (!matchesVerifier(payload.challenge, input.verifier))
      return json({ error: "Invalid or expired sign-in. Please try again." }, 400);
    const client = createClient(url, anon, { auth: isolatedAuth });
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
    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch {
    return json({ error: "Invalid or expired sign-in. Please try again." }, 400);
  }
}
