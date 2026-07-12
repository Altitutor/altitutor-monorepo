import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isUcatBillingInterval, isUcatPaidPlanTier } from "@altitutor/shared";
import type { Json } from "@altitutor/shared";

const EVENT_TYPES = new Set([
  "plan_selection_viewed",
  "plan_selected",
  "payment_submitted",
  "checkout_failed",
  "change_plan_clicked",
  "continued_free",
  "quota_upsell_shown",
  "quota_upsell_converted",
]);

const CONTEXTS = new Set([
  "signup_onboarding",
  "subscribe",
  "practice_session",
  "quota_paywall",
]);

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !supabaseAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !body ||
    typeof body.eventType !== "string" ||
    !EVENT_TYPES.has(body.eventType) ||
    typeof body.journeyContext !== "string" ||
    !CONTEXTS.has(body.journeyContext)
  ) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id, ucat_unlimited_trial_consumed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const planTier = isUcatPaidPlanTier(body.planTier) ? body.planTier : null;
  const billingInterval = isUcatBillingInterval(body.billingInterval)
    ? body.billingInterval
    : null;
  const metadata =
    body.metadata &&
    typeof body.metadata === "object" &&
    !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  const { error } = await supabaseAdmin
    .from("ucat_subscription_journey_events")
    .insert({
      student_id: student.id,
      event_type: body.eventType,
      journey_context: body.journeyContext,
      journey_variant: "baseline_v1",
      plan_tier: planTier,
      billing_interval: billingInterval,
      trial_eligible: student.ucat_unlimited_trial_consumed_at == null,
      stripe_checkout_session_id:
        typeof body.checkoutSessionId === "string"
          ? body.checkoutSessionId.slice(0, 255)
          : null,
      metadata: metadata as Json,
    });

  if (error) {
    console.error("[subscription journey]", error.message);
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 },
    );
  }
  return NextResponse.json({ recorded: true });
}
