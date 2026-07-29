import type { LifecycleCampaign, LifecycleCandidate } from "./logic.ts";
import {
  buildUcatEmailActionUrl,
  renderUcatEmail,
  renderUcatEmailButton,
  UCAT_EMAIL_SENDERS,
} from "../_shared/ucat-email.ts";

const APP_URL = (Deno.env.get("UCAT_WEB_URL") || "https://ucat.altitutor.com")
  .replace(/\/$/, "");
const ADMIN_EMAIL = "admin@altitutor.com";

type EmailModule = {
  html: string;
  text: string;
};

type LifecycleEmailContent = {
  subject: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  cta: string;
  path: string;
  module: EmailModule;
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll(
      "'",
      "&#039;",
    );
}

function panel(
  label: string,
  title: string,
  bodyHtml: string,
  bodyText: string,
): EmailModule {
  return {
    html:
      `<table class="email-panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#f5f8f8;border:1px solid #d5e2e5;border-radius:12px"><tr><td class="email-panel-copy" style="padding:20px 22px"><p style="margin:0 0 7px;color:#527487;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">${
        escapeHtml(label)
      }</p><p style="margin:0 0 15px;color:#0a2941;font-size:18px;font-weight:700;line-height:1.35">${
        escapeHtml(title)
      }</p>${bodyHtml}</td></tr></table>`,
    text: `${label.toUpperCase()}\n${title}\n${bodyText}`,
  };
}

function numberedRow(number: number, title: string, detail: string): string {
  return `<tr><td width="34" valign="top" style="padding:7px 10px 7px 0"><span style="display:inline-block;width:26px;height:26px;border-radius:13px;background:#dcecee;color:#0a2941;font-size:12px;font-weight:700;line-height:26px;text-align:center">${number}</span></td><td valign="top" style="padding:7px 0;color:#52606a;font-size:13px;line-height:1.55"><strong style="color:#0a2941">${
    escapeHtml(title)
  }</strong><br>${escapeHtml(detail)}</td></tr>`;
}

function numberedModule(
  label: string,
  title: string,
  rows: Array<{ title: string; detail: string }>,
): EmailModule {
  const bodyHtml =
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${
      rows.map((row, index) => numberedRow(index + 1, row.title, row.detail))
        .join("")
    }</table>`;
  const bodyText = rows.map((row, index) =>
    `${index + 1}. ${row.title}: ${row.detail}`
  ).join("\n");
  return panel(label, title, bodyHtml, bodyText);
}

function scoreConfidence(value: string | null): {
  label: string;
  guidance: string;
} {
  switch (value?.toLowerCase()) {
    case "high":
      return {
        label: "Strong evidence",
        guidance:
          "Your estimate is supported by a broader body of work. Use your trajectory and section gaps to choose what to practise next.",
      };
    case "medium":
      return {
        label: "Estimate forming",
        guidance:
          "Keep your timed practice representative across the cognitive sections. A more varied evidence base will make the estimate steadier.",
      };
    default:
      return {
        label: "Early estimate",
        guidance:
          "Treat the number as an early baseline. Complete timed work across each cognitive section before reading too much into small changes.",
      };
  }
}

function trackingModule(candidate: LifecycleCandidate): EmailModule {
  const estimate = candidate.current_estimate ?? "Building";
  const confidence = scoreConfidence(candidate.score_confidence);
  const bodyHtml =
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:2px 0 14px"><tr><td class="email-module-surface" width="50%" valign="top" style="padding:13px 15px;background:#fff;border:1px solid #dce5e8;border-radius:9px 0 0 9px"><p style="margin:0 0 4px;color:#73808a;font-size:11px;text-transform:uppercase;letter-spacing:.07em">Current estimate</p><p style="margin:0;color:#0a2941;font-size:24px;font-weight:700">${
      escapeHtml(String(estimate))
    }</p></td><td class="email-module-surface" width="50%" valign="top" style="padding:13px 15px;background:#fff;border:1px solid #dce5e8;border-left:0;border-radius:0 9px 9px 0"><p style="margin:0 0 4px;color:#73808a;font-size:11px;text-transform:uppercase;letter-spacing:.07em">Evidence strength</p><p style="margin:0;color:#0a2941;font-size:16px;font-weight:700">${
      escapeHtml(confidence.label)
    }</p></td></tr></table><p style="margin:0 0 13px;color:#52606a;font-size:13px;line-height:1.6">${
      escapeHtml(confidence.guidance)
    }</p><p style="margin:0;color:#52606a;font-size:13px;line-height:1.6"><strong style="color:#0a2941">Read the progress page in this order:</strong> current estimate, shaded plausible range, then trajectory and section gaps.</p>`;
  const bodyText =
    `Current estimate: ${estimate}\nEvidence strength: ${confidence.label}\n${confidence.guidance}\nRead the progress page in this order: current estimate, shaded plausible range, then trajectory and section gaps.`;
  return panel(
    "Your progress",
    "What the number can — and cannot — tell you",
    bodyHtml,
    bodyText,
  );
}

function weeklyModule(
  questions: number,
  sets: number,
  mocks: number,
  estimate: number | null,
  confidenceLabel: string,
  nextTitle: string,
): EmailModule {
  const stat = (value: number, label: string, border = true) =>
    `<td width="33.33%" align="center" valign="top" style="padding:12px 6px;${
      border ? "border-right:1px solid #dce5e8;" : ""
    }"><p style="margin:0;color:#0a2941;font-size:22px;font-weight:700">${value}</p><p style="margin:3px 0 0;color:#73808a;font-size:11px">${
      escapeHtml(label)
    }</p></td>`;
  const estimateText = estimate == null
    ? "Your recent work is building the evidence needed for an estimate."
    : `Current estimate: ${estimate} · ${confidenceLabel}`;
  const bodyHtml =
    `<table class="email-module-surface" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #dce5e8;border-radius:9px"><tr>${
      stat(questions, "Questions")
    }${stat(sets, "Sets")}${
      stat(mocks, "Mocks", false)
    }</tr></table><p style="margin:14px 0 6px;color:#52606a;font-size:13px;line-height:1.55">${
      escapeHtml(estimateText)
    }</p><p style="margin:0;color:#0a2941;font-size:14px;line-height:1.55"><strong>Next:</strong> ${
      escapeHtml(nextTitle)
    }</p>`;
  const bodyText =
    `Questions: ${questions}\nSets: ${sets}\nMocks: ${mocks}\n${estimateText}\nNext: ${nextTitle}`;
  return panel("Your week", "Practice completed", bodyHtml, bodyText);
}

function copy(
  candidate: LifecycleCandidate,
  campaign: LifecycleCampaign,
): LifecycleEmailContent {
  const firstName = candidate.first_name?.trim() || "there";
  const nextTitle = candidate.next_step_title?.trim() ||
    "your next study activity";
  const nextPath = candidate.next_step_path?.startsWith("/")
    ? candidate.next_step_path
    : "/dashboard";
  const questions = candidate.questions_last_7_days ?? 0;
  const sets = candidate.sets_last_7_days ?? 0;
  const mocks = candidate.mocks_last_7_days ?? 0;
  const confidence = scoreConfidence(candidate.score_confidence);
  const countLabel = (
    count: number,
    singular: string,
    plural = `${singular}s`,
  ) => `${count} ${count === 1 ? singular : plural}`;

  switch (campaign.key) {
    case "onboarding_welcome":
      return {
        subject: "You’re in. Here’s the best place to start.",
        preview:
          "One short practice-and-review loop is enough for your first day.",
        heading: `Welcome, ${firstName}`,
        paragraphs: [
          "UCAT preparation becomes easier to direct once you have a starting point. You do not need to map out the whole course today.",
          "Complete one short practice-and-review loop. It gives Altitutor its first evidence and gives you something specific to improve.",
        ],
        cta: "Find my starting point",
        path: "/dashboard",
        module: numberedModule(
          "Your first session",
          "Practise once. Learn from it. Continue with direction.",
          [
            {
              title: "Practise",
              detail: "Complete a short timed set in one cognitive section.",
            },
            {
              title: "Review",
              detail: "Check every incorrect or unusually slow answer.",
            },
            {
              title: "Continue",
              detail:
                "Use the recommended next task instead of guessing what to do next.",
            },
          ],
        ),
      };
    case "onboarding_first_signal":
      return {
        subject: "A useful first UCAT session — without a full mock",
        preview:
          "Use 10–15 timed questions to create a clean first piece of evidence.",
        heading: "Give your plan a useful starting point",
        paragraphs: [
          `Hi ${firstName}, your first session is not about proving that you are already good at the UCAT. Its job is to show you what needs attention.`,
          "Choose one cognitive section, answer 10–15 questions in timed mode without checking as you go, then review every incorrect or slow answer.",
        ],
        cta: "Start a short timed session",
        path: "/practice",
        module: numberedModule(
          "A clean first signal",
          "Keep the session small and representative",
          [
            {
              title: "One section",
              detail: "Pick Verbal, Decision Making or Quantitative Reasoning.",
            },
            {
              title: "10–15 questions",
              detail:
                "Use timed mode and answer without checking between questions.",
            },
            {
              title: "Review before repeating",
              detail:
                "Separate knowledge mistakes from timing or decision mistakes.",
            },
          ],
        ),
      };
    case "onboarding_plan":
      return {
        subject: "Build a UCAT plan you can actually follow",
        preview:
          "Your target, test date and real weekly availability shape the plan.",
        heading: "Make your preparation fit your life",
        paragraphs: [
          `Hi ${firstName}, a useful study plan starts with three honest inputs: the score you are working towards, when you will sit the UCAT, and the time you can usually protect each week.`,
          "Use a normal week—not your most ambitious week. Altitutor can then turn those inputs and your results into dated tasks, while adjusting as your evidence changes.",
        ],
        cta: "Set up my study plan",
        path: "/study-plan/setup",
        module: numberedModule(
          "Study plan inputs",
          "Three decisions now; clearer tasks next",
          [
            {
              title: "Target score",
              detail: "Set the result you are working towards.",
            },
            {
              title: "UCAT test date",
              detail: "Give the plan a real finish line.",
            },
            {
              title: "Weekly availability",
              detail: "Choose days and study time you can sustain.",
            },
            {
              title: "Your output",
              detail: "A dated plan with the next tasks to work through.",
            },
          ],
        ),
      };
    case "onboarding_tracking":
      return {
        subject:
          `${candidate.current_estimate} is your current estimate — here’s how to read it`,
        preview:
          `${confidence.label}: use the range, trajectory and section gaps—not one number alone.`,
        heading: "Read your estimate as evidence, not a verdict",
        paragraphs: [
          `Hi ${firstName}, your current estimated score is ${candidate.current_estimate}. It is a summary of the evidence Altitutor has so far, not a guaranteed test-day result.`,
          "The estimate is most useful alongside its evidence strength, plausible range, trajectory and section breakdown. Those tell you how much weight to place on it and where your next improvement is most likely to come from.",
        ],
        cta: "Read my progress",
        path: "/progress",
        module: trackingModule(candidate),
      };
    case "onboarding_free_forever":
      return {
        subject: "You can keep preparing on Free",
        preview:
          "Reaching one allowance is a pause until it resets—not the end of your access.",
        heading: "Start free. Keep practising free.",
        paragraphs: [
          `Hi ${firstName}, Altitutor UCAT Free is ongoing access, not a short trial or a sample that disappears once you have used it.`,
          "Practice questions, sets, mocks, learning and skill trainers have their own allowances. The app shows what remains and the exact reset timing for each area, so you can plan around them.",
        ],
        cta: "See my next task",
        path: "/dashboard",
        module: numberedModule(
          "How Free works",
          "A complete learning loop at a sustainable pace",
          [
            {
              title: "Use what is available",
              detail:
                "Practise, review, learn and track your progress on Free.",
            },
            {
              title: "Check the live reset",
              detail:
                "Each area shows its remaining allowance and exact reset time.",
            },
            {
              title: "Keep going",
              detail:
                "Reaching a limit does not erase your history or end your Free access.",
            },
          ],
        ),
      };
    case "inactive_7_days":
      return {
        subject: "One useful UCAT step when you’re ready",
        preview: `You do not need to catch up. Continue with ${nextTitle}.`,
        heading: "You do not need to catch up all at once",
        paragraphs: [
          `Hi ${firstName}, a week away does not undo the work you have already completed.`,
          `When you are ready, open ${nextTitle} and do only that task. Before choosing another session, review one answer you got wrong or took too long to solve.`,
        ],
        cta: "Continue with this task",
        path: nextPath,
        module: numberedModule("Your return path", nextTitle, [
          {
            title: "Open one task",
            detail: "Ignore the rest of the backlog for now.",
          },
          {
            title: "Complete one session",
            detail:
              "A small piece of representative work is enough to restart.",
          },
          {
            title: "Review one miss",
            detail:
              "Write down what made the question difficult before moving on.",
          },
        ]),
      };
    case "weekly_progress": {
      const subjectEvidence = questions > 0
        ? countLabel(questions, "question")
        : mocks > 0
        ? countLabel(mocks, "mock")
        : countLabel(sets, "set");
      return {
        subject: `Your UCAT week: ${subjectEvidence} and one clear next step`,
        preview:
          `Next: ${nextTitle}. Review incorrect and slow answers before adding more practice.`,
        heading: "Your week in review",
        paragraphs: [
          `Hi ${firstName}, this week you completed ${
            countLabel(questions, "question")
          }, ${countLabel(sets, "set")} and ${countLabel(mocks, "mock")}.`,
          candidate.current_estimate
            ? `Your current estimate is ${candidate.current_estimate}. Evidence strength: ${confidence.label.toLowerCase()}. ${confidence.guidance}`
            : "Your recent work is building the evidence needed for a useful score estimate. Keep the mix representative rather than repeating only your strongest question type.",
          `The most useful thing to do next is ${nextTitle}. Complete that before adding broad practice, then review incorrect and unusually slow answers while the reasoning is still fresh.`,
        ],
        cta: "Continue with my next task",
        path: nextPath,
        module: weeklyModule(
          questions,
          sets,
          mocks,
          candidate.current_estimate,
          confidence.label,
          nextTitle,
        ),
      };
    }
  }
}

function trackedActionUrl(path: string, campaign: LifecycleCampaign): string {
  return buildUcatEmailActionUrl({
    path,
    campaign: `ucat_${campaign.key}`,
    content: "primary_cta",
  });
}

export function buildLifecycleEmail(
  candidate: LifecycleCandidate,
  campaign: LifecycleCampaign,
) {
  const content = copy(candidate, campaign);
  const actionUrl = trackedActionUrl(content.path, campaign);
  const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?token=${
    encodeURIComponent(candidate.unsubscribe_token)
  }`;
  const preferencesUrl = `${APP_URL}/settings/communications`;
  const paragraphs = content.paragraphs.map((paragraph) =>
    `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">${
      escapeHtml(paragraph)
    }</p>`
  ).join("");
  const html = renderUcatEmail({
    previewText: content.preview,
    heading: content.heading,
    bodyHtml: `${paragraphs}${content.module.html}${
      renderUcatEmailButton(actionUrl, content.cta)
    }`,
    footerHtml:
      `<p style="margin:0 0 8px;color:#52606a;font-size:12px;line-height:1.6">Questions? Reply or contact <a href="mailto:${ADMIN_EMAIL}" style="color:#0a2941">${ADMIN_EMAIL}</a>.</p>`,
    marketingFooterHtml:
      `<p style="margin:0;color:#73808a;font-size:11px;line-height:1.6"><a href="${
        escapeHtml(preferencesUrl)
      }" style="color:#52606a">Email preferences</a> · <a href="${
        escapeHtml(unsubscribeUrl)
      }" style="color:#52606a">Unsubscribe</a></p>`,
  });
  const text = `${content.heading}\n\n${
    content.paragraphs.join("\n\n")
  }\n\n${content.module.text}\n\n${content.cta}: ${actionUrl}\n\nA not-for-profit initiative by Altitutor.\nQuestions? ${ADMIN_EMAIL}\nEmail preferences: ${preferencesUrl}\nUnsubscribe: ${unsubscribeUrl}`;
  const campaignData = {
    key: campaign.key,
    topic: campaign.topic,
    source: "altitutor",
    medium: "email",
    name: `ucat_${campaign.key}`,
  };
  const tags = [
    { name: "product", value: "ucat" },
    { name: "message_type", value: "lifecycle" },
    { name: "campaign", value: campaign.key },
    { name: "topic", value: campaign.topic },
  ];
  const sender = campaign.key.startsWith("onboarding_")
    ? UCAT_EMAIL_SENDERS.founder
    : UCAT_EMAIL_SENDERS.product;

  return {
    ...content,
    from: sender.from,
    replyTo: sender.replyTo,
    actionUrl,
    html,
    text,
    unsubscribeUrl,
    campaignData,
    tags,
  };
}
