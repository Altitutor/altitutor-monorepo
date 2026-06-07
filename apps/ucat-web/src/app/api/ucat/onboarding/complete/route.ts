import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type OnboardingChoice = "free" | "unlimited_trial";

function parseOnboardingChoice(value: string | undefined): OnboardingChoice | null {
  if (value === "free" || value === "unlimited_trial") return value;
  // Legacy client payload
  if (value === "pro_trial") return "unlimited_trial";
  return null;
}

/**
 * POST /api/ucat/onboarding/complete
 * Records required onboarding choice. Unlimited trial choice does not start checkout —
 * client redirects to Stripe separately.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    );
  }

  let choice: OnboardingChoice;
  try {
    const body = (await request.json()) as { choice?: string };
    const parsed = parseOnboardingChoice(body.choice);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    }
    choice = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, ucat_onboarding_completed_at, ucat_unlimited_trial_consumed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    console.error("[onboarding/complete] student lookup failed:", studentError);
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      {
        error:
          "No student profile found. Finish signup at /signup/complete first.",
      },
      { status: 404 },
    );
  }

  if (student.ucat_onboarding_completed_at) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  if (
    choice === "unlimited_trial" &&
    student.ucat_unlimited_trial_consumed_at
  ) {
    return NextResponse.json(
      { error: "Unlimited trial is no longer available for this account" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({
      ucat_onboarding_completed_at: new Date().toISOString(),
      ucat_signup_step: 4,
    })
    .eq("id", student.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, choice });
}
