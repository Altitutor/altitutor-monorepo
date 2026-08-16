import {
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "jsr:@std/assert";
import { buildLifecyclePreview } from "./email.ts";

Deno.test(
  "weekly review contains useful evidence and no automatic commercial pitch",
  () => {
    const email = buildLifecyclePreview("weekly_review");
    assertStringIncludes(email.html, ">86<");
    assertStringIncludes(email.html, ">4<");
    assertStringIncludes(email.html, "+70");
    assertStringIncludes(email.html, "focused Quantitative Reasoning set");
    assertFalse(email.text.includes("Upgrade"));
    assertFalse(email.text.includes("confidence"));
  },
);

Deno.test("onboarding copy materially changes with stated familiarity", () => {
  const novice = buildLifecyclePreview("onboarding_technique", "new");
  const experienced = buildLifecyclePreview(
    "onboarding_technique",
    "experienced",
  );
  assertStringIncludes(novice.text, "four-step question routine");
  assertStringIncludes(experienced.text, "one-variable practice loop");
  assertFalse(novice.subject === experienced.subject);
});

Deno.test(
  "first estimate subject protects score privacy and avoids confidence teaching",
  () => {
    const email = buildLifecyclePreview("first_score_estimate");
    assertEquals(email.subject, "Your first UCAT estimate is ready");
    assertFalse(email.subject.includes("2250"));
    assertFalse(email.preview.includes("2250"));
    assertFalse(email.text.toLowerCase().includes("confidence"));
    assertStringIncludes(email.text, "starting point, not a verdict");
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
});

Deno.test(
  "consistency upgrade is explicit that Free practice has not earned a discount",
  () => {
    const email = buildLifecyclePreview("upgrade_consistency");
    assertStringIncludes(email.text, "Free practice does not bank a discount");
    assertStringIncludes(email.text, "gets cheaper");
  },
);
