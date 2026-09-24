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
  dayOfMonthLabel: string;
  questionsDone: number;
  minQuestions: number;
  earnedCredit: boolean;
  isToday: boolean;
  isBillingDate: boolean;
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
  /** Rolling window of practice days ending today (7 for weekly, 30 otherwise). */
  recentDays: PracticeDiscountDayEntry[];
  recentDaysWindowDays: number;
};

/** Days to show on the practice-discount streak strip. */
export function practiceDiscountRecentWindowDays(
  billingInterval: UcatBillingInterval | null,
): number {
  return billingInterval === "week" ? 7 : 30;
}

function weekdayShort(dateStr: string, timezone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: timezone,
  }).format(instant);
}

function dayOfMonthLabel(dateStr: string): string {
  const day = Number(dateStr.split("-")[2]);
  return Number.isFinite(day) ? String(day) : dateStr;
}

/** Last N calendar days ending today in the student's timezone. */
export function localDatesEndingToday(
  timezone: string,
  count: number,
): string[] {
  const dates: string[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const instant = new Date(now - i * 86_400_000);
    dates.push(localDateStringInTimezone(instant, timezone));
  }
  return dates;
}

/**
 * Prefer the upcoming invoice date when it falls in the window; otherwise the
 * period start (last charge). If neither exact date is present, match by
 * weekday (weekly) or day-of-month (monthly/yearly).
 */
export function resolveBillingDateInWindow(
  dates: string[],
  periodStartIso: string | null,
  periodEndIso: string | null,
  timezone: string,
  billingInterval: UcatBillingInterval | null,
): string | null {
  if (dates.length === 0) return null;

  const endDate = periodEndIso
    ? localDateStringInTimezone(new Date(periodEndIso), timezone)
    : null;
  const startDate = periodStartIso
    ? localDateStringInTimezone(new Date(periodStartIso), timezone)
    : null;

  if (endDate && dates.includes(endDate)) return endDate;
  if (startDate && dates.includes(startDate)) return startDate;

  const anchor = endDate ?? startDate;
  if (!anchor) return null;

  if (billingInterval === "week") {
    const targetWeekday = weekdayShort(anchor, timezone);
    for (let i = dates.length - 1; i >= 0; i -= 1) {
      const date = dates[i];
      if (date && weekdayShort(date, timezone) === targetWeekday) {
        return date;
      }
    }
    return null;
  }

  const targetDay = dayOfMonthLabel(anchor);
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const date = dates[i];
    if (date && dayOfMonthLabel(date) === targetDay) {
      return date;
    }
  }
  return null;
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

export function buildPracticeProgress(
  minQuestions: number,
  tz: string,
  attemptRows: { attempted_at: string | null }[] | null,
  earnedCreditDates: Set<string>,
  windowDays: number,
  billingDate: string | null,
): Pick<
  PracticeDiscountDashboardStatus,
  "today" | "recentDays" | "recentDaysWindowDays"
> {
  const todayStr = todayLocalDateString(tz);
  const recentDates = localDatesEndingToday(tz, windowDays);
  const fromDate = recentDates[0] ?? todayStr;
  const toDate = recentDates[recentDates.length - 1] ?? todayStr;

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

  const recentDays: PracticeDiscountDayEntry[] = recentDates.map((date) => {
    const questionsDone = attemptsByDate.get(date) ?? 0;
    const earnedCredit = earnedCreditDates.has(date);
    const isToday = date === todayStr;
    return {
      date,
      weekdayLabel: weekdayShort(date, tz),
      dayOfMonthLabel: dayOfMonthLabel(date),
      questionsDone,
      minQuestions,
      earnedCredit,
      isToday,
      isBillingDate: billingDate === date,
      status: deriveDayStatus(
        earnedCredit,
        isToday,
        questionsDone,
        minQuestions,
      ),
    };
  });

  return {
    today: {
      questionsDone: todayQuestions,
      minQuestions,
      remainingQuestions: todayRemaining,
      earnedCredit: todayEarned,
    },
    recentDays,
    recentDaysWindowDays: windowDays,
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
    recentDays: [],
    recentDaysWindowDays: 7,
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
        .in("status", ["trialing", "active", "past_due"])
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

  const billingInterval =
    subscription?.billing_interval &&
    isUcatBillingInterval(subscription.billing_interval)
      ? subscription.billing_interval
      : null;

  const windowDays = practiceDiscountRecentWindowDays(billingInterval);

  if (!subscription) {
    return {
      ...empty,
      minQuestionsPerDay: minQuestions,
      currency,
      recentDaysWindowDays: windowDays,
    };
  }

  const lookbackStart = new Date(
    Date.now() - windowDays * 86_400_000,
  ).toISOString();

  const [{ data: attemptRows }, { data: creditRows }] = await Promise.all([
    supabase
      .from("student_question_attempts")
      .select("attempted_at")
      .eq("student_id", studentId)
      .eq("is_submitted", true)
      .not("answer_snapshot", "is", null)
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

  const recentDates = localDatesEndingToday(tz, windowDays);
  const billingDate = resolveBillingDateInWindow(
    recentDates,
    subscription.current_period_start,
    subscription.current_period_end,
    tz,
    billingInterval,
  );

  const progress = buildPracticeProgress(
    minQuestions,
    tz,
    attemptRows,
    earnedCreditDates,
    windowDays,
    billingDate,
  );

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
