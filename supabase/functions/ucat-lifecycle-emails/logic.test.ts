import { assertEquals } from "jsr:@std/assert";
import { chooseLifecycleCampaign, hasUsefulWeeklyEvidence, type LifecycleCandidate } from "./logic.ts";

const candidate: LifecycleCandidate = {
  student_id: "student-1", email: "student@example.com", first_name: "Sam",
  timezone: "Australia/Adelaide", status: "ACTIVE",
  ucat_signup_completed_at: "2026-07-20T00:00:00Z",
  weekly_progress_and_guidance: true, lessons_and_tips: true,
  product_news: true, offers_and_referrals: true,
  unsubscribe_token: "token", consent_verified_at: "2026-07-20T00:00:00Z",
  unsubscribed_at: null, last_activity_at: null,
  questions_last_7_days: 0, sets_last_7_days: 0, mocks_last_7_days: 0,
  has_study_plan: false, next_step_title: null, next_step_path: null,
  current_estimate: null, score_confidence: null,
};

Deno.test("suppresses candidates without verified active consent", () => {
  assertEquals(chooseLifecycleCampaign({ ...candidate, consent_verified_at: null }, new Date("2026-07-20T23:30:00Z")), null);
  assertEquals(chooseLifecycleCampaign({ ...candidate, unsubscribed_at: "2026-07-20T01:00:00Z" }, new Date("2026-07-20T23:30:00Z")), null);
});

Deno.test("requires enough evidence for a weekly progress email", () => {
  assertEquals(hasUsefulWeeklyEvidence(candidate), false);
  assertEquals(hasUsefulWeeklyEvidence({ ...candidate, questions_last_7_days: 10 }), true);
  assertEquals(hasUsefulWeeklyEvidence({ ...candidate, sets_last_7_days: 1 }), true);
});

Deno.test("onboarding reacts to completed actions", () => {
  const now = new Date("2026-07-22T23:30:00Z"); // 09:00 Adelaide, three local days after signup.
  assertEquals(chooseLifecycleCampaign(candidate, now)?.key, "onboarding_plan");
  assertEquals(chooseLifecycleCampaign({ ...candidate, has_study_plan: true }, now), null);
});

Deno.test("welcome remains eligible the next local morning", () => {
  const now = new Date("2026-07-20T23:30:00Z");
  assertEquals(chooseLifecycleCampaign(candidate, now)?.key, "onboarding_welcome");
});

Deno.test("topic opt-outs are respected independently", () => {
  const onboardingNow = new Date("2026-07-22T23:30:00Z");
  assertEquals(chooseLifecycleCampaign({ ...candidate, lessons_and_tips: false }, onboardingNow), null);

  const inactive = {
    ...candidate,
    ucat_signup_completed_at: "2026-06-01T00:00:00Z",
    last_activity_at: "2026-07-14T23:30:00Z",
    weekly_progress_and_guidance: false,
  };
  assertEquals(chooseLifecycleCampaign(inactive, new Date("2026-07-21T23:30:00Z")), null);
});

Deno.test("inactivity is emitted only on the seventh local day", () => {
  const mature = { ...candidate, ucat_signup_completed_at: "2026-06-01T00:00:00Z", last_activity_at: "2026-07-14T23:30:00Z" };
  assertEquals(chooseLifecycleCampaign(mature, new Date("2026-07-21T23:30:00Z"))?.key, "inactive_7_days");
  assertEquals(chooseLifecycleCampaign(mature, new Date("2026-07-22T23:30:00Z")), null);
});
