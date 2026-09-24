import { assertEquals } from "jsr:@std/assert";
import {
  chooseLifecycleCampaign,
  hasUsefulWeeklyEvidence,
  type CampaignControl,
  type LifecycleCandidate,
  type LifecycleTopic,
} from "./logic.ts";

const candidate: LifecycleCandidate = {
  student_id: "student-1",
  auth_user_id: "user-1",
  email: "student@example.com",
  first_name: "Sam",
  last_name: "Student",
  timezone: "Australia/Adelaide",
  status: "ACTIVE",
  ucat_signup_completed_at: "2026-07-20T00:00:00Z",
  ucat_initial_familiarity: "familiar",
  email_program_cohort: "treatment",
  email_program_bucket: 42,
  email_program_posthog_synced_at: null,
  weekly_progress_and_guidance: true,
  lessons_and_tips: true,
  product_news: true,
  offers_and_referrals: true,
  unsubscribe_token: "token",
  consent_verified_at: "2026-07-20T00:00:00Z",
  unsubscribed_at: null,
  online_tier: "free",
  unlimited_started_at: null,
  billing_interval: null,
  last_activity_at: null,
  questions_last_7_days: 0,
  sets_last_7_days: 0,
  mocks_last_7_days: 0,
  active_days_last_7_days: 0,
  active_days_last_14_days: 0,
  qualifying_days_last_7_days: 0,
  has_study_plan: false,
  next_step_title: null,
  next_step_path: null,
  current_estimate: null,
  first_estimate_generated_at: null,
  previous_week_estimate: null,
  last_quota_reached_at: null,
  last_quota_area: null,
  has_open_referral_or_reward: false,
  min_questions_per_day: 10,
  currency: "AUD",
  monthly_base_price_cents: 4900,
  monthly_discount_per_day_cents: 100,
  monthly_max_discount_days: 12,
  last_optional_sent_at: null,
  last_restart_sent_at: null,
  last_upgrade_sent_at: null,
  last_referral_sent_at: null,
  sent_onboarding_starting_point: false,
  sent_onboarding_technique: false,
  sent_onboarding_timing: false,
  sent_onboarding_plan: false,
  sent_first_score_estimate: false,
};

const topics: Record<string, LifecycleTopic> = {
  onboarding_starting_point: "lessons_and_tips",
  onboarding_technique: "lessons_and_tips",
  onboarding_timing: "lessons_and_tips",
  onboarding_plan: "lessons_and_tips",
  first_score_estimate: "weekly_progress_and_guidance",
  weekly_review: "weekly_progress_and_guidance",
  gentle_restart: "weekly_progress_and_guidance",
  upgrade_quota: "offers_and_referrals",
  upgrade_consistency: "offers_and_referrals",
  referral_invitation: "offers_and_referrals",
};
const priority: Record<string, number> = {
  first_score_estimate: 100,
  weekly_review: 90,
  onboarding_starting_point: 80,
  onboarding_technique: 80,
  onboarding_timing: 80,
  onboarding_plan: 80,
  gentle_restart: 70,
  upgrade_quota: 60,
  upgrade_consistency: 50,
  referral_invitation: 50,
};
const controls = new Map<string, CampaignControl>(
  Object.keys(topics).map((key) => [
    key,
    {
      campaign_key: key,
      enabled: true,
      priority: priority[key],
      cooldown_days:
        key === "gentle_restart" || key.startsWith("upgrade_")
          ? 30
          : key === "referral_invitation"
            ? 60
            : 0,
      topic: topics[key],
    },
  ]),
);

Deno.test("suppresses unverified, unsubscribed, and holdout candidates", () => {
  const now = new Date("2026-07-20T23:30:00Z");
  assertEquals(
    chooseLifecycleCampaign(
      { ...candidate, consent_verified_at: null },
      now,
      controls,
    ),
    null,
  );
  assertEquals(
    chooseLifecycleCampaign(
      { ...candidate, unsubscribed_at: now.toISOString() },
      now,
      controls,
    ),
    null,
  );
  assertEquals(
    chooseLifecycleCampaign(
      { ...candidate, email_program_cohort: "holdout" },
      now,
      controls,
    ),
    null,
  );
});

Deno.test("onboarding follows the four lesson windows and sequence", () => {
  assertEquals(
    chooseLifecycleCampaign(
      candidate,
      new Date("2026-07-20T23:30:00Z"),
      controls,
    )?.key,
    "onboarding_starting_point",
  );
  assertEquals(
    chooseLifecycleCampaign(
      {
        ...candidate,
        sent_onboarding_starting_point: true,
      },
      new Date("2026-07-22T23:30:00Z"),
      controls,
    )?.key,
    "onboarding_technique",
  );
  assertEquals(
    chooseLifecycleCampaign(
      {
        ...candidate,
        sent_onboarding_starting_point: true,
        sent_onboarding_technique: true,
      },
      new Date("2026-07-25T23:30:00Z"),
      controls,
    )?.key,
    "onboarding_timing",
  );
  assertEquals(
    chooseLifecycleCampaign(
      {
        ...candidate,
        sent_onboarding_starting_point: true,
        sent_onboarding_technique: true,
        sent_onboarding_timing: true,
      },
      new Date("2026-07-29T23:30:00Z"),
      controls,
    )?.key,
    "onboarding_plan",
  );
});

Deno.test(
  "first estimate takes priority and contains no commercial dependency",
  () => {
    const firstEstimate = {
      ...candidate,
      current_estimate: 2200,
      first_estimate_generated_at: "2026-07-22T12:00:00Z",
      sent_onboarding_starting_point: true,
    };
    assertEquals(
      chooseLifecycleCampaign(
        firstEstimate,
        new Date("2026-07-22T23:30:00Z"),
        controls,
      )?.key,
      "first_score_estimate",
    );
  },
);

Deno.test("a priority score email delays rather than breaks onboarding", () => {
  const delayed = {
    ...candidate,
    sent_onboarding_starting_point: true,
    sent_first_score_estimate: true,
  };
  assertEquals(
    chooseLifecycleCampaign(delayed, new Date("2026-07-25T23:30:00Z"), controls)
      ?.key,
    "onboarding_technique",
  );
});

Deno.test("weekly review requires useful evidence", () => {
  assertEquals(hasUsefulWeeklyEvidence(candidate), false);
  assertEquals(
    hasUsefulWeeklyEvidence({ ...candidate, questions_last_7_days: 10 }),
    true,
  );
  assertEquals(
    hasUsefulWeeklyEvidence({ ...candidate, sets_last_7_days: 1 }),
    true,
  );
});

Deno.test("gentle restart has its own 30 day cooldown", () => {
  const mature = {
    ...candidate,
    ucat_signup_completed_at: "2026-06-01T00:00:00Z",
    last_activity_at: "2026-07-23T23:30:00Z",
    last_optional_sent_at: "2026-07-24T00:00:00Z",
  };
  const now = new Date("2026-07-30T23:30:00Z");
  assertEquals(
    chooseLifecycleCampaign(mature, now, controls)?.key,
    "gentle_restart",
  );
  assertEquals(
    chooseLifecycleCampaign(
      {
        ...mature,
        last_restart_sent_at: "2026-07-10T00:00:00Z",
      },
      now,
      controls,
    ),
    null,
  );
});

Deno.test(
  "upgrade and referral eligibility respect tier and value moment",
  () => {
    const mature = {
      ...candidate,
      ucat_signup_completed_at: "2026-06-01T00:00:00Z",
      qualifying_days_last_7_days: 2,
    };
    const now = new Date("2026-07-30T23:30:00Z");
    assertEquals(
      chooseLifecycleCampaign(mature, now, controls)?.key,
      "upgrade_consistency",
    );
    assertEquals(
      chooseLifecycleCampaign(
        {
          ...mature,
          online_tier: "unlimited",
          unlimited_started_at: "2026-07-01T00:00:00Z",
          active_days_last_14_days: 3,
        },
        now,
        controls,
      )?.key,
      "referral_invitation",
    );
  },
);
