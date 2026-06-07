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

function normalizeTestYear(value: unknown): number | null | { error: string } {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { error: "testYear must be an integer year" };
  }
  if (value < 2020 || value > 2100) {
    return { error: "testYear is out of range" };
  }
  return value;
}

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
 * Updates wizard step, test year, or marks signup onboarding complete.
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

  let body: { step?: unknown; complete?: unknown; testYear?: unknown; planComplete?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasStep = body.step !== undefined;
  const hasComplete = body.complete === true;
  const hasTestYear = Object.prototype.hasOwnProperty.call(body, "testYear");

  const hasPlanComplete = body.planComplete === true;

  if (!hasStep && !hasComplete && !hasTestYear && !hasPlanComplete) {
    return NextResponse.json(
      { error: "Provide step, complete, planComplete, and/or testYear" },
      { status: 400 },
    );
  }

  if (hasStep && !isSignupOnboardingStep(body.step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  let normalizedTestYear: number | null | undefined;
  if (hasTestYear) {
    const parsed = normalizeTestYear(body.testYear);
    if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    normalizedTestYear = parsed;
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select(
      "id, ucat_signup_step, ucat_signup_completed_at, ucat_onboarding_completed_at, ucat_test_year, first_name, last_name",
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

  if (hasTestYear) {
    updates.ucat_test_year = normalizedTestYear ?? null;
  }

  if (hasComplete) {
    updates.ucat_signup_completed_at = new Date().toISOString();
    updates.ucat_signup_step = SIGNUP_STEP.TARGET_SCORES;
  }

  if (hasPlanComplete) {
    updates.ucat_onboarding_completed_at = new Date().toISOString();
    updates.ucat_signup_step = SIGNUP_STEP.TEST_DETAILS;
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update(updates)
    .eq("id", student.id);

  if (updateError) {
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
    ucat_test_year:
      (updates.ucat_test_year as number | null | undefined) ?? student.ucat_test_year,
  };

  const profileSetupComplete =
    user.user_metadata?.profile_setup_complete === true;

  return NextResponse.json(resolveSignupState(nextStudent, profileSetupComplete));
}
