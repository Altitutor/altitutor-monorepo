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
  UCAT_EMAIL_ENVIRONMENT,
  UCAT_EMAIL_SENDERS,
} from "../_shared/ucat-email.ts";

const APP_URL = (
  Deno.env.get("UCAT_WEB_URL") || "https://ucat.altitutor.com"
).replace(/\/$/, "");
const MARKETING_URL = (
  Deno.env.get("MARKETING_WEB_URL") || "https://altitutor.com"
).replace(/\/$/, "");
const SIGNATURE_URL = Deno.env.get("UCAT_FOUNDER_SIGNATURE_URL") ||
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
  "If you have a question or aren't sure where to start, reply to this email. I'd love to help.";
const REPLY_HAND =
  "If you'd like a hand with this, just reply and tell me what you're finding difficult.";

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
  const image = '<img src="' +
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
    "Try this",
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
  const setsAndMocks = (candidate.sets_last_7_days ?? 0) +
    (candidate.mocks_last_7_days ?? 0);
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
  const observation = activeDays >= 3
    ? "You've made time for practice on several days this week. For your next session, try " +
      nextTitle +
      " and leave a few minutes to review your answers."
    : activeDays === 1
    ? "You made time for a session this week. If your schedule allows, choose another day for a short session and some review."
    : "For your next session, try " +
      nextTitle +
      ". Leave a few minutes afterwards to work through any answers you weren't sure about.";
  const estimateLine = delta == null
    ? ""
    : '<p style="margin:14px 0 0;color:#52606a;font-size:13px;line-height:1.55">Estimated score change: <strong class="email-accent" style="color:#1a1a1a">' +
      (delta > 0 ? "+" : "") +
      delta +
      "</strong></p>";
  return panel(
    "Your week",
    "Your practice over the last seven days",
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
  const title = mode === "quota"
    ? "More room for your UCAT preparation"
    : "How monthly practice discounts work";
  const detail = mode === "quota"
    ? "Unlimited gives you access to questions, practice sets, mocks, learning modules and skill trainers without the Free plan's usage limits."
    : "On monthly Unlimited, meeting the daily question target earns a discount towards your next bill. Your subscription page shows the target, discounts earned and upcoming bill.";
  const discountRule = candidate.min_questions_per_day != null
    ? "Complete at least " + candidate.min_questions_per_day +
      " questions in a day on Unlimited to earn that day's practice discount."
    : "Meet the daily question target shown in the app to earn a practice discount on Unlimited.";
  return panel(
    "Unlimited",
    title,
    '<p style="margin:0 0 12px;color:#52606a;font-size:13px;line-height:1.6">' +
      escapeEmailHtml(detail + " " + discountRule) +
      '</p><table class="email-module-surface" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #dce5e8;border-radius:9px"><tr><td style="padding:13px 15px;border-right:1px solid #dce5e8"><p style="margin:0 0 3px;color:#73808a;font-size:11px">Monthly price before discounts</p><p class="email-accent" style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700">' +
      escapeEmailHtml(base) +
      '</p></td><td style="padding:13px 15px"><p style="margin:0 0 3px;color:#73808a;font-size:11px">Discount per practice day</p><p class="email-accent" style="margin:0;color:#1a1a1a;font-size:18px;font-weight:700">−' +
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
      "\n" + discountRule +
      "\nMonthly price before discounts: " +
      base +
      "\nDiscount per qualifying day: " +
      daily +
      (maximum > 0 ? "\nUp to " + maximum + " days per billing period." : ""),
  );
}

function signature(founderLed: boolean): { html: string; text: string } {
  if (!founderLed) {
    return {
      html:
        '<p style="margin:22px 0 0;color:#394650;font-size:14px;line-height:1.6">Matt and the Altitutor UCAT team</p>',
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

function studyPlanScreenshot(campaign: LifecycleCampaign): EmailModule {
  return productScreenshot({
    file: "study-plan-tasks.jpg",
    alt:
      "A day's study plan with a learning module, practice questions, and review",
    caption:
      "Your study plan brings learning, practice and review together so you can see what to work on next.",
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
      "onboarding_starting_point": {
        subject: "Welcome to Altitutor UCAT!",
        preview:
          "We're excited to have you here. Let's start with one short lesson.",
        heading: "Welcome! Let's get you started",
        paragraphs: [
          "Hi " + firstName + ",",
          "I'm Matt, the founder of Altitutor and a doctor here in South Australia. We're excited to have you here! Our team wants to support you throughout your UCAT preparation, especially when you're not sure what to do next.",
          "A good place to start is Learn. Our learning modules explain how to approach UCAT question types and include questions so you can try the methods yourself. You don't need to know the test inside out before you begin.",
          "For your first session, try a Verbal Reasoning module. This section asks you to read a passage and answer questions using the information it gives you. Take your time with the explanations as you go.",
          REPLY_STUCK,
        ],
        moduleTitle: "Try your first learning module",
        rows: [
          {
            title: "Open Learn",
            detail:
              "Choose Verbal Reasoning, then select an introductory module.",
          },
          {
            title: "Work through the examples",
            detail:
              "Pause to try the questions yourself before reading the explanations.",
          },
          {
            title: "Check what you understood",
            detail:
              "If an answer surprises you, return to the passage and find the words that support it.",
          },
        ],
        cta: "Explore learning modules",
        path: "/learn",
      },
      "onboarding_technique": {
        subject: "A useful shortcut for percentage questions",
        preview:
          "Try this worked example before your next Quantitative Reasoning session.",
        heading: "Make percentage changes easier",
        paragraphs: [
          "Hi " + firstName + ",",
          "Percentage questions come up in Quantitative Reasoning, the part of the UCAT where you work with numbers, tables and charts. Here's a method you can practise even if maths feels a little rusty.",
          "Suppose an $80 item goes up in price by 12%. The new price is 112% of the original, so you can calculate $80 × 1.12 = $89.60. For an 8% decrease, you keep 92% of the original price, so you'd multiply by 0.92.",
          "Try the steps below slowly first. Once you understand why the multiplier works, try using it on a percentage question in Practice.",
          REPLY_HAND,
        ],
        moduleTitle: "Work through the $80 example",
        rows: [
          {
            title: "Start with the original 100%",
            detail:
              "For a 12% increase, add 12 to get 112%. For an 8% decrease, subtract 8 to get 92%.",
          },
          {
            title: "Divide the percentage by 100",
            detail:
              "112% becomes 1.12. Multiply $80 by 1.12 to find the new price: $89.60.",
          },
          {
            title: "Check what the question asks for",
            detail:
              "If it asks for the increase itself, subtract the original price: $89.60 − $80 = $9.60.",
          },
        ],
        cta: "Open Quantitative Reasoning practice",
        path: "/practice",
        screenshot: {
          file: "qr-multipliers.jpg",
          alt: "Worked example turning a percentage change into a multiplier",
          caption:
            "A percentage multiplier gives you the new amount. Subtract the original amount if you need the change itself.",
          hrefPath: "/practice",
        },
      },
      "onboarding_timing": {
        subject: "Getting used to the UCAT timer",
        preview:
          "Start with a method you understand, then practise deciding when to move on.",
        heading: "Build up to timed practice",
        paragraphs: [
          "Hi " + firstName + ",",
          "The UCAT timer can feel quite unforgiving at first. It's normal to need longer while you're learning how a question works. Start by getting comfortable with the method, then introduce timed practice a little at a time.",
          "When you're ready, try a short timed session. If you're stuck without a clear next step, choose your best answer, flag the question and move on. You can return to it if you have time left.",
          "Afterwards, open the attempt in Progress. The timing graph shows how long you spent on each question, which can help you choose what to work on next.",
          REPLY_HAND,
        ],
        moduleTitle: "Try this in your next timed session",
        rows: [
          {
            title: "Pick a topic you have practised",
            detail:
              "If the method is still unfamiliar, spend a little more time on it without the timer first.",
          },
          {
            title: "Notice when you stop making progress",
            detail:
              "Make your best choice and flag the question if you are rereading or repeating the same working.",
          },
          {
            title: "Review one slow question",
            detail:
              "Check its explanation. Was there a simpler approach, or a point where you could have moved on?",
          },
        ],
        cta: "Try timed practice",
        path: "/practice",
        screenshot: {
          file: "timing-graph.jpg",
          alt: "An example timing graph showing time spent on each question",
          caption:
            "Taller bars show where you spent more time. Check those questions alongside their explanations.",
          hrefPath: "/practice",
        },
      },
      "onboarding_plan": {
        subject: "How to review a question you got wrong",
        preview:
          "Read the explanation, then try the question again in your own words.",
        heading: "Get more out of your practice questions",
        paragraphs: [
          "Hi " + firstName + ",",
          "Getting questions wrong is part of learning the UCAT. What helps is taking a little time afterwards to understand an answer that surprised you.",
          "In Progress, open a completed attempt and select a question you got wrong or guessed. You can read the explanation alongside it. Try to work out why the correct option fits and why your original choice doesn't.",
          "Once it makes sense, look away from the explanation and try the question again. Being able to explain the steps yourself is a useful check that you've understood them.",
          REPLY_HAND,
        ],
        moduleTitle: "Review one question today",
        rows: [
          {
            title: "Open a completed attempt",
            detail:
              "Go to Progress and choose a recent session. If you haven't finished one yet, try a few questions in Practice first.",
          },
          {
            title: "Read the explanation slowly",
            detail:
              "Find the information or step you missed. Go back to the question to check it for yourself.",
          },
          {
            title: "Try again without the explanation",
            detail:
              "Talk yourself through the answer. If you still get stuck, revisit the matching topic in Learn.",
          },
        ],
        cta: "Open my attempt history",
        path: "/progress",
        screenshot: {
          file: "attempt-review.jpg",
          alt: "An example question review with a worked explanation",
          caption:
            "In your attempt review, select a question to read its explanation alongside it.",
          hrefPath: "/progress",
        },
      },
    },
    familiar: {
      "onboarding_starting_point": {
        subject: "Welcome to Altitutor UCAT!",
        preview: "A warm welcome from Matt, and a simple way to try Learn.",
        heading: "We're glad you're here",
        paragraphs: [
          "Hi " + firstName + ",",
          "I'm Matt, the founder of Altitutor and a doctor in South Australia. Thanks for joining us! We're excited to support you as you prepare for the UCAT.",
          "You mentioned that you've done some preparation already. I'd suggest starting with a learning module on a question type you still find tricky. Learn takes you through an approach and gives you questions to try along the way, so it's a useful way to check the basics even if the format is familiar.",
          "Choose one topic today. You don't need to work through a whole section to get something useful out of your first session.",
          REPLY_STUCK,
        ],
        moduleTitle: "Find a lesson that helps you",
        rows: [
          {
            title: "Open Learn",
            detail:
              "Choose a section, then a module on a question type you sometimes get stuck on.",
          },
          {
            title: "Try the questions yourself",
            detail:
              "Have a go before reading the explanation, even if you recognise the method.",
          },
          {
            title: "Take away one useful idea",
            detail:
              "Notice a step you missed or a simpler way of working, then try it on the next question.",
          },
        ],
        cta: "Find a learning module",
        path: "/learn",
      },
      "onboarding_technique": {
        subject: "Work out why a question went wrong",
        preview:
          "A missed detail and an unfamiliar method need different kinds of practice.",
        heading: "Make your next practice session more useful",
        paragraphs: [
          "Hi " + firstName + ",",
          "When you get a question wrong, it's tempting to read the answer and move on. Before you do, try to explain to yourself what went wrong. That makes it much easier to choose something useful to practise next.",
          "Open a recent attempt in Progress and choose one question you missed or guessed. Read its explanation, then use the checks below. For example, missing the word 'except' calls for a different fix from not knowing how to calculate a percentage.",
          REPLY_HAND,
        ],
        moduleTitle: "Three things to check",
        rows: [
          {
            title: "Did I understand the question?",
            detail:
              "Look for a word, condition or piece of information you overlooked.",
          },
          {
            title: "Did I know how to solve it?",
            detail:
              "If the method was unfamiliar, work through the explanation slowly or revisit that topic in Learn.",
          },
          {
            title: "Did I rush or get stuck?",
            detail:
              "Try it again without time pressure. If you can solve it now, think about where the time went.",
          },
        ],
        cta: "Review a recent attempt",
        path: "/progress",
      },
      "onboarding_timing": {
        subject: "Find where your practice time is going",
        preview:
          "Your timing graph can help you choose one question to work on.",
        heading: "Take a closer look at your timing",
        paragraphs: [
          "Hi " + firstName + ",",
          "If a section feels rushed, the timing graph in Progress is a useful place to look. A few difficult questions can take more time than you realise, including questions you eventually answer correctly.",
          "Open a recent timed attempt and look for the taller bars. Choose one and read the explanation alongside the question. Think about whether you needed a different method, missed some information, or kept going after you got stuck.",
          "The aim is to make better decisions about your time. Different question types take different amounts of work, so you don't need every bar to be the same height.",
          REPLY_HAND,
        ],
        moduleTitle: "Review one question that took a while",
        rows: [
          {
            title: "Open a timed attempt in Progress",
            detail:
              "Look at the timing graph and select a question you spent a lot of time on.",
          },
          {
            title: "Find what slowed you down",
            detail:
              "Compare your approach with the explanation. Practise an unfamiliar step without the timer.",
          },
          {
            title: "Choose what to try next time",
            detail:
              "Use the simpler method, or make your best choice and flag the question when you get stuck.",
          },
        ],
        cta: "Look at my timing",
        path: "/progress",
        screenshot: {
          file: "timing-graph.jpg",
          alt: "An example timing graph showing time spent on each question",
          caption:
            "Taller bars show where you spent more time. Check those questions alongside their explanations.",
          hrefPath: "/progress",
        },
      },
      "onboarding_plan": {
        subject: "Turn a worked explanation into something you can use",
        preview:
          "Try solving a reviewed question again before your next session.",
        heading: "Check that the explanation has sunk in",
        paragraphs: [
          "Hi " + firstName + ",",
          "An explanation can seem obvious while you're reading it, then be hard to recall when a similar question comes up. A useful check is to try the question again without looking at the worked answer.",
          "Open a recent attempt in Progress and choose a question you got wrong or guessed. Compare the explanation with your working and find the first point where you missed information or took an unhelpful step. A different method can still be valid, so focus on what caused the difficulty.",
          "Then solve it again yourself. When you next practise that topic, see whether you can use what you've learnt on a new question too.",
          REPLY_HAND,
        ],
        moduleTitle: "Make review part of your session",
        rows: [
          {
            title: "Choose one question to revisit",
            detail:
              "Include answers you guessed correctly, as well as mistakes.",
          },
          {
            title: "Explain the difficult step",
            detail:
              "Use your own words to describe what you missed and how you would approach it next time.",
          },
          {
            title: "Try it without help",
            detail:
              "Look away from the explanation and redo the question. Leave time for this at the end of your next session.",
          },
        ],
        cta: "Review a recent attempt",
        path: "/progress",
        screenshot: {
          file: "attempt-review.jpg",
          alt: "An example question review with a worked explanation",
          caption:
            "In your attempt review, select a question to read its explanation alongside it.",
          hrefPath: "/progress",
        },
      },
    },
    experienced: {
      "onboarding_starting_point": {
        subject: "Welcome to Altitutor UCAT!",
        preview:
          "Meet Matt and try a practice session with worked explanations.",
        heading: "Welcome to your next stage of UCAT prep",
        paragraphs: [
          "Hi " + firstName + ",",
          "I'm Matt, the founder of Altitutor and a doctor in South Australia. We're excited to have you here! Whether you're refining your approach or revisiting a section you've struggled with, our team is here to help.",
          "Since you've prepared for the UCAT before, try a short session in Practice to get to know the platform. Choose a section you'd like to improve, answer a few questions, then read the worked explanations. They can help you spot a missed detail or an approach you haven't tried.",
          "If a method feels rusty, take your time and work through it without a timer first. Having experience doesn't mean you need to rush past the basics.",
          REPLY_STUCK,
        ],
        moduleTitle: "Try Practice and its explanations",
        rows: [
          {
            title: "Choose a section",
            detail: "Open Practice and pick an area you want to work on.",
          },
          {
            title: "Answer a few questions",
            detail:
              "Use your usual approach. Untimed practice is fine while you get familiar with the platform.",
          },
          {
            title: "Read the explanations",
            detail:
              "Check questions you guessed as well as ones you got wrong. Learn is there if you need a refresher.",
          },
        ],
        cta: "Try practice questions",
        path: "/practice",
      },
      "onboarding_technique": {
        subject: "Try one small change in your next session",
        preview: "Use a recent mistake to choose what to practise.",
        heading: "Give your next session a clear purpose",
        paragraphs: [
          "Hi " + firstName + ",",
          "If you've been doing plenty of questions but keep making similar mistakes, it can help to focus on one change for a session. Start with a question you recently got wrong or took a long time to solve.",
          "For example, if you keep missing conditions in Decision Making, try writing down each condition before working through the options. Practise that slowly enough to see whether it helps, then bring the timer back in.",
          "You don't need to replace your whole approach. Use the explanation in your attempt review to find one step worth trying differently.",
          REPLY_HAND,
        ],
        moduleTitle: "Try one change and check it",
        rows: [
          {
            title: "Choose a recurring difficulty",
            detail:
              "Be specific: for example, overlooking a condition or doing more calculations than the question needs.",
          },
          {
            title: "Practise a different approach",
            detail:
              "Try a few similar questions. Give yourself time to understand the new step before trying to speed it up.",
          },
          {
            title: "Review the result",
            detail:
              "Did the change help you answer more reliably? Check the explanations as well as your score.",
          },
        ],
        cta: "Try a focused practice session",
        path: "/practice",
      },
      "onboarding_timing": {
        subject: "Ready to try a little more time pressure?",
        preview:
          "Check your accuracy at exam pace before trying a faster setting.",
        heading: "Build speed without losing your method",
        paragraphs: [
          "Hi " + firstName + ",",
          "Before turning up the pace, check a few recent timed attempts. Can you answer reliably at exam pace and explain how you got there? If you're still guessing often or running out of time, keep practising the method at a pace where you can use it properly.",
          "If your accuracy is steady at exam pace, you could try one short session at 1.25× exam speed. This gives you less time per question, so use a topic you know well and check your answers carefully afterwards.",
          "If you start skipping important steps or making more mistakes, ease the pace back. The faster setting is a practice option, and there's no need to use it before you're ready.",
          REPLY_HAND,
        ],
        moduleTitle: "Use the pace setting thoughtfully",
        rows: [
          {
            title: "Check a few recent attempts",
            detail:
              "Look for consistent accuracy at exam pace, including questions you answered correctly by guessing.",
          },
          {
            title: "Try 1.25× on a familiar topic",
            detail:
              "Keep the session short so you can review it properly afterwards.",
          },
          {
            title: "Compare accuracy and timing",
            detail:
              "Read the explanations for mistakes and slow answers. Return to exam pace if the faster setting makes your method unreliable.",
          },
        ],
        cta: "Explore practice pace settings",
        path: "/practice",
        screenshot: {
          file: "practice-pace.jpg",
          alt: "Practice pace settings showing 1.25 times exam speed",
          caption:
            "Choose a pace that lets you use your method reliably. Faster practice can wait until you are comfortable at exam pace.",
          hrefPath: "/practice",
        },
      },
      "onboarding_plan": {
        subject: "Include uncertain answers in your review",
        preview: "A correct guess can show you just as much as a wrong answer.",
        heading: "Look beyond the questions you missed",
        paragraphs: [
          "Hi " + firstName + ",",
          "When you review an attempt, it's worth including questions you answered correctly but weren't sure about. A correct guess can hide a gap that will show up again on a different question.",
          "Open a recent attempt in Progress and choose an uncertain or unusually slow answer. Compare your reasoning with the explanation. If your method was sound, keep it; if you relied on a guess or a long detour, work through the step that would have helped.",
          "Try the question again without the explanation, then test the same approach on a fresh question in your next session. This gives you a better check than recognising an answer you've just read.",
          REPLY_HAND,
        ],
        moduleTitle: "Review for understanding",
        rows: [
          {
            title: "Pick an uncertain or slow answer",
            detail:
              "Use the timing graph and your memory of the attempt to choose one.",
          },
          {
            title: "Check your reasoning",
            detail:
              "Find the evidence or calculation that supports the answer. Notice anything your original approach missed.",
          },
          {
            title: "Try it again independently",
            detail:
              "Explain each step to yourself, then practise applying it to a different question.",
          },
        ],
        cta: "Review my recent practice",
        path: "/progress",
        screenshot: {
          file: "attempt-review.jpg",
          alt: "An example question review with a worked explanation",
          caption:
            "In your attempt review, select a question to read its explanation alongside it.",
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
  const nextTitle = candidate.next_step_title?.trim() ||
    "a short practice session";
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
        subject: "Use your results to choose what to practise next",
        preview:
          "Progress can help you find a question type that needs a little more attention.",
        heading: "Get to know your results in Progress",
        paragraphs: [
          "Hi " + firstName + ",",
          "You've now done enough practice for your first score estimate. This is a useful time to explore Progress, where you can look back at your attempts and see which question types you're finding easier or harder.",
          "Open a recent attempt and look at its category breakdown. For example, if syllogisms are proving difficult, review a couple of those questions and their explanations before choosing your next session. Syllogisms ask you to work out what must follow from a set of statements.",
          "Treat the breakdown as a starting point. A category with only a few answers can change a lot with your next session, so look for difficulties that show up more than once. If you're unsure of the method, a learning module on that topic can help.",
          REPLY_HAND,
        ],
        cta: "Explore my results",
        path: "/progress",
        module: productScreenshot({
          file: "category-breakdown.jpg",
          alt: "An example attempt broken down by question type",
          caption:
            "These are example results. In your own breakdown, check how many questions you've answered as well as how many were correct.",
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
        subject: "Your weekly UCAT check-in",
        preview:
          "A look at your recent practice and a suggestion for your next session.",
        heading: "Let's plan your next practice session",
        paragraphs: [
          "Hi " + firstName + ",",
          "Well done for making time for your UCAT preparation this week. Your practice summary is below, along with a suggestion for what to work on next.",
          "Before starting something new, take a few minutes to revisit one question you got wrong or guessed. Read the explanation, then see if you can work through it yourself. That gives you something specific to carry into your next session.",
          "When you're ready, your next suggested activity is " + nextTitle +
          ". Choose a time that fits around your other commitments and leave some room to review afterwards.",
          REPLY_HAND,
        ],
        cta: "Open my next activity",
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
        subject: "Ready to pick up your UCAT prep again?",
        preview:
          "Start with a small session whenever you're ready. We're here to help.",
        heading: "Let's ease back into practice",
        paragraphs: [
          "Hi " + firstName + ",",
          "It's been a little while since your last session. School, work and everything else can make it hard to find time for UCAT prep, so please don't feel you need to make up for the break all at once.",
          "When you're ready, try " + nextTitle +
          ". Give yourself time to remember the approach, and use the explanations if something feels rusty. Even a few carefully reviewed questions can be a useful first session back.",
          "If finding time has been the difficult part, pick a small slot in your week that feels realistic. You can build from there.",
          REPLY_HAND,
        ],
        cta: "Open my next activity",
        path: nextPath,
        module: candidate.has_study_plan
          ? studyPlanScreenshot(campaign)
          : numberedModule(
            "Getting started again",
            "Keep your first session manageable",
            [
              {
                title: "Choose a small amount of work",
                detail:
                  "Try a few questions or revisit a lesson. Start with an amount you can comfortably fit in today.",
              },
              {
                title: "Leave time to review",
                detail:
                  "Read the explanation for an answer you weren't sure about, then try working through it again.",
              },
            ],
          ),
        founderLed: true,
      };
    case "upgrade_quota":
      return {
        subject: "Reached your Free practice limit? Here's what you can do",
        preview:
          "Check when your allowance resets, or explore Unlimited if you need more practice.",
        heading: "Your options for continuing practice",
        paragraphs: [
          "Hi " + firstName + ",",
          "You recently reached your Free allowance for " +
          quotaAreaLabel(candidate.last_quota_area) +
          ". The app shows when that allowance resets. In the meantime, you can revisit completed attempts in Progress and work through their explanations.",
          "If you'd like more practice before the reset, UCAT Unlimited removes the Free plan's usage limits. You can compare the plans and see the full price on your subscription page before deciding.",
          "Monthly Unlimited also offers practice discounts towards your next bill. The details below explain how those work. You're welcome to keep preparing on Free if that suits you better.",
        ],
        cta: "See plans and pricing",
        path: "/settings/plan/subscription",
        module: commercialModule(candidate, "quota"),
        founderLed: true,
      };
    case "upgrade_consistency":
      return {
        subject: "How regular practice can reduce an Unlimited bill",
        preview:
          "A guide to practice discounts if you're considering monthly Unlimited.",
        heading: "A little about our practice discounts",
        paragraphs: [
          "Hi " + firstName + ",",
          "It's lovely to see you making time for UCAT practice. If you're considering Unlimited, I wanted to explain a part of our pricing that might be useful to you.",
          "On monthly Unlimited, each day you meet the question target earns a discount towards your next bill, up to the limit below. Simply logging in doesn't count; you need to complete the daily question target.",
          "Practice on Free doesn't earn discounts towards a future subscription. Discounts start once you have Unlimited access, and your subscription page shows your progress and bill details. Have a look if more practice access would help with your preparation.",
        ],
        cta: "See Unlimited and practice discounts",
        path: "/settings/plan/subscription",
        module: commercialModule(candidate, "consistency"),
        founderLed: true,
      };
    case "referral_invitation":
      return {
        subject: "Help a friend get started with UCAT prep",
        preview:
          "Your referral page has a personal link to share an Unlimited gift.",
        heading: "Share Altitutor with a friend",
        paragraphs: [
          "Hi " + firstName + ",",
          "If a friend is also preparing for the UCAT, you can share a gift of Unlimited access through your referral page. It gives them a chance to try the learning modules, practice questions and other tools for themselves.",
          "Open Referrals in your plan settings to find your personal link. The page explains the gift available to your friend and the reward you can receive when they accept it. Check those details, then copy the link and send it to someone you think would find it useful.",
          "Thank you for helping more students find Altitutor. Making preparation accessible is why we built it, and your support means a lot to us.",
        ],
        cta: "Open my referral page",
        path: "/settings/plan/referrals",
        module: numberedModule("Sharing your gift", "How to invite a friend", [
          {
            title: "Check your gift and reward",
            detail:
              "Your referral page shows what's available with your plan and how your friend can accept.",
          },
          {
            title: "Copy your personal link",
            detail:
              "Send it to your friend so they can read the offer and decide whether to use it.",
          },
          {
            title: "Follow their invitation",
            detail:
              "Return to your referral page to see referral activity and any rewards you've earned.",
          },
        ]),
        founderLed: true,
      };
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
  const unsubscribeUrl = APP_URL +
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
    bodyHtml: paragraphs +
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
  const text = content.heading +
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
      { name: "environment", value: UCAT_EMAIL_ENVIRONMENT },
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
    unlimited_started_at: key === "referral_invitation"
      ? "2026-07-01T00:00:00Z"
      : null,
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
