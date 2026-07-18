import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  isSignupOnboardingStep,
  SIGNUP_STEP,
} from "@/features/signup-onboarding/lib/steps";
import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";
import {
  resolveSignupState,
  resolveSignupStateForUser,
} from "@/features/signup-onboarding/lib/resolve-signup-state";

/**
 * GET /api/ucat/signup/progress
 * Returns persisted signup onboarding step and completion flags.
 */
export async function GET() {
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

  const state = await resolveSignupStateForUser(user);
  return NextResponse.json(state);
}

/**
 * PATCH /api/ucat/signup/progress
 * Updates wizard step or marks signup onboarding complete.
 */
export async function PATCH(request: NextRequest) {
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
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: { step?: unknown; complete?: unknown; planComplete?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasStep = body.step !== undefined;
  const hasComplete = body.complete === true;
  const hasPlanComplete = body.planComplete === true;

  if (!hasStep && !hasComplete && !hasPlanComplete) {
    return NextResponse.json(
      { error: "Provide step, complete, and/or planComplete" },
      { status: 400 },
    );
  }

  if (hasStep && !isSignupOnboardingStep(body.step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select(
      "id, ucat_signup_step, ucat_signup_completed_at, ucat_onboarding_completed_at, first_name, last_name",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: "Failed to resolve student" }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found. Finish step 1 first." },
      { status: 404 },
    );
  }

  const updates: Record<string, string | number | null> = {
    updated_at: new Date().toISOString(),
  };

  if (hasStep) {
    updates.ucat_signup_step = body.step as SignupOnboardingStep;
  }

  if (hasComplete) {
    updates.ucat_signup_completed_at = new Date().toISOString();
    updates.ucat_signup_step = SIGNUP_STEP.PLAN;
  }

  if (hasPlanComplete) {
    updates.ucat_onboarding_completed_at = new Date().toISOString();
    updates.ucat_signup_step = SIGNUP_STEP.PLAN;
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update(updates)
    .eq("id", student.id);

  if (updateError) {
    captureApiError(updateError, "/api/ucat/signup/progress");
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const nextStudent = {
    ...student,
    ucat_signup_step: (updates.ucat_signup_step as number | undefined) ?? student.ucat_signup_step,
    ucat_signup_completed_at:
      (updates.ucat_signup_completed_at as string | undefined) ??
      student.ucat_signup_completed_at,
    ucat_onboarding_completed_at:
      (updates.ucat_onboarding_completed_at as string | undefined) ??
      student.ucat_onboarding_completed_at,
  };

  const profileSetupComplete =
    user.user_metadata?.profile_setup_complete === true;

  return NextResponse.json(resolveSignupState(nextStudent, profileSetupComplete));
}
