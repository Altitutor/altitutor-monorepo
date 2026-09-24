import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type VerifyOtpBody = {
  email: string;
  token: string;
};

function parseVerifyOtpBody(value: unknown): VerifyOtpBody | null {
  if (typeof value !== "object" || value === null) return null;

  const email =
    "email" in value && typeof value.email === "string"
      ? value.email.trim().toLowerCase()
      : "";
  const token =
    "token" in value && typeof value.token === "string"
      ? value.token.replace(/\D/g, "")
      : "";

  if (!email || token.length !== 6) return null;
  return { email, token };
}

function noStoreJson(
  body: { error: { message: string; status?: number; code?: string } | null },
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = parseVerifyOtpBody(await request.json().catch(() => null));
  if (!body) {
    return noStoreJson(
      {
        error: {
          message: "Enter the 6-digit code from your email.",
          status: 400,
          code: "invalid_otp_payload",
        },
      },
      400,
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: body.email,
    token: body.token,
    type: "email",
  });

  if (error) {
    const status = error.status ?? 400;
    return noStoreJson(
      {
        error: {
          message: error.message || "We couldn't verify that code.",
          status,
          code: error.code,
        },
      },
      status,
    );
  }

  if (!data.session) {
    return noStoreJson(
      {
        error: {
          message:
            "The code was accepted, but no signup session was created. Please request a new code.",
          status: 401,
          code: "signup_session_missing",
        },
      },
      401,
    );
  }

  return noStoreJson({ error: null });
}
