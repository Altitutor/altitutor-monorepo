import {
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert";
import { buildLifecycleEmail } from "./email.ts";
import type { LifecycleCampaign, LifecycleCandidate } from "./logic.ts";

const candidate: LifecycleCandidate = {
  student_id: "student-1",
  email: "student@example.com",
  first_name: "Sam",
  timezone: "Australia/Adelaide",
  status: "ACTIVE",
  ucat_signup_completed_at: "2026-07-20T00:00:00Z",
  weekly_progress_and_guidance: true,
  lessons_and_tips: true,
  product_news: true,
  offers_and_referrals: true,
  unsubscribe_token: "token",
  consent_verified_at: "2026-07-20T00:00:00Z",
  unsubscribed_at: null,
  last_activity_at: "2026-07-29T00:00:00Z",
  questions_last_7_days: 86,
  sets_last_7_days: 4,
  mocks_last_7_days: 1,
  has_study_plan: true,
  next_step_title: "a focused Quantitative Reasoning set",
  next_step_path: "/practice",
  current_estimate: 2250,
  score_confidence: "medium",
};

function campaign(key: LifecycleCampaign["key"]): LifecycleCampaign {
  return {
    key,
    topic: key === "weekly_progress"
      ? "weekly_progress_and_guidance"
      : "lessons_and_tips",
    dedupeKey: `test:${key}`,
  };
}

Deno.test("weekly progress contains personal evidence and a useful next action", () => {
  const email = buildLifecycleEmail(candidate, campaign("weekly_progress"));

  assertStringIncludes(email.subject, "86 questions");
  assertStringIncludes(email.html, ">86<");
  assertStringIncludes(email.html, "Estimate forming");
  assertStringIncludes(email.html, "a focused Quantitative Reasoning set");
  assertStringIncludes(
    email.text,
    "review incorrect and unusually slow answers",
  );
});

Deno.test("primary calls to action include stable campaign attribution", () => {
  const email = buildLifecycleEmail(candidate, campaign("onboarding_plan"));

  assertStringIncludes(email.actionUrl, "/study-plan/setup?");
  assertStringIncludes(email.actionUrl, "utm_source=altitutor");
  assertStringIncludes(email.actionUrl, "utm_medium=email");
  assertStringIncludes(email.actionUrl, "utm_campaign=ucat_onboarding_plan");
  assertEquals(email.campaignData.name, "ucat_onboarding_plan");
  assertEquals(
    email.tags.find((tag) => tag.name === "campaign")?.value,
    "onboarding_plan",
  );
});

Deno.test("candidate content is escaped in both copy and product modules", () => {
  const unsafe = {
    ...candidate,
    first_name: "<script>alert(1)</script>",
    next_step_title: "<img src=x onerror=alert(1)>",
  };
  const email = buildLifecycleEmail(unsafe, campaign("inactive_7_days"));

  assertFalse(email.html.includes("<script>alert(1)</script>"));
  assertFalse(email.html.includes("<img src=x onerror=alert(1)>"));
  assertStringIncludes(email.html, "&lt;script&gt;alert(1)&lt;/script&gt;");
  assertStringIncludes(email.html, "&lt;img src=x onerror=alert(1)&gt;");
});

Deno.test("Free access email explains resets without promising fixed allowance counts", () => {
  const email = buildLifecycleEmail(
    candidate,
    campaign("onboarding_free_forever"),
  );

  assertStringIncludes(email.html, "exact reset timing");
  assertStringIncludes(
    email.html,
    "does not erase your history or end your Free access",
  );
  assertFalse(email.text.includes("free trial"));
});
