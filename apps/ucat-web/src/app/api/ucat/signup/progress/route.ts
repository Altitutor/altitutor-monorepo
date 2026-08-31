import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeUcatAcquisitionSources,
  parseUcatObservedFirstTouch,
  type Database,
  type UcatObservedFirstTouch,
} from "@altitutor/shared";
import {
  isSignupOnboardingStep,
  SIGNUP_STEP,
} from "@/features/signup-onboarding/lib/steps";
import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";
import {
  resolveSignupState,
  resolveSignupStateForUser,
} from "@/features/signup-onboarding/lib/resolve-signup-state";
import { captureUcatSignupCompletedInBackground } from "@/lib/analytics/posthog-server";

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
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    );
  }

  let body: {
    step?: unknown;
    complete?: unknown;
    planComplete?: unknown;
    familiarity?: unknown;
    acquisitionSources?: unknown;
    acquisitionOther?: unknown;
    observedFirstTouch?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasStep = body.step !== undefined;
  const hasComplete = body.complete === true;
  const hasPlanComplete = body.planComplete === true;
  const hasFamiliarity = body.familiarity !== undefined;
  const hasAcquisitionSources = body.acquisitionSources !== undefined;

  if (
    !hasStep &&
    !hasComplete &&
    !hasPlanComplete &&
    !hasFamiliarity &&
    !hasAcquisitionSources
  ) {
    return NextResponse.json(
      {
        error:
          "Provide step, complete, planComplete, familiarity, and/or acquisition sources",
      },
      { status: 400 },
    );
  }

  if (hasStep && !isSignupOnboardingStep(body.step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  if (
    hasFamiliarity &&
    body.familiarity !== "new" &&
    body.familiarity !== "familiar" &&
    body.familiarity !== "experienced"
  ) {
    return NextResponse.json({ error: "Invalid familiarity" }, { status: 400 });
  }

  const acquisitionSources = hasAcquisitionSources
    ? normalizeUcatAcquisitionSources(body.acquisitionSources)
    : null;
  if (hasAcquisitionSources && !acquisitionSources) {
    return NextResponse.json(
      { error: "Select at least one valid acquisition source" },
      { status: 400 },
    );
  }

  const acquisitionOther =
    typeof body.acquisitionOther === "string"
      ? body.acquisitionOther.trim()
      : "";
  if (acquisitionOther.length > 500) {
    return NextResponse.json(
      { error: "Other acquisition source is too long" },
      { status: 400 },
    );
  }
  if (
    acquisitionOther &&
    acquisitionSources &&
    !acquisitionSources.includes("other")
  ) {
    return NextResponse.json(
      { error: "Select Other before describing another source" },
      { status: 400 },
    );
  }

  let observedFirstTouch: UcatObservedFirstTouch | null = null;
  if (body.observedFirstTouch !== undefined && body.observedFirstTouch !== null) {
    observedFirstTouch = parseUcatObservedFirstTouch(body.observedFirstTouch);
    if (!observedFirstTouch) {
      return NextResponse.json(
        { error: "Invalid acquisition first touch" },
        { status: 400 },
      );
    }
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select(
      "id, ucat_signup_step, ucat_signup_completed_at, ucat_onboarding_completed_at, account_class, first_name, last_name",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found. Finish step 1 first." },
      { status: 404 },
    );
  }

  const { data: existingAttribution, error: attributionReadError } =
    await supabaseAdmin
      .from("student_product_acquisition_attributions")
      .select(
        "id, first_touch_captured_at, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, first_referrer_domain, first_landing_path, self_reported_sources, self_reported_other",
      )
      .eq("student_id", student.id)
      .eq("product", "UCAT_WEB")
      .maybeSingle();

  if (attributionReadError) {
    captureApiError(attributionReadError, "/api/ucat/signup/progress");
    return NextResponse.json(
      { error: "Failed to load acquisition details" },
      { status: 500 },
    );
  }

  if (
    (hasComplete ||
      hasPlanComplete ||
      (hasStep &&
        (body.step as SignupOnboardingStep) >
          SIGNUP_STEP.ACQUISITION_SOURCE)) &&
    !acquisitionSources &&
    !existingAttribution?.self_reported_sources?.length
  ) {
    return NextResponse.json(
      { error: "Tell us how you heard about Altitutor UCAT first" },
      { status: 400 },
    );
  }

  if (hasAcquisitionSources && acquisitionSources) {
    const now = new Date().toISOString();
    const selfReportedFields = {
      self_reported_sources: acquisitionSources,
      self_reported_other:
        acquisitionSources.includes("other") && acquisitionOther
          ? acquisitionOther
          : null,
      self_reported_at: now,
    };
    const observedFields = observedFirstTouch
      ? {
          first_utm_source: observedFirstTouch.utmSource,
          first_utm_medium: observedFirstTouch.utmMedium,
          first_utm_campaign: observedFirstTouch.utmCampaign,
          first_utm_content: observedFirstTouch.utmContent,
          first_utm_term: observedFirstTouch.utmTerm,
          first_referrer_domain: observedFirstTouch.referrerDomain,
          first_landing_path: observedFirstTouch.landingPath,
          first_touch_captured_at: observedFirstTouch.capturedAt,
        }
      : {};

    const attributionResult = existingAttribution
      ? await supabaseAdmin
          .from("student_product_acquisition_attributions")
          .update({
            ...selfReportedFields,
            ...(existingAttribution.first_touch_captured_at
              ? {}
              : observedFields),
          })
          .eq("id", existingAttribution.id)
      : await supabaseAdmin
          .from("student_product_acquisition_attributions")
          .insert({
            student_id: student.id,
            product: "UCAT_WEB",
            ...selfReportedFields,
            ...observedFields,
          });

    if (attributionResult.error) {
      captureApiError(attributionResult.error, "/api/ucat/signup/progress");
      return NextResponse.json(
        { error: "Failed to save acquisition details" },
        { status: 500 },
      );
    }
  }

  const updates: Database["public"]["Tables"]["students"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  const signupCompletedAt =
    student.ucat_signup_completed_at ?? new Date().toISOString();

  if (hasStep) {
    updates.ucat_signup_step = body.step as SignupOnboardingStep;
  }

  if (hasComplete) {
    updates.ucat_signup_completed_at = signupCompletedAt;
    updates.ucat_signup_step = SIGNUP_STEP.PLAN;
  }

  if (hasPlanComplete) {
    updates.ucat_onboarding_completed_at = new Date().toISOString();
    updates.ucat_signup_step = SIGNUP_STEP.PLAN;
  }

  if (hasFamiliarity) {
    updates.ucat_initial_familiarity = body.familiarity as string;
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update(updates)
    .eq("id", student.id);

  if (updateError) {
    captureApiError(updateError, "/api/ucat/signup/progress");
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (hasComplete) {
    const { error: relationshipError } = await supabaseAdmin
      .from("student_online_product_relationships")
      .upsert(
        {
          student_id: student.id,
          product: "UCAT_WEB",
          started_at: updates.ucat_signup_completed_at as string,
          closed_at: null,
        },
        {
          onConflict: "student_id,product",
          ignoreDuplicates: true,
        },
      );

    if (relationshipError) {
      captureApiError(relationshipError, "/api/ucat/signup/progress");
      return NextResponse.json(
        { error: "Failed to establish Altitutor UCAT access" },
        { status: 500 },
      );
    }

    // Retried requests deliberately emit the same stable event UUID. This
    // avoids losing the event when the student write succeeds but a later
    // relationship write or response fails; PostHog deduplicates the retry.
    const persistedSources =
      normalizeUcatAcquisitionSources(
        existingAttribution?.self_reported_sources,
      ) ?? acquisitionSources ?? ["not_sure"];
    const persistedFirstTouch = existingAttribution?.first_touch_captured_at
      ? {
          utmSource: existingAttribution.first_utm_source,
          utmMedium: existingAttribution.first_utm_medium,
          utmCampaign: existingAttribution.first_utm_campaign,
          utmContent: existingAttribution.first_utm_content,
          utmTerm: existingAttribution.first_utm_term,
          referrerDomain: existingAttribution.first_referrer_domain,
          landingPath: existingAttribution.first_landing_path ?? "/signup",
          capturedAt: existingAttribution.first_touch_captured_at,
        }
      : observedFirstTouch;
    captureUcatSignupCompletedInBackground({
      userId: user.id,
      studentId: student.id,
      completedAt: signupCompletedAt,
      accountClass:
        student.account_class === "internal_test"
          ? "internal_test"
          : "external",
      selfReportedSources: persistedSources,
      selfReportedOther:
        acquisitionOther || existingAttribution?.self_reported_other || null,
      observedFirstTouch: persistedFirstTouch,
    });
  }

  const nextStudent = {
    ...student,
    ucat_signup_step:
      (updates.ucat_signup_step as number | undefined) ??
      student.ucat_signup_step,
    ucat_signup_completed_at:
      (updates.ucat_signup_completed_at as string | undefined) ??
      student.ucat_signup_completed_at,
    ucat_onboarding_completed_at:
      (updates.ucat_onboarding_completed_at as string | undefined) ??
      student.ucat_onboarding_completed_at,
  };

  const profileSetupComplete =
    user.user_metadata?.profile_setup_complete === true;

  return NextResponse.json(
    resolveSignupState(nextStudent, profileSetupComplete),
  );
}
