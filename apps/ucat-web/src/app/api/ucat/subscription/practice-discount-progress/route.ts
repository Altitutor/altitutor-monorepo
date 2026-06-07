import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStudentIdForUser } from "@/lib/ucat/ucat-subscription";
import { countPracticeDayCreditsInBillingPeriod } from "@/lib/ucat/practice-day-discount";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import { isUcatBillingInterval } from "@altitutor/shared";

/**
 * GET /api/ucat/subscription/practice-discount-progress
 * Earned vs cap for the current Stripe billing period.
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const ucatSubjectId = await getUcatSubjectId(supabaseAdmin);
  if (!ucatSubjectId) {
    return NextResponse.json({ error: "UCAT not configured" }, { status: 404 });
  }

  const [{ data: student }, { data: subscription }] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("timezone")
      .eq("id", studentId)
      .maybeSingle(),
    supabaseAdmin
      .from("student_subscriptions")
      .select(
        "billing_interval, current_period_start, current_period_end, status",
      )
      .eq("student_id", studentId)
      .eq("subject_id", ucatSubjectId)
      .in("status", ["trialing", "active", "past_due", "unpaid"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!subscription?.billing_interval) {
    return NextResponse.json({ earned: 0, cap: 0, discountPerDayCents: 0 });
  }

  const interval = subscription.billing_interval;
  if (!isUcatBillingInterval(interval)) {
    return NextResponse.json({ earned: 0, cap: 0, discountPerDayCents: 0 });
  }

  const { data: rule } = await supabaseAdmin
    .from("ucat_practice_day_discount_config")
    .select("discount_per_day_cents, max_discounts_per_period")
    .eq("billing_interval", interval)
    .maybeSingle();

  const tz = student?.timezone ?? "Australia/Adelaide";
  const earned = await countPracticeDayCreditsInBillingPeriod(
    supabaseAdmin,
    studentId,
    subscription.current_period_start,
    subscription.current_period_end,
    tz,
  );

  return NextResponse.json({
    earned,
    cap: rule?.max_discounts_per_period ?? 0,
    discountPerDayCents: rule?.discount_per_day_cents ?? 0,
    billingInterval: interval,
  });
}
