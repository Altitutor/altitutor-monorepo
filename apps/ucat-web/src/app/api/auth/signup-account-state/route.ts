import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SignupAccountState = "available" | "confirmed";

function response(
  body: { state?: SignupAccountState; error?: string },
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function clientKey(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(address).digest("hex");
}

function isSignupAccountState(value: unknown): value is SignupAccountState {
  return value === "available" || value === "confirmed";
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return response({ error: "Account lookup is unavailable." }, 503);
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@") || email.length > 320) {
    return response({ error: "Enter a valid email address." }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "resolve_ucat_signup_email_state",
    {
      p_client_key: clientKey(request),
      p_email: email,
    },
  );

  if (error) {
    if (error.message.includes("signup_email_lookup_rate_limited")) {
      return response(
        { error: "Too many attempts. Please try again shortly." },
        429,
      );
    }
    return response({ error: "Account lookup is unavailable." }, 503);
  }

  return isSignupAccountState(data)
    ? response({ state: data })
    : response({ error: "Account lookup is unavailable." }, 503);
}
