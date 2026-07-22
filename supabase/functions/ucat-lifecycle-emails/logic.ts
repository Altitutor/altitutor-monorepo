export type LifecycleTopic =
  | "weekly_progress_and_guidance"
  | "lessons_and_tips"
  | "product_news"
  | "offers_and_referrals";

export type LifecycleCandidate = {
  student_id: string;
  email: string;
  first_name: string | null;
  timezone: string | null;
  status: string | null;
  ucat_signup_completed_at: string | null;
  weekly_progress_and_guidance: boolean;
  lessons_and_tips: boolean;
  product_news: boolean;
  offers_and_referrals: boolean;
  unsubscribe_token: string;
  consent_verified_at: string | null;
  unsubscribed_at: string | null;
  last_activity_at: string | null;
  questions_last_7_days: number | null;
  sets_last_7_days: number | null;
  mocks_last_7_days: number | null;
  has_study_plan: boolean | null;
  next_step_title: string | null;
  next_step_path: string | null;
  current_estimate: number | null;
  score_confidence: string | null;
};

export type LifecycleCampaign = {
  key: "onboarding_welcome" | "onboarding_first_signal" | "onboarding_plan" |
    "onboarding_tracking" | "onboarding_free_forever" | "inactive_7_days" |
    "weekly_progress";
  topic: LifecycleTopic;
  dedupeKey: string;
};

function partsAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    weekday: value("weekday"),
  };
}

function localDayNumber(date: Date, timezone: string): number {
  const key = partsAt(date, timezone).dateKey;
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

function localDaysSince(value: string, now: Date, timezone: string): number {
  return localDayNumber(now, timezone) - localDayNumber(new Date(value), timezone);
}

function weeklyKey(now: Date, timezone: string): string {
  const local = partsAt(now, timezone).dateKey;
  const date = new Date(`${local}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function hasUsefulWeeklyEvidence(candidate: LifecycleCandidate): boolean {
  return (candidate.questions_last_7_days ?? 0) >= 10 ||
    (candidate.sets_last_7_days ?? 0) >= 1 ||
    (candidate.mocks_last_7_days ?? 0) >= 1;
}

export function chooseLifecycleCampaign(
  candidate: LifecycleCandidate,
  now: Date,
): LifecycleCampaign | null {
  if (
    candidate.status !== "ACTIVE" || !candidate.consent_verified_at ||
    candidate.unsubscribed_at || !candidate.ucat_signup_completed_at
  ) return null;

  let timezone = candidate.timezone || "Australia/Adelaide";
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: timezone }).format(now);
  } catch {
    timezone = "Australia/Adelaide";
  }
  const local = partsAt(now, timezone);
  if (local.hour !== 9) return null;

  const signupDays = localDaysSince(candidate.ucat_signup_completed_at, now, timezone);
  const evidence = hasUsefulWeeklyEvidence(candidate);
  const studentKey = candidate.student_id;

  if (signupDays >= 0 && signupDays <= 1 && candidate.lessons_and_tips) {
    return { key: "onboarding_welcome", topic: "lessons_and_tips", dedupeKey: `onboarding_welcome:${studentKey}` };
  }
  if (signupDays >= 1 && signupDays <= 2 && candidate.lessons_and_tips && !candidate.last_activity_at) {
    return { key: "onboarding_first_signal", topic: "lessons_and_tips", dedupeKey: `onboarding_first_signal:${studentKey}` };
  }
  if (signupDays >= 3 && signupDays <= 4 && candidate.lessons_and_tips && !candidate.has_study_plan) {
    return { key: "onboarding_plan", topic: "lessons_and_tips", dedupeKey: `onboarding_plan:${studentKey}` };
  }
  if (signupDays >= 5 && signupDays <= 6 && candidate.lessons_and_tips && evidence && candidate.current_estimate) {
    return { key: "onboarding_tracking", topic: "lessons_and_tips", dedupeKey: `onboarding_tracking:${studentKey}` };
  }
  if (signupDays >= 7 && signupDays <= 9 && candidate.lessons_and_tips) {
    return { key: "onboarding_free_forever", topic: "lessons_and_tips", dedupeKey: `onboarding_free_forever:${studentKey}` };
  }

  if (candidate.weekly_progress_and_guidance && candidate.last_activity_at) {
    const inactiveDays = localDaysSince(candidate.last_activity_at, now, timezone);
    if (inactiveDays === 7) {
      return {
        key: "inactive_7_days",
        topic: "weekly_progress_and_guidance",
        dedupeKey: `inactive_7_days:${studentKey}:${candidate.last_activity_at}`,
      };
    }
  }

  if (candidate.weekly_progress_and_guidance && signupDays >= 10 && local.weekday === "Mon" && evidence) {
    return {
      key: "weekly_progress",
      topic: "weekly_progress_and_guidance",
      dedupeKey: `weekly_progress:${studentKey}:${weeklyKey(now, timezone)}`,
    };
  }
  return null;
}
