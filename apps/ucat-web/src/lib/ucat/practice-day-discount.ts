import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { isUcatBillingInterval } from "@altitutor/shared";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import {
  isCreditDateInBillingPeriod,
  todayLocalDateString,
} from "@/lib/ucat/practice-day-discount-period";

export type MaybeGrantPracticeDayDiscountResult = {
  earnedDiscount: boolean;
  discountCents: number;
};

type PracticeDayDiscountRule = {
  discountPerDayCents: number;
  maxDiscountsPerPeriod: number;
};

async function getPracticeDayDiscountRule(
  supabase: SupabaseClient<Database>,
  billingInterval: string | null,
): Promise<PracticeDayDiscountRule | null> {
  if (!billingInterval || !isUcatBillingInterval(billingInterval)) {
    return null;
  }

  const { data, error } = await supabase
    .from("ucat_practice_day_discount_config")
    .select("discount_per_day_cents, max_discounts_per_period")
    .eq("billing_interval", billingInterval)
    .maybeSingle();

  if (error || !data) return null;

  return {
    discountPerDayCents: data.discount_per_day_cents ?? 0,
    maxDiscountsPerPeriod: data.max_discounts_per_period ?? 1,
  };
}

export async function countPracticeDayCreditsInBillingPeriod(
  supabase: SupabaseClient<Database>,
  studentId: string,
  periodStartIso: string | null,
  periodEndIso: string | null,
  timezone: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("student_ucat_practice_day_credits")
    .select("credit_date")
    .eq("student_id", studentId)
    .is("forfeited_at", null);

  if (error || !data) return 0;

  return data.filter((row) =>
    isCreditDateInBillingPeriod(
      row.credit_date,
      periodStartIso,
      periodEndIso,
      timezone,
    ),
  ).length;
}

/**
 * Checks if the student qualifies for a practice-day discount and grants it if so.
 * Call after submitting question attempts (e.g. completing a set or practice session).
 */
export async function maybeGrantPracticeDayDiscount(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<MaybeGrantPracticeDayDiscountResult> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, timezone")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr || !student) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const tz = student.timezone ?? "Australia/Adelaide";
  const dateStr = todayLocalDateString(tz);

  const { data: config, error: configErr } = await supabase
    .from("ucat_subscription_config")
    .select("min_questions_per_day")
    .limit(1)
    .maybeSingle();

  if (configErr || !config) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const minQuestions = config.min_questions_per_day ?? 20;

  const { data: countData, error: countErr } = await supabase.rpc(
    "count_submitted_attempts_today",
    { p_student_id: studentId, p_timezone: tz },
  );

  const count =
    typeof countData === "number"
      ? countData
      : typeof countData === "string"
        ? parseInt(countData, 10) || 0
        : 0;
  if (countErr || count < minQuestions) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const { data: existingCredit } = await supabase
    .from("student_ucat_practice_day_credits")
    .select("id")
    .eq("student_id", studentId)
    .eq("credit_date", dateStr)
    .is("forfeited_at", null)
    .maybeSingle();

  if (existingCredit) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const ucatSubjectId = await getUcatSubjectId(supabase);
  if (!ucatSubjectId) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const { data: sub } = await supabase
    .from("student_subscriptions")
    .select(
      "stripe_subscription_id, billing_interval, current_period_start, current_period_end",
    )
    .eq("student_id", studentId)
    .eq("subject_id", ucatSubjectId)
    .in("status", ["trialing", "active"])
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const rule = await getPracticeDayDiscountRule(supabase, sub.billing_interval);
  if (!rule || rule.discountPerDayCents <= 0) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const earnedInPeriod = await countPracticeDayCreditsInBillingPeriod(
    supabase,
    studentId,
    sub.current_period_start,
    sub.current_period_end,
    tz,
  );

  if (earnedInPeriod >= rule.maxDiscountsPerPeriod) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const { data: billing } = await supabase
    .from("students_billing")
    .select("stripe_customer_id")
    .eq("student_id", studentId)
    .maybeSingle();

  const customerId = billing?.stripe_customer_id;
  if (!customerId) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  const discountCents = rule.discountPerDayCents;

  let invoiceItemId: string;
  try {
    const item = await stripe.invoiceItems.create({
      customer: customerId,
      subscription: sub.stripe_subscription_id,
      amount: -discountCents,
      currency: "aud",
      description: "Practice day discount",
    });
    invoiceItemId = item.id;
  } catch {
    return { earnedDiscount: false, discountCents: 0 };
  }

  const { error: insertErr } = await supabase
    .from("student_ucat_practice_day_credits")
    .insert({
      student_id: studentId,
      credit_date: dateStr,
      stripe_invoice_item_id: invoiceItemId,
      discount_cents: discountCents,
    });

  if (insertErr) {
    return { earnedDiscount: false, discountCents: 0 };
  }

  return { earnedDiscount: true, discountCents };
}
