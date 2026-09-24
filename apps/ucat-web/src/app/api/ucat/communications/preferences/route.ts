import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_UCAT_COMMUNICATION_PREFERENCES,
  UCAT_COMMUNICATION_TOPICS,
  UCAT_PREFERENCE_CONSENT_VERSION,
  UCAT_PREFERENCE_CONSENT_WORDING,
  type UcatCommunicationPreferences,
} from "@/features/communications/lib/communication-preferences";

async function getIdentity() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email || !supabaseAdmin) return null;
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return student
    ? { userId: user.id, email: user.email.trim().toLowerCase(), studentId: student.id }
    : null;
}

export async function GET() {
  const identity = await getIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin!
    .from("ucat_communication_preferences")
    .select(
      "weekly_progress_and_guidance, lessons_and_tips, product_news, offers_and_referrals",
    )
    .eq("student_id", identity.studentId)
    .maybeSingle();
  if (error) {
    captureApiError(error, "/api/ucat/communications/preferences");
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }

  return NextResponse.json({
    preferences: data ?? DEFAULT_UCAT_COMMUNICATION_PREFERENCES,
  });
}

export async function PATCH(request: NextRequest) {
  const identity = await getIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { preferences?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.preferences || typeof body.preferences !== "object") {
    return NextResponse.json({ error: "Preferences are required" }, { status: 400 });
  }
  const candidate = body.preferences as Record<string, unknown>;
  if (UCAT_COMMUNICATION_TOPICS.some((topic) => typeof candidate[topic] !== "boolean")) {
    return NextResponse.json(
      { error: "Every communication preference must be true or false" },
      { status: 400 },
    );
  }
  const preferences = candidate as UcatCommunicationPreferences;

  const { error } = await supabaseAdmin!.rpc(
    "set_ucat_communication_preferences",
    {
      p_auth_user_id: identity.userId,
      p_student_id: identity.studentId,
      p_email: identity.email,
      p_weekly_progress_and_guidance: preferences.weekly_progress_and_guidance,
      p_lessons_and_tips: preferences.lessons_and_tips,
      p_product_news: preferences.product_news,
      p_offers_and_referrals: preferences.offers_and_referrals,
      p_source: "ucat_preference_centre",
      p_wording_version: UCAT_PREFERENCE_CONSENT_VERSION,
      p_wording: UCAT_PREFERENCE_CONSENT_WORDING,
    },
  );
  if (error) {
    captureApiError(error, "/api/ucat/communications/preferences");
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  return NextResponse.json({ preferences });
}
