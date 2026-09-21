import {
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert";
import { buildLifecyclePreview } from "./email.ts";

const REPLY_HAND_FRAGMENT =
  "If you'd like a hand with this, just reply and tell me what you're finding difficult.";
const REPLY_STUCK_FRAGMENT =
  "If you have a question or aren't sure where to start, reply to this email. I'd love to help.";

Deno.test(
  "weekly review contains useful evidence and no automatic commercial pitch",
  () => {
    const email = buildLifecyclePreview("weekly_review");
    assertStringIncludes(email.html, ">86<");
    assertStringIncludes(email.html, ">4<");
    assertStringIncludes(email.html, "+70");
    assertStringIncludes(email.html, "focused Quantitative Reasoning set");
    assertStringIncludes(email.html, "study-plan-tasks.jpg");
    assertStringIncludes(email.from, "matt@altitutor.com");
    assertStringIncludes(email.text, REPLY_HAND_FRAGMENT);
    assertFalse(email.text.includes("Upgrade"));
    assertFalse(email.text.includes("confidence"));
    assertFalse(email.text.toLowerCase().includes("too little"));
  },
);

Deno.test("onboarding copy materially changes with stated familiarity", () => {
  const novice = buildLifecyclePreview("onboarding_technique", "new");
  const experienced = buildLifecyclePreview(
    "onboarding_technique",
    "experienced",
  );
  assertStringIncludes(novice.text, "1.12");
  assertStringIncludes(novice.html, "qr-multipliers.jpg");
  assertStringIncludes(experienced.text, "one change");
  assertFalse(novice.subject === experienced.subject);
});

Deno.test(
  "progress teaching does not include the student's estimate",
  () => {
    const email = buildLifecyclePreview("first_score_estimate");
    assertEquals(
      email.subject,
      "Use your results to choose what to practise next",
    );
    assertFalse(email.subject.includes("2250"));
    assertFalse(email.preview.includes("2250"));
    assertFalse(email.html.includes("2250"));
    assertFalse(email.text.includes("2250"));
    assertFalse(email.text.toLowerCase().includes("confidence"));
    assertStringIncludes(email.html, "category-breakdown.jpg");
    assertStringIncludes(email.text, "syllogisms");
    assertStringIncludes(email.from, "matt@altitutor.com");
  },
);

Deno.test(
  "founder-led messages use the real signature asset with text fallback",
  () => {
    const email = buildLifecyclePreview("upgrade_consistency");
    assertStringIncludes(email.html, "/assets/ucat/email/matt-signature.png");
    assertStringIncludes(email.html, 'class="email-signature"');
    assertStringIncludes(email.html, 'alt="Matt"');
    assertStringIncludes(email.text, "Founder and tutor, Altitutor");
  },
);

Deno.test("primary actions contain stable attribution", () => {
  const email = buildLifecyclePreview("onboarding_plan", "familiar");
  assertStringIncludes(email.actionUrl, "utm_source=altitutor");
  assertStringIncludes(email.actionUrl, "utm_medium=email");
  assertStringIncludes(email.actionUrl, "utm_campaign=ucat_onboarding_plan");
  assertStringIncludes(email.actionUrl, "/progress");
  assertStringIncludes(email.html, "attempt-review.jpg");
  assertStringIncludes(email.text, "first point");
});

Deno.test("welcome invites a reply; offer emails do not", () => {
  const welcome = buildLifecyclePreview("onboarding_starting_point");
  const quota = buildLifecyclePreview("upgrade_quota");
  assertStringIncludes(welcome.text, REPLY_STUCK_FRAGMENT);
  assertStringIncludes(welcome.from, "matt@altitutor.com");
  assertFalse(quota.text.includes("just reply"));
  assertFalse(quota.text.includes("I read them"));
});

Deno.test(
  "consistency upgrade is explicit that Free practice has not earned a discount",
  () => {
    const email = buildLifecyclePreview("upgrade_consistency");
    assertStringIncludes(
      email.text,
      "Practice on Free doesn't earn discounts towards a future subscription",
    );
    assertStringIncludes(email.text, "Complete at least 10 questions in a day");
  },
);

Deno.test("experienced timing teaches faster-than-exam pace", () => {
  const email = buildLifecyclePreview("onboarding_timing", "experienced");
  assertStringIncludes(email.html, "practice-pace.jpg");
  assertStringIncludes(email.text, "1.25");
});
