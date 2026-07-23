import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@altitutor/shared";

type SubmissionKind = "supported_access" | "online_tutoring_waitlist";

type SubmissionBody = {
  kind?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  reason?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

function textField(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  if (textField(body.website, 200)) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const startedAt = typeof body.startedAt === "number" ? body.startedAt : 0;
  if (!startedAt || Date.now() - startedAt < 1_000) {
    return NextResponse.json({ error: "Please try the form again." }, { status: 400 });
  }

  const kind = body.kind as SubmissionKind;
  const name = textField(body.name, 120);
  const email = textField(body.email, 320).toLowerCase();
  const phone = textField(body.phone, 40);
  const reason = textField(body.reason, 3000);

  if (!(["supported_access", "online_tutoring_waitlist"] as const).includes(kind)) {
    return NextResponse.json({ error: "Unknown form type." }, { status: 400 });
  }
  if (name.length < 2 || phone.length < 6 || !validEmail(email)) {
    return NextResponse.json(
      { error: "Please enter your name, a valid email, and your phone number." },
      { status: 400 },
    );
  }
  if (kind === "supported_access" && reason.length < 20) {
    return NextResponse.json(
      { error: "Please tell us a little more about why you are applying." },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[ucat public interest] Supabase server credentials are not configured");
    return NextResponse.json(
      { error: "Applications are temporarily unavailable. Please email admin@altitutor.com." },
      { status: 503 },
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("ucat_public_interest_submissions").insert({
    kind,
    name,
    email,
    phone,
    reason: kind === "supported_access" ? reason : null,
    contact_consent: true,
    source: "ucat_landing_page",
  });

  if (error) {
    console.error("[ucat public interest] Failed to save submission", error);
    return NextResponse.json(
      { error: "We could not save your response. Please email admin@altitutor.com." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
