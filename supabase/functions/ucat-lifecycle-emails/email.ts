import type {
  LifecycleCampaign,
  LifecycleCampaignKey,
  LifecycleCandidate,
  UcatFamiliarity,
} from "./logic.ts";
import {
  buildUcatEmailActionUrl,
  escapeEmailHtml,
  renderUcatEmail,
  renderUcatEmailButton,
  UCAT_EMAIL_SENDERS,
} from "../_shared/ucat-email.ts";

const APP_URL = (
  Deno.env.get("UCAT_WEB_URL") || "https://ucat.altitutor.com"
).replace(/\/$/, "");
const MARKETING_URL = (
  Deno.env.get("MARKETING_WEB_URL") || "https://altitutor.com"
).replace(/\/$/, "");
const SIGNATURE_URL =
  Deno.env.get("UCAT_FOUNDER_SIGNATURE_URL") ||
  MARKETING_URL + "/assets/ucat/email/matt-signature.png";
const ADMIN_EMAIL = "admin@altitutor.com";

type EmailModule = { html: string; text: string };
type LifecycleEmailContent = {
  subject: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  cta: string;
  path: string;
  module: EmailModule;
  founderLed: boolean;
};

type LessonCopy = {
  subject: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  moduleTitle: string;
  rows: Array<{ title: string; detail: string }>;
  cta: string;
  path: string;
  screenshot?: {
    file: string;
    alt: string;
    caption: string;
    hrefPath?: string;
  };
};

const REPLY_STUCK =
  "If you get stuck, reply to this email — I read them.";
const REPLY_HAND = "If you want a hand with this, just reply.";

function combineModules(...modules: EmailModule[]): EmailModule {
  return {
    html: modules.map((module) => module.html).join(""),
    text: modules.map((module) => module.text).join("\n\n"),
  };
}

function panel(
  label: string,
  title: string,
  bodyHtml: string,
  bodyText: string,
): EmailModule {
  return {
    html:
      '<table class="email-panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#f5f8f8;border:1px solid #d5e2e5;border-radius:12px"><tr><td class="email-panel-copy" style="padding:20px 22px"><p style="margin:0 0 7px;color:#527487;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">' +
      escapeEmailHtml(label) +
      '</p><p class="email-accent" style="margin:0 0 15px;color:#1a1a1a;font-size:18px;font-weight:700;line-height:1.35">' +
      escapeEmailHtml(title) +
      "</p>" +
      bodyHtml +
      "</td></tr></table>",
    text: label.toUpperCase() + "\n" + title + "\n" + bodyText,
  };
}

function numberedModule(
  label: string,
  title: string,
  rows: LessonCopy["rows"],
): EmailModule {
  const html = rows
    .map(
      (row, index) =>
        '<tr><td width="34" valign="top" style="padding:7px 10px 7px 0"><span class="email-accent-fill" style="display:inline-block;width:26px;height:26px;border-radius:13px;background:#dcecee;color:#1a1a1a;font-size:12px;font-weight:700;line-height:26px;text-align:center">' +
        (index + 1) +
        '</span></td><td valign="top" style="padding:7px 0;color:#52606a;font-size:13px;line-height:1.55"><strong class="email-accent" style="color:#1a1a1a">' +
        escapeEmailHtml(row.title) +
        "</strong><br>" +
        escapeEmailHtml(row.detail) +
        "</td></tr>",
    )
    .join("");
  const text = rows
    .map((row, index) => index + 1 + ". " + row.title + ": " + row.detail)
    .join("\n");
  return panel(
    label,
    title,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">' +
      html +
      "</table>",
    text,
  );
}

function productScreenshot(input: {
  file: string;
  alt: string;
  caption: string;
  href?: string;
}): EmailModule {
  const url = MARKETING_URL + "/assets/ucat/email/" + input.file;
  const image =
    '<img src="' +
    escapeEmailHtml(url) +
    '" alt="' +
    escapeEmailHtml(input.alt) +
    '" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:1px solid #d5e2e5;border-radius:12px">';
  const framed = input.href
    ? '<a href="' + escapeEmailHtml(input.href) + '">' + image + "</a>"
    : image;
  return {
    html:
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td>' +
      framed +
      '</td></tr><tr><td style="padding-top:8px;color:#73808a;font-size:11px;line-height:1.5">' +
      escapeEmailHtml(input.caption) +
      "</td></tr></table>",
    text: input.caption,
  };
}

function lessonModules(
  lesson: LessonCopy,
  campaign: LifecycleCampaign,
): EmailModule {
  const numbered = numberedModule(
    "Tutor note",
    lesson.moduleTitle,
    lesson.rows,
  );
  if (!lesson.screenshot) return numbered;
  return combineModules(
    numbered,
    productScreenshot({
      file: lesson.screenshot.file,
      alt: lesson.screenshot.alt,
      caption: lesson.screenshot.caption,
      href: lesson.screenshot.hrefPath
        ? buildUcatEmailActionUrl({
            path: lesson.screenshot.hrefPath,
            campaign: "ucat_" + campaign.key,
            content: "screenshot",
          })
        : undefined,
    }),
  );
}

function statsModule(
  candidate: LifecycleCandidate,
  nextTitle: string,
): EmailModule {
  const questions = candidate.questions_last_7_days ?? 0;
  const activeDays = candidate.active_days_last_7_days ?? 0;
  const setsAndMocks =
    (candidate.sets_last_7_days ?? 0) + (candidate.mocks_last_7_days ?? 0);
  const stat = (value: number, label: string, border: boolean) =>
    '<td width="33.33%" align="center" valign="top" style="padding:12px 6px;' +
    (border ? "border-right:1px solid #dce5e8;" : "") +
    '"><p class="email-accent" style="margin:0;color:#1a1a1a;font-size:22px;font-weight:700">' +
    value +
    '</p><p style="margin:3px 0 0;color:#73808a;font-size:11px">' +
    escapeEmailHtml(label) +
    "</p></td>";
  const current = candidate.current_estimate;
  const previous = candidate.previous_week_estimate;
  const changed = current != null && previous != null && current !== previous;
  const delta = changed ? current - previous : null;
  const observation =
    activeDays >= 3
      ? "You spread that work across the week. Keep that rhythm and do " +
        nextTitle +
        " next."
      : activeDays === 1
        ? "Most of that work happened on one day. A second shorter session this week will make it easier to keep going."
        : "Your next session is " +
          nextTitle +
          ". Do that before adding extra volume.";
  const estimateLine =
    delta == null
      ? ""
      : '<p style="margin:14px 0 0;color:#52606a;font-size:13px;line-height:1.55">Estimated score change: <strong class="email-accent" style="color:#1a1a1a">' +
        (delta > 0 ? "+" : "") +
        delta +
        "</strong></p>";
  return panel(
    "Your week",
    "What you completed, and what to do next",
    '<table class="email-module-surface" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #dce5e8;border-radius:9px"><tr>' +
      stat(questions, "Questions", true) +
      stat(activeDays, "Active days", true) +
      stat(setsAndMocks, "Sets + mocks", false) +
      "</tr></table>" +
      estimateLine +
      '<p style="margin:14px 0 0;color:#52606a;font-size:13px;line-height:1.6">' +
      escapeEmailHtml(observation) +
      "</p>",
    "Questions: " +
      questions +
      "\nActive days: " +
      activeDays +
      "\nSets and mocks: " +
      setsAndMocks +
      (delta == null
        ? ""
        : "\nEstimated score change: " + (delta > 0 ? "+" : "") + delta) +
      "\n" +
      observation,
  );
}

function quotaAreaLabel(area: string | null): string {
  switch (area) {
    case "questions":
      return "practice questions";
    case "sets":
      return "practice sets";
    case "mocks":
      return "mocks";
    case "learn":
      return "learning modules";
    case "skill_trainer":
      return "skill trainer sessions";
    default:
      return "practice";
  }
}

function price(value: number | null, currency: string | null): string {
  if (value == null) return "your Unlimited price";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

function commercialModule(
  candidate: LifecycleCandidate,
  mode: "quota" | "consistency",
): EmailModule {
  const base = price(candidate.monthly_base_price_cents, candidate.currency);
  const daily = price(
    candidate.monthly_discount_per_day_cents,
    candidate.currency,
  );
  const maximum = candidate.monthly_max_discount_days ?? 0;
  const title =
    mode === "quota"
      ? "Unlimited removes the wait"
      : "Unlimited gets cheaper when you practice consistently";
  const detail =
    mode === "quota"
      ? "Keep practising across questions, sets, mocks, learning and skill trainers without Free allowance resets."
      : "Each qualifying practice day reduces your next monthly price. The app shows your live progress and the exact rules.";
  return panel(
    "Unlimited",
    title,
    '<p style="margin:0 0 12px;color:#52606a;font-size:13px;line-height:1.6">' +
      escapeEmailHtml(detail) +
      '</p><table class="email-module-surface" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #dce5e8;border-radius:9px"><tr><td style="padding:13px 15px;border-right:1px solid #dce5e8"><p style="margin:0 0 3px;color:#73808a;font-size:11px">Monthly base</p><p class="email-accent" style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700">' +
      escapeEmailHtml(base) +
      '</p></td><td style="padding:13px 15px"><p style="margin:0 0 3px;color:#73808a;font-size:11px">Per qualifying day</p><p class="email-accent" style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700">−' +
      escapeEmailHtml(daily) +
      "</p></td></tr></table>" +
      (maximum > 0
        ? '<p style="margin:10px 0 0;color:#73808a;font-size:11px">Up to ' +
          maximum +
          " qualifying practice days per billing period.</p>"
        : ""),
    title +
      "\n" +
      detail +
      "\nMonthly base: " +
      base +
      "\nDiscount per qualifying day: " +
      daily +
      (maximum > 0 ? "\nUp to " + maximum + " days per billing period." : ""),
  );
}

function signature(founderLed: boolean): { html: string; text: string } {
  if (!founderLed) {
    return {
      html: '<p style="margin:22px 0 0;color:#394650;font-size:14px;line-height:1.6">Matt and the Altitutor UCAT team</p>',
      text: "Matt and the Altitutor UCAT team",
    };
  }
  return {
    html:
      '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 0"><tr><td><p style="margin:0 0 5px;color:#394650;font-size:14px;line-height:1.5">All the best,</p><img class="email-signature" src="' +
      escapeEmailHtml(SIGNATURE_URL) +
      '" alt="Matt" width="155" height="59" style="display:block;width:155px;height:auto;max-height:59px"><p style="margin:3px 0 0;color:#52606a;font-size:12px;line-height:1.5">Matt<br>Founder and tutor, Altitutor</p></td></tr></table>',
    text: "All the best,\nMatt\nFounder and tutor, Altitutor",
  };
}

function hi(firstName: string, rest: string): string {
  return "Hi " + firstName + " — " + rest;
}

function studyPlanScreenshot(campaign: LifecycleCampaign): EmailModule {
  return productScreenshot({
    file: "study-plan-tasks.jpg",
    alt: "A day's study plan with a learning module, practice questions, and review",
    caption: "A typical session: learn the method, practise it, then review.",
    href: buildUcatEmailActionUrl({
      path: "/study-plan",
      campaign: "ucat_" + campaign.key,
      content: "screenshot",
    }),
  });
}

function onboardingLesson(
  key: Extract<
    LifecycleCampaignKey,
    | "onboarding_starting_point"
    | "onboarding_technique"
    | "onboarding_timing"
    | "onboarding_plan"
  >,
  familiarity: UcatFamiliarity,
  firstName: string,
): LessonCopy {
  const lessons: Record<UcatFamiliarity, Record<typeof key, LessonCopy>> = {
    new: {
      onboarding_starting_point: {
        subject: "Your first UCAT session is about 15 minutes",
        preview: "Don't start with a mock. Do one short guided session.",
        heading: "Start smaller than a mock",
        paragraphs: [
          hi(
            firstName,
            "the fastest way to get oriented is one short session, not a full mock.",
          ),
          "Do a short Verbal Reasoning lesson, try the questions in it, then follow whatever Altitutor recommends next. That's enough for today.",
          REPLY_STUCK,
        ],
        moduleTitle: "Your first session",
        rows: [
          {
            title: "Open a short lesson",
            detail: "Verbal Reasoning is a good first section.",
          },
          {
            title: "Try the questions",
            detail: "Aim to understand the task, not beat the clock.",
          },
          {
            title: "Stop after that session",
            detail: "Use the next recommended task next time you sit down.",
          },
        ],
        cta: "Start my first session",
        path: "/learn",
        screenshot: {
          file: "study-plan-tasks.jpg",
          alt: "A day's study plan with a learning module, practice questions, and review",
          caption:
            "A typical session: learn the method, practise it, then review.",
        },
      },
      onboarding_technique: {
        subject: "A QR shortcut: multiply instead of calculating the increase",
        preview: "$80 up 12% is $80 × 1.12. That's the whole method.",
        heading: "Use multipliers on percentage questions",
        paragraphs: [
          hi(
            firstName,
            "percentage questions get expensive when you calculate the increase first, then add it on.",
          ),
          "For a 12% rise, multiply by 1.12. For an 8% fall, multiply by 0.92. The screenshot is the whole cheat-sheet.",
          REPLY_HAND,
        ],
        moduleTitle: "The multiplier method",
        rows: [
          {
            title: "Turn the change into a multiplier",
            detail: "Increase by 12% is × 1.12. Decrease by 8% is × 0.92.",
          },
          {
            title: "Multiply the original amount",
            detail: "$80 × 1.12 = $89.60.",
          },
          {
            title: "Subtract only if asked",
            detail: "The increase itself is $89.60 − $80 = $9.60.",
          },
        ],
        cta: "Practise percentage questions",
        path: "/practice",
        screenshot: {
          file: "qr-multipliers.jpg",
          alt: "Worked example converting percentage change into a multiplier",
          caption:
            "Keep this next to you for the next QR set: convert the change, then multiply.",
        },
      },
      onboarding_timing: {
        subject: "If the method isn't landing, flag it and move",
        preview:
          "A correct answer that took two minutes still cost you the section.",
        heading: "Moving on is part of the method",
        paragraphs: [
          hi(
            firstName,
            "timing is not reading faster. It's noticing when another 20 seconds will not improve the answer.",
          ),
          "On the graph, a tall green bar is a correct answer that still ate the clock. That's the question to flag sooner next time.",
          REPLY_HAND,
        ],
        moduleTitle: "A simple timing rule",
        rows: [
          {
            title: "Give the method a fair start",
            detail: "Understand the task before you watch the clock.",
          },
          {
            title: "Flag around 45–60 seconds",
            detail:
              "If the working is still expanding, move on and come back if time remains.",
          },
          {
            title: "Review the expensive corrects",
            detail:
              "Those are the questions to shorten next time, even when the answer was right.",
          },
        ],
        cta: "Open a timed set",
        path: "/practice",
        screenshot: {
          file: "timing-graph.jpg",
          alt: "Timing graph showing one correct question that took much longer than the others",
          caption:
            "A tall green bar is a correct answer that still cost a lot of time.",
        },
      },
      onboarding_plan: {
        subject: "The score is not the session — review the miss",
        preview:
          "Open the explanation, find the first divergence, and redo from there.",
        heading: "Review is where the gain is",
        paragraphs: [
          hi(
            firstName,
            "after a set, don't just note the score and start another one.",
          ),
          "Open the explanation, find the first point your approach diverged, and redo from there. That one miss is more useful than ten extra questions.",
          REPLY_HAND,
        ],
        moduleTitle: "How to review one question",
        rows: [
          {
            title: "Open the explanation",
            detail: "Sit it next to the question, not after you have moved on.",
          },
          {
            title: "Find the first divergence",
            detail: "Where did your approach leave the method in the explanation?",
          },
          {
            title: "Redo from that point",
            detail: "Then go to the next miss. Don't start a new set first.",
          },
        ],
        cta: "Review my last set",
        path: "/progress",
        screenshot: {
          file: "attempt-review.jpg",
          alt: "Attempt review with the question, insight, and step-by-step explanation",
          caption:
            "This screen is dense on purpose. Tap through to your last review and use the explanation panel.",
          hrefPath: "/progress",
        },
      },
    },
    familiar: {
      onboarding_starting_point: {
        subject: "Make your first Altitutor session a timed baseline",
        preview:
          "One mixed timed set beats a pile of favourite question types.",
        heading: "Start with a set you didn't cherry-pick",
        paragraphs: [
          hi(
            firstName,
            "you already know the format, so skip browsing. Do one timed mixed set so you have a clean baseline.",
          ),
          "Then follow the next recommended task instead of adding more of what already feels comfortable.",
          REPLY_STUCK,
        ],
        moduleTitle: "Create a baseline you can act on",
        rows: [
          {
            title: "Choose a mixed timed set",
            detail: "Avoid selecting only familiar question types.",
          },
          {
            title: "Keep exam timing",
            detail: "Use the same decision pressure you expect on test day.",
          },
          {
            title: "Follow the next task",
            detail: "Let that result choose what comes next.",
          },
        ],
        cta: "Start a timed set",
        path: "/practice",
        screenshot: {
          file: "study-plan-tasks.jpg",
          alt: "A day's study plan with a learning module, practice questions, and review",
          caption:
            "Learn, practise, review — in that order — beats extra untimed volume.",
        },
      },
      onboarding_technique: {
        subject: "Name the mistake before you practise the same type again",
        preview:
          "Interpretation, method, and timing errors need different next sessions.",
        heading: "Don't treat every miss the same",
        paragraphs: [
          hi(
            firstName,
            "reading the correct option helps, but the gain is naming why your original decision failed.",
          ),
          "Was it the task, the method, or the clock? The next set should test that one thing.",
          REPLY_HAND,
        ],
        moduleTitle: "A practical error check",
        rows: [
          {
            title: "Interpretation",
            detail: "Did you misunderstand the task or miss a constraint?",
          },
          {
            title: "Method",
            detail: "Was the approach unreliable or unnecessarily long?",
          },
          {
            title: "Timing",
            detail: "Did the clock change an otherwise sound decision?",
          },
        ],
        cta: "Review a recent set",
        path: "/progress",
      },
      onboarding_timing: {
        subject: "Use the timing graph to decide what to shorten",
        preview:
          "Correct and slow is a different problem from incorrect and rushed.",
        heading: "Manage the expensive questions, not the average",
        paragraphs: [
          hi(
            firstName,
            "a section can feel uniformly rushed even when most of the loss sits in a few questions.",
          ),
          "Look at the graph: which questions were clean, which became time sinks, and which should have been flagged earlier?",
          REPLY_HAND,
        ],
        moduleTitle: "Three timing decisions",
        rows: [
          {
            title: "Continue",
            detail: "The route is clear and you are making progress.",
          },
          {
            title: "Simplify or flag",
            detail:
              "If the working is expanding at around 45–60 seconds, move on.",
          },
          {
            title: "Review the tall bars",
            detail:
              "Especially the green ones. Those corrects are where time is leaking.",
          },
        ],
        cta: "Check my timing graph",
        path: "/progress",
        screenshot: {
          file: "timing-graph.jpg",
          alt: "Timing graph showing one correct question that took much longer than the others",
          caption:
            "A tall green bar is a correct answer that still cost a lot of time.",
        },
      },
      onboarding_plan: {
        subject: "Find the first point you left the method",
        preview:
          "Compare your approach with the explanation, then redo from there.",
        heading: "Review one miss properly",
        paragraphs: [
          hi(
            firstName,
            "the useful part of a finished set is still sitting in the review screen.",
          ),
          "Open the explanation, find the first point your approach diverged, and redo from there before you start another set.",
          REPLY_HAND,
        ],
        moduleTitle: "How to review one question",
        rows: [
          {
            title: "Compare approaches",
            detail: "Yours versus the explanation, step by step.",
          },
          {
            title: "Mark the first divergence",
            detail: "That's the method change to carry into the next set.",
          },
          {
            title: "Redo from there",
            detail: "Then stop. One cleaned-up miss beats another mixed pile.",
          },
        ],
        cta: "Review my last set",
        path: "/progress",
        screenshot: {
          file: "attempt-review.jpg",
          alt: "Attempt review with the question, insight, and step-by-step explanation",
          caption:
            "This screen is dense on purpose. Tap through to your last review and use the explanation panel.",
          hrefPath: "/progress",
        },
      },
    },
    experienced: {
      onboarding_starting_point: {
        subject: "Audit your prep with one representative set",
        preview:
          "Check the pattern of misses before you add more volume.",
        heading: "Test one assumption about your prep",
        paragraphs: [
          hi(
            firstName,
            "you already have methods. Use the first Altitutor session to see whether they hold up on representative timed work.",
          ),
          "Look at accuracy, pace, and the pattern of misses before you add another block of questions.",
          REPLY_STUCK,
        ],
        moduleTitle: "Run a useful prep audit",
        rows: [
          {
            title: "Sample broadly",
            detail: "Use work that represents the section, not a comfortable niche.",
          },
          {
            title: "Inspect the pattern",
            detail:
              "Separate isolated misses from repeatable method or pacing problems.",
          },
          {
            title: "Test one gap",
            detail: "Choose the next session to challenge the strongest diagnosis.",
          },
        ],
        cta: "Start a representative set",
        path: "/practice",
      },
      onboarding_technique: {
        subject: "Make the next session test one change",
        preview:
          "More questions only help when you know what you are making more reliable.",
        heading: "Practice the change, not just the question type",
        paragraphs: [
          hi(
            firstName,
            "volume only helps when the variable is clear.",
          ),
          "Choose one method or decision rule, keep the mix and timing stable, then compare. That's one change, not a new question-type binge.",
          REPLY_HAND,
        ],
        moduleTitle: "A one-variable practice loop",
        rows: [
          {
            title: "Choose the change",
            detail: "State the method or decision rule you are testing.",
          },
          {
            title: "Keep conditions stable",
            detail: "Use a comparable question mix and timing.",
          },
          {
            title: "Compare",
            detail:
              "Did accuracy or pace improve without creating a new cost?",
          },
        ],
        cta: "Start a focused set",
        path: "/practice",
      },
      onboarding_timing: {
        subject: "Once answers are mostly correct, practise at 1.25×",
        preview:
          "Staying untimed or at exam pace forever does not build test-day speed.",
        heading: "You're ready for a faster gear",
        paragraphs: [
          hi(
            firstName,
            "if most answers are already correct, the next skill is doing them at exam pace without the method falling apart.",
          ),
          "Try one short set at 1.25× exam speed, then check the timing graph for anything that still spiked.",
          REPLY_HAND,
        ],
        moduleTitle: "How to use faster-than-exam pace",
        rows: [
          {
            title: "Only after the method is reliable",
            detail: "Don't speed up a method you still can't repeat.",
          },
          {
            title: "Set 1.25× for one short set",
            detail: "That's 25% faster than exam pace — enough to feel the pressure.",
          },
          {
            title: "Review the spikes",
            detail: "Anything that ballooned is the next thing to flag sooner.",
          },
        ],
        cta: "Start a faster-paced set",
        path: "/practice",
        screenshot: {
          file: "practice-pace.jpg",
          alt: "Choose your pace screen with timed practice set to 1.25 times exam speed",
          caption:
            "Once answers are mostly correct, you can practise faster than exam pace.",
        },
      },
      onboarding_plan: {
        subject: "Redo the miss before you start another set",
        preview:
          "Find the first divergence, fix that step, then stop.",
        heading: "Make review a method change",
        paragraphs: [
          hi(
            firstName,
            "another set will not fix a method you haven't isolated yet.",
          ),
          "Open the last review, find the first point you left the method, redo from there, and only then start the next task.",
          REPLY_HAND,
        ],
        moduleTitle: "How to review one question",
        rows: [
          {
            title: "Find the first divergence",
            detail: "Compare your working with the explanation.",
          },
          {
            title: "Redo from that step",
            detail: "Don't restart the whole question if the error is local.",
          },
          {
            title: "Carry one change forward",
            detail: "The next set should test that change, nothing else.",
          },
        ],
        cta: "Review my last set",
        path: "/progress",
        screenshot: {
          file: "attempt-review.jpg",
          alt: "Attempt review with the question, insight, and step-by-step explanation",
          caption:
            "This screen is dense on purpose. Tap through to your last review and use the explanation panel.",
          hrefPath: "/progress",
        },
      },
    },
  };
  return lessons[familiarity][key];
}

function copy(
  candidate: LifecycleCandidate,
  campaign: LifecycleCampaign,
): LifecycleEmailContent {
  const firstName = candidate.first_name?.trim() || "there";
  const nextTitle =
    candidate.next_step_title?.trim() || "a short practice session";
  const nextPath = candidate.next_step_path?.startsWith("/")
    ? candidate.next_step_path
    : "/dashboard";

  if (campaign.key.startsWith("onboarding_")) {
    const key = campaign.key as Extract<
      LifecycleCampaignKey,
      | "onboarding_starting_point"
      | "onboarding_technique"
      | "onboarding_timing"
      | "onboarding_plan"
    >;
    const lesson = onboardingLesson(
      key,
      candidate.ucat_initial_familiarity || "new",
      firstName,
    );
    return {
      ...lesson,
      module: lessonModules(lesson, campaign),
      founderLed: true,
    };
  }

  switch (campaign.key) {
    case "first_score_estimate":
      return {
        subject: "Your total score isn't the useful part",
        preview:
          "The category breakdown shows which question type to practise next.",
        heading: "Look at the breakdown, not just the total",
        paragraphs: [
          hi(
            firstName,
            "you now have enough practice for Progress to split your results by question type.",
          ),
          "A total like 40/63 doesn't tell you what to do tomorrow. In this example, syllogisms at 8/16 is the next session; probabilistic reasoning at 4/5 can wait.",
          "Open Progress, find your weakest category, and do that — not another mixed pile.",
          REPLY_HAND,
        ],
        cta: "Open my Progress",
        path: "/progress",
        module: productScreenshot({
          file: "category-breakdown.jpg",
          alt: "Category breakdown showing best and worst question types for a practice set",
          caption:
            "Example only — not your score. Use the Best and Worst tags to choose tomorrow's session.",
          href: buildUcatEmailActionUrl({
            path: "/progress",
            campaign: "ucat_" + campaign.key,
            content: "screenshot",
          }),
        }),
        founderLed: true,
      };
    case "weekly_review":
      return {
        subject: "Your week, and one session to do next",
        preview: "You completed work this week. Next: " + nextTitle + ".",
        heading: "Here's what to do with this week",
        paragraphs: [
          hi(
            firstName,
            "you completed " +
              (candidate.questions_last_7_days ?? 0) +
              " questions across " +
              (candidate.active_days_last_7_days ?? 0) +
              " days.",
          ),
          "Your next session is " +
            nextTitle +
            ". Do that before adding extra volume.",
          REPLY_HAND,
        ],
        cta: "Continue: " + nextTitle,
        path: nextPath,
        module: candidate.has_study_plan
          ? combineModules(
              statsModule(candidate, nextTitle),
              studyPlanScreenshot(campaign),
            )
          : statsModule(candidate, nextTitle),
        founderLed: true,
      };
    case "gentle_restart":
      return {
        subject: "Pick up with one session — nothing to catch up",
        preview: "Start with " + nextTitle + ". That's the whole restart.",
        heading: "One session is enough",
        paragraphs: [
          hi(
            firstName,
            "a few days away doesn't undo the work you've already done.",
          ),
          "When you're ready, do " +
            nextTitle +
            ". That's the whole restart — you don't need to clear a backlog.",
          REPLY_HAND,
        ],
        cta: candidate.has_study_plan
          ? "Continue my plan"
          : "Start: " + nextTitle,
        path: nextPath,
        module: candidate.has_study_plan
          ? studyPlanScreenshot(campaign)
          : numberedModule("A gentle restart", nextTitle, [
              {
                title: "Open this one task",
                detail: "Ignore everything else for now.",
              },
              {
                title: "Finish that session",
                detail: "Then stop. The next task can wait until next time.",
              },
            ]),
        founderLed: true,
      };
    case "upgrade_quota":
      return {
        subject: "Want to keep practising without waiting for the reset?",
        preview:
          "Free still resets. Unlimited removes the wait if you want to continue now.",
        heading: "You can wait for Free, or continue now",
        paragraphs: [
          hi(
            firstName,
            "you reached this period's Free limit on " +
              quotaAreaLabel(candidate.last_quota_area) +
              ". Free resets as shown in the app, and that path stays available.",
          ),
          "If you want to keep going now, Unlimited removes the wait. The monthly price can also fall as you complete qualifying practice days.",
        ],
        cta: "Compare Unlimited",
        path: "/settings/plan/subscription",
        module: commercialModule(candidate, "quota"),
        founderLed: true,
      };
    case "upgrade_consistency":
      return {
        subject: "Your Unlimited plan can get cheaper as you practice",
        preview:
          "Consistent practice reduces the next monthly Unlimited price.",
        heading: "The price is built around a useful study habit",
        paragraphs: [
          hi(
            firstName,
            "you have been coming back to UCAT prep across the week.",
          ),
          "On Unlimited, qualifying practice days reduce your next monthly price. Free practice does not bank a discount, but your current rhythm is exactly how that model is meant to work.",
        ],
        cta: "See Unlimited pricing",
        path: "/settings/plan/subscription",
        module: commercialModule(candidate, "consistency"),
        founderLed: true,
      };
    case "referral_invitation": {
      const reward =
        candidate.billing_interval === "year" ? "a free month" : "a free week";
      return {
        subject: "Give a friend " + reward + " of Unlimited",
        preview:
          "They get " + reward + " of Unlimited. You get the same when they join.",
        heading: "Give a friend " + reward + " of Unlimited",
        paragraphs: [
          hi(
            firstName,
            "if someone you know is preparing for the UCAT, you can give them " +
              reward +
              " of Unlimited from your referral page.",
          ),
          "When they join Unlimited through your link, you get " +
            reward +
            " as well. The page shows the reward status before anything is applied.",
        ],
        cta: "Invite a friend",
        path: "/settings/plan/referrals",
        module: panel(
          "Your referral reward",
          "They get " + reward + " — and so do you",
          '<p style="margin:0;color:#52606a;font-size:13px;line-height:1.6">Share your personal link. Your friend can explore Altitutor first. The reward is applied when they start Unlimited.</p>',
          "Share your personal link. Your friend can explore Altitutor first. The reward is applied when they start Unlimited.",
        ),
        founderLed: true,
      };
    }
  }
  throw new Error("Unsupported lifecycle campaign: " + campaign.key);
}

function trackedActionUrl(path: string, campaign: LifecycleCampaign): string {
  return buildUcatEmailActionUrl({
    path,
    campaign: "ucat_" + campaign.key,
    content: "primary_cta",
  });
}

export function buildLifecycleEmail(
  candidate: LifecycleCandidate,
  campaign: LifecycleCampaign,
) {
  const content = copy(candidate, campaign);
  const actionUrl = trackedActionUrl(content.path, campaign);
  const unsubscribeUrl =
    APP_URL +
    "/api/newsletter/unsubscribe?token=" +
    encodeURIComponent(candidate.unsubscribe_token);
  const preferencesUrl = APP_URL + "/settings/communications";
  const paragraphs = content.paragraphs
    .map(
      (paragraph) =>
        '<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">' +
        escapeEmailHtml(paragraph) +
        "</p>",
    )
    .join("");
  const signoff = signature(content.founderLed);
  const html = renderUcatEmail({
    previewText: content.preview,
    heading: content.heading,
    bodyHtml:
      paragraphs +
      content.module.html +
      renderUcatEmailButton(actionUrl, content.cta) +
      signoff.html,
    marketingFooterHtml:
      '<p style="margin:12px 0 0;color:#73808a;font-size:11px;line-height:1.6"><a href="' +
      escapeEmailHtml(preferencesUrl) +
      '" style="color:#52606a">Email preferences</a> · <a href="' +
      escapeEmailHtml(unsubscribeUrl) +
      '" style="color:#52606a">Unsubscribe</a></p>',
  });
  const text =
    content.heading +
    "\n\n" +
    content.paragraphs.join("\n\n") +
    "\n\n" +
    content.module.text +
    "\n\n" +
    content.cta +
    ": " +
    actionUrl +
    "\n\n" +
    signoff.text +
    "\n\nA not-for-profit initiative by Altitutor.\nEmail: " +
    ADMIN_EMAIL +
    "\nWeb: https://altitutor.com/ucat\nEmail preferences: " +
    preferencesUrl +
    "\nUnsubscribe: " +
    unsubscribeUrl;
  const sender = content.founderLed
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
    campaignData: {
      key: campaign.key,
      topic: campaign.topic,
      source: "altitutor",
      medium: "email",
      name: "ucat_" + campaign.key,
    },
    tags: [
      { name: "product", value: "ucat" },
      { name: "message_type", value: "lifecycle" },
      { name: "campaign", value: campaign.key },
      { name: "topic", value: campaign.topic },
    ],
  };
}

export function buildLifecyclePreview(
  key: LifecycleCampaignKey,
  familiarity: UcatFamiliarity = "new",
) {
  const candidate: LifecycleCandidate = {
    student_id: "preview-student",
    auth_user_id: "preview-user",
    email: "student@example.com",
    first_name: "Sam",
    last_name: "Student",
    timezone: "Australia/Adelaide",
    status: "ACTIVE",
    ucat_signup_completed_at: "2026-07-01T00:00:00Z",
    ucat_initial_familiarity: familiarity,
    email_program_cohort: "treatment",
    email_program_bucket: 42,
    email_program_posthog_synced_at: null,
    weekly_progress_and_guidance: true,
    lessons_and_tips: true,
    product_news: true,
    offers_and_referrals: true,
    unsubscribe_token: "00000000-0000-0000-0000-000000000000",
    consent_verified_at: "2026-07-01T00:00:00Z",
    unsubscribed_at: null,
    online_tier: key === "referral_invitation" ? "unlimited" : "free",
    unlimited_started_at:
      key === "referral_invitation" ? "2026-07-01T00:00:00Z" : null,
    billing_interval: "month",
    last_activity_at: "2026-07-27T00:00:00Z",
    questions_last_7_days: 86,
    sets_last_7_days: 4,
    mocks_last_7_days: 1,
    active_days_last_7_days: 4,
    active_days_last_14_days: 6,
    qualifying_days_last_7_days: 3,
    has_study_plan: true,
    next_step_title: "a focused Quantitative Reasoning set",
    next_step_path: "/practice",
    current_estimate: 2250,
    first_estimate_generated_at: "2026-07-28T00:00:00Z",
    previous_week_estimate: 2180,
    last_quota_reached_at: "2026-07-28T00:00:00Z",
    last_quota_area: "questions",
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
  const topic = key.startsWith("onboarding_")
    ? "lessons_and_tips"
    : key === "upgrade_quota" ||
        key === "upgrade_consistency" ||
        key === "referral_invitation"
      ? "offers_and_referrals"
      : "weekly_progress_and_guidance";
  return buildLifecycleEmail(candidate, {
    key,
    topic,
    dedupeKey: "preview:" + key + ":" + familiarity,
    priority: 100,
    evidence: {},
  });
}
