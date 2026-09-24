export type LifecycleTopic =
  | "weekly_progress_and_guidance"
  | "lessons_and_tips"
  | "product_news"
  | "offers_and_referrals";

export type UcatFamiliarity = "new" | "familiar" | "experienced";

export type LifecycleCampaignKey =
  | "onboarding_starting_point"
  | "onboarding_technique"
  | "onboarding_timing"
  | "onboarding_plan"
  | "first_score_estimate"
  | "weekly_review"
  | "gentle_restart"
  | "upgrade_quota"
  | "upgrade_consistency"
  | "referral_invitation";

export type LifecycleCandidate = {
  student_id: string;
  auth_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  timezone: string | null;
  status: string | null;
  ucat_signup_completed_at: string | null;
  ucat_initial_familiarity: UcatFamiliarity | null;
  email_program_cohort: "treatment" | "holdout" | null;
  email_program_bucket: number | null;
  email_program_posthog_synced_at: string | null;
  weekly_progress_and_guidance: boolean;
  lessons_and_tips: boolean;
  product_news: boolean;
  offers_and_referrals: boolean;
  unsubscribe_token: string;
  consent_verified_at: string | null;
  unsubscribed_at: string | null;
  online_tier: string | null;
  unlimited_started_at: string | null;
  billing_interval: string | null;
  last_activity_at: string | null;
  questions_last_7_days: number | null;
  sets_last_7_days: number | null;
  mocks_last_7_days: number | null;
  active_days_last_7_days: number | null;
  active_days_last_14_days: number | null;
  qualifying_days_last_7_days: number | null;
  has_study_plan: boolean | null;
  next_step_title: string | null;
  next_step_path: string | null;
  current_estimate: number | null;
  first_estimate_generated_at: string | null;
  previous_week_estimate: number | null;
  last_quota_reached_at: string | null;
  last_quota_area: string | null;
  has_open_referral_or_reward: boolean | null;
  min_questions_per_day: number | null;
  currency: string | null;
  monthly_base_price_cents: number | null;
  monthly_discount_per_day_cents: number | null;
  monthly_max_discount_days: number | null;
  last_optional_sent_at: string | null;
  last_restart_sent_at: string | null;
  last_upgrade_sent_at: string | null;
  last_referral_sent_at: string | null;
  sent_onboarding_starting_point: boolean | null;
  sent_onboarding_technique: boolean | null;
  sent_onboarding_timing: boolean | null;
  sent_onboarding_plan: boolean | null;
  sent_first_score_estimate: boolean | null;
};

export type CampaignControl = {
  campaign_key: string;
  enabled: boolean;
  priority: number;
  cooldown_days: number;
  topic: LifecycleTopic;
};

export type LifecycleCampaign = {
  key: LifecycleCampaignKey;
  topic: LifecycleTopic;
  dedupeKey: string;
  priority: number;
  evidence: Record<string, unknown>;
};

type LocalParts = {
  dateKey: string;
  hour: number;
  weekday: string;
};

const DAY_MS = 86_400_000;
const OPTIONAL_COLLISION_HOURS = 36;

function safeTimezone(timezone: string | null): string {
  const candidate = timezone || "Australia/Adelaide";
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "Australia/Adelaide";
  }
}

function partsAt(date: Date, timezone: string): LocalParts {
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
  return Math.floor(
    Date.parse(`${partsAt(date, timezone).dateKey}T00:00:00Z`) / DAY_MS,
  );
}

function localDaysSince(value: string, now: Date, timezone: string): number {
  return (
    localDayNumber(now, timezone) - localDayNumber(new Date(value), timezone)
  );
}

function hoursSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? (now.getTime() - parsed) / 3_600_000 : null;
}

function weekKey(now: Date, timezone: string): string {
  const local = new Date(`${partsAt(now, timezone).dateKey}T00:00:00Z`);
  local.setUTCDate(local.getUTCDate() - local.getUTCDay());
  return local.toISOString().slice(0, 10);
}

function monthKey(now: Date, timezone: string): string {
  return partsAt(now, timezone).dateKey.slice(0, 7);
}

function hasTopicConsent(
  candidate: LifecycleCandidate,
  topic: LifecycleTopic,
): boolean {
  return candidate[topic];
}

function enabledControl(
  controls: ReadonlyMap<string, CampaignControl>,
  key: LifecycleCampaignKey,
): CampaignControl | null {
  const control = controls.get(key);
  return control?.enabled ? control : null;
}

function cooldownPassed(
  lastSentAt: string | null,
  now: Date,
  cooldownDays: number,
): boolean {
  const elapsed = hoursSince(lastSentAt, now);
  return elapsed == null || elapsed >= cooldownDays * 24;
}

function campaign(
  candidate: LifecycleCandidate,
  controls: ReadonlyMap<string, CampaignControl>,
  key: LifecycleCampaignKey,
  dedupeKey: string,
  evidence: Record<string, unknown>,
): LifecycleCampaign | null {
  const control = enabledControl(controls, key);
  if (!control || !hasTopicConsent(candidate, control.topic)) return null;
  return {
    key,
    topic: control.topic,
    dedupeKey,
    priority: control.priority,
    evidence,
  };
}

export function hasUsefulWeeklyEvidence(
  candidate: LifecycleCandidate,
): boolean {
  return (
    (candidate.questions_last_7_days ?? 0) >= 10 ||
    (candidate.sets_last_7_days ?? 0) >= 1 ||
    (candidate.mocks_last_7_days ?? 0) >= 1
  );
}

export function chooseLifecycleCampaign(
  candidate: LifecycleCandidate,
  now: Date,
  controls: ReadonlyMap<string, CampaignControl>,
): LifecycleCampaign | null {
  if (
    candidate.status !== "ACTIVE" ||
    !candidate.consent_verified_at ||
    candidate.unsubscribed_at ||
    !candidate.ucat_signup_completed_at ||
    !candidate.ucat_initial_familiarity ||
    candidate.email_program_cohort !== "treatment"
  ) {
    return null;
  }

  const timezone = safeTimezone(candidate.timezone);
  const local = partsAt(now, timezone);
  const signupDays = localDaysSince(
    candidate.ucat_signup_completed_at,
    now,
    timezone,
  );
  const sinceLastOptional = hoursSince(candidate.last_optional_sent_at, now);
  if (
    sinceLastOptional != null &&
    sinceLastOptional >= 0 &&
    sinceLastOptional < OPTIONAL_COLLISION_HOURS
  ) {
    return null;
  }

  const eligible: LifecycleCampaign[] = [];
  const studentKey = candidate.student_id;

  if (
    local.hour === 9 &&
    candidate.current_estimate != null &&
    candidate.first_estimate_generated_at &&
    !candidate.sent_first_score_estimate
  ) {
    const estimateAgeHours = hoursSince(
      candidate.first_estimate_generated_at,
      now,
    );
    if (
      estimateAgeHours != null &&
      estimateAgeHours >= 0 &&
      estimateAgeHours <= 48
    ) {
      const selected = campaign(
        candidate,
        controls,
        "first_score_estimate",
        `first_score_estimate:${studentKey}`,
        {
          current_estimate: candidate.current_estimate,
          first_estimate_generated_at: candidate.first_estimate_generated_at,
        },
      );
      if (selected) eligible.push(selected);
    }
  }

  if (local.hour === 9 && signupDays >= 0 && signupDays <= 18) {
    const familiarity = candidate.ucat_initial_familiarity;
    if (signupDays <= 4 && !candidate.sent_onboarding_starting_point) {
      const selected = campaign(
        candidate,
        controls,
        "onboarding_starting_point",
        `onboarding_starting_point:${studentKey}`,
        { familiarity, signup_days: signupDays },
      );
      if (selected) eligible.push(selected);
    } else if (
      signupDays >= 2 &&
      signupDays <= 7 &&
      candidate.sent_onboarding_starting_point &&
      !candidate.sent_onboarding_technique
    ) {
      const selected = campaign(
        candidate,
        controls,
        "onboarding_technique",
        `onboarding_technique:${studentKey}`,
        { familiarity, signup_days: signupDays },
      );
      if (selected) eligible.push(selected);
    } else if (
      signupDays >= 5 &&
      signupDays <= 11 &&
      candidate.sent_onboarding_technique &&
      !candidate.sent_onboarding_timing
    ) {
      const selected = campaign(
        candidate,
        controls,
        "onboarding_timing",
        `onboarding_timing:${studentKey}`,
        { familiarity, signup_days: signupDays },
      );
      if (selected) eligible.push(selected);
    } else if (
      signupDays >= 9 &&
      signupDays <= 18 &&
      candidate.sent_onboarding_timing &&
      !candidate.sent_onboarding_plan
    ) {
      const selected = campaign(
        candidate,
        controls,
        "onboarding_plan",
        `onboarding_plan:${studentKey}`,
        {
          familiarity,
          signup_days: signupDays,
          has_study_plan: Boolean(candidate.has_study_plan),
        },
      );
      if (selected) eligible.push(selected);
    }
  }

  if (
    local.weekday === "Sun" &&
    local.hour === 16 &&
    signupDays >= 10 &&
    hasUsefulWeeklyEvidence(candidate)
  ) {
    const selected = campaign(
      candidate,
      controls,
      "weekly_review",
      `weekly_review:${studentKey}:${weekKey(now, timezone)}`,
      {
        questions_last_7_days: candidate.questions_last_7_days ?? 0,
        sets_last_7_days: candidate.sets_last_7_days ?? 0,
        mocks_last_7_days: candidate.mocks_last_7_days ?? 0,
        active_days_last_7_days: candidate.active_days_last_7_days ?? 0,
        current_estimate: candidate.current_estimate,
        previous_week_estimate: candidate.previous_week_estimate,
      },
    );
    if (selected) eligible.push(selected);
  }

  if (local.hour === 9 && signupDays >= 10 && candidate.last_activity_at) {
    const inactiveDays = localDaysSince(
      candidate.last_activity_at,
      now,
      timezone,
    );
    const control = enabledControl(controls, "gentle_restart");
    if (
      control &&
      inactiveDays >= 7 &&
      inactiveDays <= 9 &&
      cooldownPassed(candidate.last_restart_sent_at, now, control.cooldown_days)
    ) {
      const selected = campaign(
        candidate,
        controls,
        "gentle_restart",
        `gentle_restart:${studentKey}:${candidate.last_activity_at}`,
        {
          inactive_days: inactiveDays,
          has_study_plan: Boolean(candidate.has_study_plan),
        },
      );
      if (selected) eligible.push(selected);
    }
  }

  if (
    local.hour === 9 &&
    signupDays >= 10 &&
    candidate.online_tier === "free"
  ) {
    const quotaControl = enabledControl(controls, "upgrade_quota");
    const quotaAgeHours = hoursSince(candidate.last_quota_reached_at, now);
    if (
      quotaControl &&
      quotaAgeHours != null &&
      quotaAgeHours >= 24 &&
      quotaAgeHours <= 168 &&
      cooldownPassed(
        candidate.last_upgrade_sent_at,
        now,
        quotaControl.cooldown_days,
      )
    ) {
      const selected = campaign(
        candidate,
        controls,
        "upgrade_quota",
        `upgrade_quota:${studentKey}:${candidate.last_quota_reached_at}`,
        {
          quota_area: candidate.last_quota_area,
          quota_reached_at: candidate.last_quota_reached_at,
        },
      );
      if (selected) eligible.push(selected);
    }

    const consistencyControl = enabledControl(controls, "upgrade_consistency");
    if (
      consistencyControl &&
      (candidate.qualifying_days_last_7_days ?? 0) >= 2 &&
      cooldownPassed(
        candidate.last_upgrade_sent_at,
        now,
        consistencyControl.cooldown_days,
      )
    ) {
      const selected = campaign(
        candidate,
        controls,
        "upgrade_consistency",
        `upgrade_consistency:${studentKey}:${monthKey(now, timezone)}`,
        {
          qualifying_days_last_7_days:
            candidate.qualifying_days_last_7_days ?? 0,
          min_questions_per_day: candidate.min_questions_per_day,
        },
      );
      if (selected) eligible.push(selected);
    }
  }

  if (
    local.hour === 9 &&
    signupDays >= 10 &&
    candidate.online_tier === "unlimited" &&
    candidate.unlimited_started_at &&
    !candidate.has_open_referral_or_reward
  ) {
    const unlimitedDays = localDaysSince(
      candidate.unlimited_started_at,
      now,
      timezone,
    );
    const referralControl = enabledControl(controls, "referral_invitation");
    const hasValueMoment =
      candidate.current_estimate != null ||
      (candidate.active_days_last_14_days ?? 0) >= 3;
    if (
      referralControl &&
      unlimitedDays >= 7 &&
      hasValueMoment &&
      cooldownPassed(
        candidate.last_referral_sent_at,
        now,
        referralControl.cooldown_days,
      )
    ) {
      const selected = campaign(
        candidate,
        controls,
        "referral_invitation",
        `referral_invitation:${studentKey}:${monthKey(now, timezone)}`,
        {
          billing_interval: candidate.billing_interval,
          active_days_last_14_days: candidate.active_days_last_14_days ?? 0,
          has_score_estimate: candidate.current_estimate != null,
        },
      );
      if (selected) eligible.push(selected);
    }
  }

  eligible.sort((left, right) => right.priority - left.priority);
  return eligible[0] ?? null;
}
