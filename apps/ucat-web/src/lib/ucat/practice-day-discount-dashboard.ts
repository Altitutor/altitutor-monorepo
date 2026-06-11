import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UcatBillingInterval } from "@altitutor/shared";
import { isUcatBillingInterval } from "@altitutor/shared";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import {
  isCreditDateInBillingPeriod,
  localDateStringInTimezone,
  todayLocalDateString,
} from "@/lib/ucat/practice-day-discount-period";

export type PracticeDiscountDayStatus = "earned" | "in_progress" | "missed";

export type PracticeDiscountDayEntry = {
  date: string;
  weekdayLabel: string;
  questionsDone: number;
  minQuestions: number;
  earnedCredit: boolean;
  isToday: boolean;
  status: PracticeDiscountDayStatus;
};

export type PracticeDiscountDashboardStatus = {
  eligible: boolean;
  minQuestionsPerDay: number;
  discountPerDayCents: number;
  billingInterval: UcatBillingInterval | null;
  currency: string;
  earned: number;
  cap: number;
  totalDiscountCents: number;
  periodCapReached: boolean;
  today: {
    questionsDone: number;
    minQuestions: number;
    remainingQuestions: number;
    earnedCredit: boolean;
  };
  lastSevenDays: PracticeDiscountDayEntry[];
};

function weekdayShort(dateStr: string, timezone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: timezone,
  }).format(instant);
}

/** Last N calendar days ending today in the student's timezone. */
export function localDatesEndingToday(timezone: string, count: number): string[] {
  const dates: string[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const instant = new Date(now - i * 86_400_000);
    dates.push(localDateStringInTimezone(instant, timezone));
  }
  return dates;
}

function deriveDayStatus(
  earnedCredit: boolean,
  isToday: boolean,
  questionsDone: number,
  minQuestions: number,
): PracticeDiscountDayStatus {
  if (earnedCredit) return "earned";
  if (isToday && questionsDone < minQuestions) return "in_progress";
  if (isToday) return "in_progress";
  return "missed";
}

function buildPracticeProgress(
  minQuestions: number,
  tz: string,
  attemptRows: { attempted_at: string | null }[] | null,
  earnedCreditDates: Set<string>,
): Pick<
  PracticeDiscountDashboardStatus,
  "today" | "lastSevenDays"
> {
  const todayStr = todayLocalDateString(tz);
  const lastSevenDates = localDatesEndingToday(tz, 7);
  const fromDate = lastSevenDates[0] ?? todayStr;
  const toDate = lastSevenDates[lastSevenDates.length - 1] ?? todayStr;

  const attemptsByDate = new Map<string, number>();
  for (const row of attemptRows ?? []) {
    if (!row.attempted_at) continue;
    const dateStr = localDateStringInTimezone(new Date(row.attempted_at), tz);
    if (dateStr < fromDate || dateStr > toDate) continue;
    attemptsByDate.set(dateStr, (attemptsByDate.get(dateStr) ?? 0) + 1);
  }

  const todayQuestions = attemptsByDate.get(todayStr) ?? 0;
  const todayEarned = earnedCreditDates.has(todayStr);
  const todayRemaining = todayEarned
    ? 0
    : Math.max(0, minQuestions - todayQuestions);

  const lastSevenDays: PracticeDiscountDayEntry[] = lastSevenDates.map(
    (date) => {
      const questionsDone = attemptsByDate.get(date) ?? 0;
      const earnedCredit = earnedCreditDates.has(date);
      const isToday = date === todayStr;
      return {
        date,
        weekdayLabel: weekdayShort(date, tz),
        questionsDone,
        minQuestions,
        earnedCredit,
        isToday,
        status: deriveDayStatus(
          earnedCredit,
          isToday,
          questionsDone,
          minQuestions,
        ),
      };
    },
  );

  return {
    today: {
      questionsDone: todayQuestions,
      minQuestions,
      remainingQuestions: todayRemaining,
      earnedCredit: todayEarned,
    },
    lastSevenDays,
  };
}

export async function getPracticeDiscountDashboardStatus(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<PracticeDiscountDashboardStatus> {
  const empty: PracticeDiscountDashboardStatus = {
    eligible: false,
    minQuestionsPerDay: 0,
    discountPerDayCents: 0,
    billingInterval: null,
    currency: "aud",
    earned: 0,
    cap: 0,
    totalDiscountCents: 0,
    periodCapReached: false,
    today: {
      questionsDone: 0,
      minQuestions: 0,
      remainingQuestions: 0,
      earnedCredit: false,
    },
    lastSevenDays: [],
  };

  const ucatSubjectId = await getUcatSubjectId(supabase);
  if (!ucatSubjectId) return empty;

  const [{ data: student }, { data: subscription }, { data: config }] =
    await Promise.all([
      supabase
        .from("students")
        .select("timezone")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
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
      supabase
        .from("ucat_subscription_config")
        .select("min_questions_per_day, currency")
        .limit(1)
        .maybeSingle(),
    ]);

  const tz = student?.timezone ?? "Australia/Adelaide";
  const minQuestions = config?.min_questions_per_day ?? 20;
  const currency = (config?.currency ?? "aud").toLowerCase();

  if (!subscription) {
    return { ...empty, minQuestionsPerDay: minQuestions, currency };
  }

  const lookbackStart = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: attemptRows }, { data: creditRows }] = await Promise.all([
    supabase
      .from("student_question_attempts")
      .select("attempted_at")
      .eq("student_id", studentId)
      .eq("is_submitted", true)
      .gte("attempted_at", lookbackStart)
      .not("attempted_at", "is", null),
    supabase
      .from("student_ucat_practice_day_credits")
      .select("credit_date, discount_cents")
      .eq("student_id", studentId)
      .is("forfeited_at", null),
  ]);

  const earnedCreditDates = new Set<string>();
  for (const credit of creditRows ?? []) {
    earnedCreditDates.add(credit.credit_date);
  }

  const progress = buildPracticeProgress(
    minQuestions,
    tz,
    attemptRows,
    earnedCreditDates,
  );

  const billingInterval =
    subscription.billing_interval &&
    isUcatBillingInterval(subscription.billing_interval)
      ? subscription.billing_interval
      : null;

  if (!billingInterval) {
    return {
      eligible: false,
      minQuestionsPerDay: minQuestions,
      discountPerDayCents: 0,
      billingInterval: null,
      currency,
      earned: 0,
      cap: 0,
      totalDiscountCents: 0,
      periodCapReached: false,
      ...progress,
    };
  }

  const { data: rule } = await supabase
    .from("ucat_practice_day_discount_config")
    .select("discount_per_day_cents, max_discounts_per_period")
    .eq("billing_interval", billingInterval)
    .maybeSingle();

  const discountPerDayCents = rule?.discount_per_day_cents ?? 0;
  const cap = rule?.max_discounts_per_period ?? 0;

  if (discountPerDayCents <= 0 || cap <= 0) {
    return {
      eligible: false,
      minQuestionsPerDay: minQuestions,
      discountPerDayCents: 0,
      billingInterval,
      currency,
      earned: 0,
      cap: 0,
      totalDiscountCents: 0,
      periodCapReached: false,
      ...progress,
    };
  }

  let earned = 0;
  let totalDiscountCents = 0;

  for (const credit of creditRows ?? []) {
    if (
      isCreditDateInBillingPeriod(
        credit.credit_date,
        subscription.current_period_start,
        subscription.current_period_end,
        tz,
      )
    ) {
      earned += 1;
      totalDiscountCents += credit.discount_cents;
    }
  }

  const periodCapReached = earned >= cap;

  return {
    eligible: true,
    minQuestionsPerDay: minQuestions,
    discountPerDayCents,
    billingInterval,
    currency,
    earned,
    cap,
    totalDiscountCents,
    periodCapReached,
    ...progress,
  };
}
