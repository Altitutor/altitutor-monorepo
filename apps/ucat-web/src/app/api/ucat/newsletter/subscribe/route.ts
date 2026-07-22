import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  UCAT_SIGNUP_CONSENT_VERSION,
  UCAT_SIGNUP_CONSENT_WORDING,
} from "@/features/communications/lib/communication-preferences";

const ALLOWED_SOURCES = new Set(["ucat_email_signup", "ucat_social_signup"]);

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (authError || !user || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestedSource = "ucat_email_signup";
  try {
    const body = (await request.json()) as { source?: unknown };
    if (typeof body.source === "string" && ALLOWED_SOURCES.has(body.source)) {
      requestedSource = body.source;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error: subscriberError } = await supabaseAdmin
    .from("newsletter_subscribers")
    .upsert(
      {
        auth_user_id: user.id,
        email,
        source: requestedSource,
        student_id: student?.id ?? null,
        subscribed_at: now,
        unsubscribed_at: null,
        consent_version: UCAT_SIGNUP_CONSENT_VERSION,
        consent_wording: UCAT_SIGNUP_CONSENT_WORDING,
        consent_verified_at: now,
        resend_audience_synced_at: null,
        updated_at: now,
      },
      { onConflict: "email" },
    );

  if (subscriberError) {
    captureApiError(subscriberError, "/api/ucat/newsletter/subscribe");
    return NextResponse.json({ error: "Failed to save consent" }, { status: 500 });
  }

  const { error: consentError } = await supabaseAdmin
    .from("ucat_communication_consent_events")
    .insert({
        auth_user_id: user.id,
        student_id: student?.id ?? null,
        email,
        topic: "all_marketing",
        action: "granted",
        source: requestedSource,
        wording_version: UCAT_SIGNUP_CONSENT_VERSION,
        wording: UCAT_SIGNUP_CONSENT_WORDING,
        occurred_at: now,
    });
  let preferencesError = null;
  if (student?.id) {
    const result = await supabaseAdmin
      .from("ucat_communication_preferences")
      .upsert({
        student_id: student.id,
        weekly_progress_and_guidance: true,
        lessons_and_tips: true,
        product_news: true,
        offers_and_referrals: true,
        updated_at: now,
      });
    preferencesError = result.error;
  }

  const writeError = consentError ?? preferencesError;
  if (writeError) {
    captureApiError(writeError, "/api/ucat/newsletter/subscribe");
    return NextResponse.json(
      { error: "Consent saved, but preferences need attention" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
