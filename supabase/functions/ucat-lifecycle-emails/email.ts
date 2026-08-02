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
};

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
      '</p><p class="email-accent" style="margin:0 0 15px;color:#0a2941;font-size:18px;font-weight:700;line-height:1.35">' +
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
        '<tr><td width="34" valign="top" style="padding:7px 10px 7px 0"><span class="email-accent-fill" style="display:inline-block;width:26px;height:26px;border-radius:13px;background:#dcecee;color:#0a2941;font-size:12px;font-weight:700;line-height:26px;text-align:center">' +
        (index + 1) +
        '</span></td><td valign="top" style="padding:7px 0;color:#52606a;font-size:13px;line-height:1.55"><strong class="email-accent" style="color:#0a2941">' +
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

function productPreview(
  surface: "guided-learning" | "study-plan",
): EmailModule {
  const filename =
    surface === "study-plan" ? "study-plan.webp" : "guided-learning.webp";
  const title =
    surface === "study-plan"
      ? "A plan that turns evidence into the next task"
      : "Short teaching, then focused practice";
  const url = MARKETING_URL + "/assets/ucat/product-previews/" + filename;
  return {
    html:
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td><img src="' +
      escapeEmailHtml(url) +
      '" alt="' +
      escapeEmailHtml(title) +
      '" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:1px solid #d5e2e5;border-radius:12px"></td></tr><tr><td style="padding-top:8px;color:#73808a;font-size:11px;line-height:1.5">' +
      escapeEmailHtml(title) +
      "</td></tr></table>",
    text: title,
  };
}

function statsModule(candidate: LifecycleCandidate): EmailModule {
  const questions = candidate.questions_last_7_days ?? 0;
  const activeDays = candidate.active_days_last_7_days ?? 0;
  const setsAndMocks =
    (candidate.sets_last_7_days ?? 0) + (candidate.mocks_last_7_days ?? 0);
  const stat = (value: number, label: string, border: boolean) =>
    '<td width="33.33%" align="center" valign="top" style="padding:12px 6px;' +
    (border ? "border-right:1px solid #dce5e8;" : "") +
    '"><p class="email-accent" style="margin:0;color:#0a2941;font-size:22px;font-weight:700">' +
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
      ? "You spread your practice across the week. Keep that rhythm and follow the next task."
      : activeDays === 1
        ? "Most of this work happened on one day. A second shorter day next week will make your routine easier to sustain."
        : "Your next useful step is already waiting; complete it before adding broad practice.";
  const estimateLine =
    delta == null
      ? ""
      : '<p style="margin:14px 0 0;color:#52606a;font-size:13px;line-height:1.55">Estimated score change: <strong class="email-accent" style="color:#0a2941">' +
        (delta > 0 ? "+" : "") +
        delta +
        "</strong></p>";
  return panel(
    "Your week",
    "A useful snapshot, not another task list",
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

function estimateModule(estimate: number): EmailModule {
  return panel(
    "Your first estimate",
    "A starting point, not a verdict",
    '<table class="email-module-surface" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #dce5e8;border-radius:9px"><tr><td align="center" style="padding:20px"><p style="margin:0 0 4px;color:#73808a;font-size:11px;text-transform:uppercase;letter-spacing:.07em">Current estimated score</p><p class="email-accent" style="margin:0;color:#0a2941;font-size:32px;font-weight:700">' +
      escapeEmailHtml(estimate) +
      '</p></td></tr></table><p style="margin:14px 0 0;color:#52606a;font-size:13px;line-height:1.6">This will move as you complete more representative practice. Use the progress page to see the trend and decide what to work on next.</p>',
    "Current estimated score: " +
      estimate +
      "\nThis will move as you complete more representative practice. Use the progress page to see the trend and decide what to work on next.",
  );
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
      : "Unlimited gets cheaper when you practise consistently";
  const detail =
    mode === "quota"
      ? "Keep practising across questions, sets, mocks, learning and skill trainers without Free allowance resets."
      : "Each qualifying practice day reduces your next monthly price. The app shows your live progress and the exact rules.";
  return panel(
    "Unlimited",
    title,
    '<p style="margin:0 0 12px;color:#52606a;font-size:13px;line-height:1.6">' +
      escapeEmailHtml(detail) +
      '</p><table class="email-module-surface" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #dce5e8;border-radius:9px"><tr><td style="padding:13px 15px;border-right:1px solid #dce5e8"><p style="margin:0 0 3px;color:#73808a;font-size:11px">Monthly base</p><p class="email-accent" style="margin:0;color:#0a2941;font-size:18px;font-weight:700">' +
      escapeEmailHtml(base) +
      '</p></td><td style="padding:13px 15px"><p style="margin:0 0 3px;color:#73808a;font-size:11px">Per qualifying day</p><p class="email-accent" style="margin:0;color:#0a2941;font-size:18px;font-weight:700">−' +
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
      '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 0"><tr><td><p style="margin:0 0 5px;color:#394650;font-size:14px;line-height:1.5">All the best,</p><img src="' +
      escapeEmailHtml(SIGNATURE_URL) +
      '" alt="Matt" width="155" height="59" style="display:block;width:155px;height:auto;max-height:59px"><p style="margin:3px 0 0;color:#52606a;font-size:12px;line-height:1.5">Matt<br>Founder and tutor, Altitutor</p></td></tr></table>',
    text: "All the best,\nMatt\nFounder and tutor, Altitutor",
  };
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
        subject: "Your first UCAT session: start smaller than a mock",
        preview:
          "Learn the shape of the test, then create one useful starting point.",
        heading: "A calm first step into UCAT preparation",
        paragraphs: [
          "Hi " +
            firstName +
            ", the UCAT is a skills-based, time-pressured test. You do not need to understand every section before you begin.",
          "Start with a short guided session. Its job is to make the format familiar and give Altitutor enough evidence to guide your next step.",
        ],
        moduleTitle: "Your first practice loop",
        rows: [
          {
            title: "Learn the task",
            detail: "Read the short explanation before the questions.",
          },
          {
            title: "Try a small set",
            detail:
              "Focus on understanding the decisions, not proving your speed.",
          },
          {
            title: "Use the next step",
            detail: "Let your result choose what comes next.",
          },
        ],
      },
      onboarding_technique: {
        subject: "A simple technique for unfamiliar UCAT questions",
        preview: "Identify the task, remove weak options, decide, and move.",
        heading: "Use the same decision process on every question",
        paragraphs: [
          "Hi " +
            firstName +
            ", unfamiliar questions feel less overwhelming when you give yourself a repeatable process.",
          "The aim is not to feel certain about every answer. It is to make the best available decision and preserve time for the questions you can solve.",
        ],
        moduleTitle: "A four-step question routine",
        rows: [
          {
            title: "Name the task",
            detail: "What exactly must this answer prove or calculate?",
          },
          {
            title: "Remove weak options",
            detail: "Eliminate answers that conflict with the information.",
          },
          { title: "Choose", detail: "Use the strongest remaining evidence." },
          {
            title: "Move",
            detail: "Flag uncertainty and protect the rest of your time.",
          },
        ],
      },
      onboarding_timing: {
        subject: "UCAT timing starts with knowing when to move on",
        preview: "Speed grows from good decisions, not rushing every step.",
        heading: "Moving on is a UCAT skill",
        paragraphs: [
          "Hi " +
            firstName +
            ", timing does not mean reading and calculating as fast as possible.",
          "First learn a method without pressure. Then practise recognising when another 20 seconds is unlikely to improve your answer.",
        ],
        moduleTitle: "Build timing in the right order",
        rows: [
          {
            title: "Learn untimed",
            detail: "Understand the method well enough to repeat it.",
          },
          {
            title: "Add a short timer",
            detail: "Notice where decisions slow down.",
          },
          {
            title: "Flag and move",
            detail: "Return only if the section leaves you time.",
          },
        ],
      },
      onboarding_plan: {
        subject: "Turn your UCAT preparation into a manageable week",
        preview: "A sustainable plan beats an ambitious one you cannot repeat.",
        heading: "Build a plan that fits your real week",
        paragraphs: [
          "Hi " +
            firstName +
            ", you do not need to study every section every day.",
          "Set your test date, target and realistic availability. Altitutor will turn those inputs and your results into a clear sequence of tasks.",
        ],
        moduleTitle: "Three honest inputs",
        rows: [
          {
            title: "Your test date",
            detail: "Give the plan a real finish line.",
          },
          {
            title: "Your target",
            detail: "Define what you are working towards.",
          },
          {
            title: "Your normal week",
            detail: "Choose time you can protect consistently.",
          },
        ],
      },
    },
    familiar: {
      onboarding_starting_point: {
        subject: "Make your first Altitutor session a useful baseline",
        preview:
          "Representative work gives you better direction than random question volume.",
        heading: "Start with evidence you can act on",
        paragraphs: [
          "Hi " +
            firstName +
            ", because you already know the UCAT format, your first Altitutor session should answer a more useful question: where will focused work help most?",
          "Choose a representative timed set rather than your favourite question type. The result gives your progress view and recommendations a clean baseline.",
        ],
        moduleTitle: "Create a representative baseline",
        rows: [
          {
            title: "Choose a mixed set",
            detail: "Avoid selecting only familiar question types.",
          },
          {
            title: "Keep real timing",
            detail: "Use the same decision pressure you expect on test day.",
          },
          {
            title: "Follow the evidence",
            detail:
              "Use the next recommendation instead of adding random volume.",
          },
        ],
      },
      onboarding_technique: {
        subject: "Improve faster by naming the mistake",
        preview:
          "Method, interpretation and timing errors need different fixes.",
        heading: "Do not treat every wrong answer the same",
        paragraphs: [
          "Hi " +
            firstName +
            ", reviewing the correct option is useful, but the bigger gain comes from identifying why your original decision failed.",
          "Classify the mistake before you practise again. That turns review into a specific change you can test.",
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
            detail: "Did time pressure change an otherwise sound decision?",
          },
        ],
      },
      onboarding_timing: {
        subject: "Use timing checkpoints, not constant rushing",
        preview: "Know when to continue, flag, or cut a slow method.",
        heading: "Manage the section, not just the current question",
        paragraphs: [
          "Hi " +
            firstName +
            ", the most expensive timing mistake is often staying with one solvable-looking question for too long.",
          "Use simple checkpoints to decide whether your current method is still worth the time.",
        ],
        moduleTitle: "Three timing decisions",
        rows: [
          {
            title: "Continue",
            detail: "The route is clear and you are making progress.",
          },
          {
            title: "Simplify",
            detail:
              "A shorter approximation or elimination route is available.",
          },
          {
            title: "Flag and move",
            detail: "The next step is unclear or the working is expanding.",
          },
        ],
      },
      onboarding_plan: {
        subject: "Build your UCAT week around evidence, not habit",
        preview: "Balance sections, then let results adjust the emphasis.",
        heading: "Give every practice session a reason",
        paragraphs: [
          "Hi " +
            firstName +
            ", a useful plan balances enough coverage to stay representative with enough focus to improve.",
          "Altitutor starts from your availability, target and test date, then adjusts the task sequence as your results change.",
        ],
        moduleTitle: "What an adaptive week should do",
        rows: [
          {
            title: "Protect coverage",
            detail: "Keep every cognitive section in view.",
          },
          {
            title: "Add focus",
            detail:
              "Spend more time where recent evidence shows the greatest value.",
          },
          {
            title: "Rebalance",
            detail: "Let new results change the next task.",
          },
        ],
      },
    },
    experienced: {
      onboarding_starting_point: {
        subject: "Use Altitutor to audit your current UCAT preparation",
        preview:
          "Start with representative evidence, then test the gap you find.",
        heading: "Turn your existing preparation into a clearer diagnosis",
        paragraphs: [
          "Hi " +
            firstName +
            ", you probably already have methods and practice history. Your first Altitutor session should help you decide which assumption about your preparation needs testing next.",
          "Use representative timed work, then compare accuracy, pace and the pattern of misses before choosing more volume.",
        ],
        moduleTitle: "Run a useful preparation audit",
        rows: [
          {
            title: "Sample broadly",
            detail:
              "Use work that represents the section, not a comfortable niche.",
          },
          {
            title: "Inspect the pattern",
            detail:
              "Separate isolated misses from repeatable method or pacing problems.",
          },
          {
            title: "Test one gap",
            detail:
              "Choose the next session to challenge the strongest diagnosis.",
          },
        ],
      },
      onboarding_technique: {
        subject: "Make each UCAT session test one change",
        preview: "Deliberate practice works best when the variable is clear.",
        heading: "Practise the change, not just the question type",
        paragraphs: [
          "Hi " +
            firstName +
            ", more questions only help when you know what you are trying to make more reliable.",
          "Choose one method or decision rule, keep the practice conditions stable, then compare the result before changing something else.",
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
              "Check whether accuracy or pace improved without creating a new cost.",
          },
        ],
      },
      onboarding_timing: {
        subject: "Diagnose where your UCAT time is actually going",
        preview: "Average pace can hide a small number of expensive questions.",
        heading: "Look beyond average time per question",
        paragraphs: [
          "Hi " +
            firstName +
            ", a section can feel uniformly rushed even when most of the loss comes from a few high-cost decisions.",
          "Review the distribution: which questions were clean, which became time sinks, and which should have been flagged earlier?",
        ],
        moduleTitle: "A sharper pacing review",
        rows: [
          {
            title: "Clean solves",
            detail: "Protect the methods already producing reliable pace.",
          },
          {
            title: "Recoverable delays",
            detail: "Find the decision or step that can be shortened.",
          },
          {
            title: "Time sinks",
            detail: "Set an earlier trigger to flag and move.",
          },
        ],
      },
      onboarding_plan: {
        subject: "Stop your UCAT plan drifting towards comfortable practice",
        preview:
          "Use new evidence to rebalance effort before habits take over.",
        heading: "Let the plan challenge your current preparation",
        paragraphs: [
          "Hi " +
            firstName +
            ", experienced preparation often becomes less representative over time because familiar work is easier to select and repeat.",
          "Your Altitutor plan uses your test date, availability and recent results to keep coverage while shifting the next tasks towards the most useful gap.",
        ],
        moduleTitle: "Keep the plan adaptive",
        rows: [
          {
            title: "Anchor the deadline",
            detail: "Work backwards from your real test date.",
          },
          {
            title: "Preserve coverage",
            detail: "Do not let a strong or enjoyable section dominate.",
          },
          {
            title: "Reallocate",
            detail: "Use each new result to adjust the next week.",
          },
        ],
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
    const plan = key === "onboarding_plan";
    return {
      ...lesson,
      cta: plan
        ? candidate.has_study_plan
          ? "See this week’s plan"
          : "Build my study plan"
        : key === "onboarding_starting_point"
          ? "Start my first session"
          : "Practise this",
      path: plan
        ? candidate.has_study_plan
          ? "/study-plan"
          : "/study-plan/setup"
        : key === "onboarding_starting_point"
          ? "/dashboard"
          : "/practice",
      module: plan
        ? productPreview("study-plan")
        : key === "onboarding_starting_point"
          ? combineModules(
              numberedModule("Tutor note", lesson.moduleTitle, lesson.rows),
              productPreview("guided-learning"),
            )
          : numberedModule("Tutor note", lesson.moduleTitle, lesson.rows),
      founderLed: true,
    };
  }

  switch (campaign.key) {
    case "first_score_estimate":
      return {
        subject: "Your first UCAT estimate is ready",
        preview: "Use it as a starting point for the next decision.",
        heading: "You now have a starting point",
        paragraphs: [
          "Hi " +
            firstName +
            ", your recent work has created your first UCAT score estimate.",
          "It is not a verdict or a promise about test day. It is a useful baseline that will change as you add more representative evidence.",
        ],
        cta: "See my progress",
        path: "/progress",
        module: estimateModule(candidate.current_estimate ?? 0),
        founderLed: false,
      };
    case "weekly_review":
      return {
        subject: "Your UCAT week and one useful next step",
        preview: "A short summary of the work you completed this week.",
        heading: "Your week in review",
        paragraphs: [
          "Hi " +
            firstName +
            ", here is the useful part of your week at a glance.",
          "Your next step is " +
            nextTitle +
            ". Complete that before adding broad practice, so each session keeps a clear purpose.",
        ],
        cta: "Continue with my next task",
        path: nextPath,
        module: statsModule(candidate),
        founderLed: false,
      };
    case "gentle_restart":
      return {
        subject: "One useful UCAT step when you’re ready",
        preview: "There is nothing to catch up. Start with one small task.",
        heading: "Pick up with one manageable step",
        paragraphs: [
          "Hi " +
            firstName +
            ", a few days away does not undo the work you have already completed.",
          "When you are ready, start with " +
            nextTitle +
            ". One focused session is enough; you do not need to clear a backlog.",
        ],
        cta: candidate.has_study_plan
          ? "Continue my plan"
          : "Start a short session",
        path: nextPath,
        module: numberedModule("A gentle restart", nextTitle, [
          { title: "Open one task", detail: "Ignore everything else for now." },
          {
            title: "Complete one session",
            detail: "A small amount of representative work is enough.",
          },
          {
            title: "Use the new next step",
            detail: "Let that result guide what follows.",
          },
        ]),
        founderLed: false,
      };
    case "upgrade_quota":
      return {
        subject: "Want to keep practising without the reset?",
        preview:
          "Unlimited removes Free allowances and still rewards consistent practice.",
        heading: "Keep your preparation moving",
        paragraphs: [
          "Hi " +
            firstName +
            ", you recently reached a Free practice allowance. Your access will reset as shown in the app, and Free remains available.",
          "If you would rather continue now, Unlimited removes the allowance waits. Its monthly price can also fall as you complete qualifying practice days.",
        ],
        cta: "Compare Unlimited",
        path: "/settings/plan/subscription",
        module: commercialModule(candidate, "quota"),
        founderLed: true,
      };
    case "upgrade_consistency":
      return {
        subject: "Your Unlimited plan can get cheaper as you practise",
        preview:
          "Consistent practice reduces the next monthly Unlimited price.",
        heading: "We built the price around a useful study habit",
        paragraphs: [
          "Hi " +
            firstName +
            ", you have been returning to your UCAT preparation across the week.",
          "On Unlimited, qualifying practice days reduce your next monthly price. Free practice does not bank a discount, but your current rhythm shows how the model is designed to work.",
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
        subject: "Prepare with a friend — and both get " + reward,
        preview: "Share Altitutor UCAT from your referral page.",
        heading: "UCAT preparation is easier with someone alongside you",
        paragraphs: [
          "Hi " +
            firstName +
            ", if you know someone else preparing for the UCAT, you can invite them from your referral page.",
          "When they join Unlimited through your link, you both receive " +
            reward +
            " of Unlimited. The page shows the reward status clearly before anything is applied.",
        ],
        cta: "Invite a friend",
        path: "/settings/plan/referrals",
        module: panel(
          "Your referral reward",
          "You both receive " + reward + " of Unlimited",
          '<p style="margin:0;color:#52606a;font-size:13px;line-height:1.6">Share your personal link. Your friend can explore Altitutor first, and the reward is applied when they start Unlimited.</p>',
          "Share your personal link. Your friend can explore Altitutor first, and the reward is applied when they start Unlimited.",
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
    footerHtml:
      '<p style="margin:0 0 8px;color:#52606a;font-size:12px;line-height:1.6">Questions? Reply or contact <a class="email-link" href="mailto:' +
      ADMIN_EMAIL +
      '" style="color:#0a2941">' +
      ADMIN_EMAIL +
      "</a>.</p>",
    marketingFooterHtml:
      '<p style="margin:0;color:#73808a;font-size:11px;line-height:1.6"><a href="' +
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
    "\n\nA not-for-profit initiative by Altitutor.\nQuestions? " +
    ADMIN_EMAIL +
    "\nEmail preferences: " +
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
