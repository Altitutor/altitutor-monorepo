import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  Target,
  Zap,
} from "lucide-react";

export type FeatureCardPreviewId =
  | "practice-simulator"
  | "study-plan-snapshot"
  | "learning-module-snapshot"
  | "progress-plan-snapshot";

export type FeatureDetailPreviewId =
  | "practice-simulator"
  | "practice-calculator"
  | "practice-keyboard-shortcuts"
  | "practice-filters"
  | "practice-pace"
  | "practice-skill-trainer"
  | "study-plan-calendar"
  | "study-plan-target-score"
  | "study-plan-setup"
  | "study-plan-orb"
  | "study-plan-insights"
  | "learn-section-directory"
  | "learn-worked-example"
  | "learn-guided-walkthrough"
  | "learn-remediation-directory"
  | "progress-practice-discounts"
  | "progress-section-strengths"
  | "review-explanation-dm"
  | "review-timing-interactive"
  | "progress-score-tracking"
  | "progress-score-insight";

export type UcatFeatureTheme = {
  accent: string;
  accentBg: string;
  iconBg: string;
};

/** Shared accent for all feature cards marketing navy. */
const FEATURE_THEME: UcatFeatureTheme = {
  accent: "#0a2941",
  accentBg: "bg-marketing-primary/10",
  iconBg: "bg-marketing-primary/10 text-marketing-primary",
};

export type UcatFeatureDetail = {
  title: string;
  body: string;
  previewId: FeatureDetailPreviewId;
};

export type UcatFeature = {
  slug: string;
  number: string;
  eyebrow: string;
  title: string;
  cardHeadline: string;
  body: string;
  points: readonly string[];
  icon: LucideIcon;
  theme: UcatFeatureTheme;
  cardPreviewId: FeatureCardPreviewId;
  /** Card preview bleeds to the left, right, and bottom edges of the feature card. */
  cardPreviewBleed?: boolean;
  details: readonly UcatFeatureDetail[];
};

export const UCAT_FEATURES: readonly UcatFeature[] = [
  {
    slug: "practice-and-simulation",
    number: "01",
    eyebrow: "Practice and exam simulation",
    title: "A UCAT simulator that feels like test day.",
    cardHeadline: "A simulator that feels like test day.",
    body: "Choose focused question practice, timed section sets, or a complete mock. The simulator reproduces the UCAT’s distinctive controls and layout, so the interface feels familiar before test day.",
    points: [
      "Filtered practice by section, question type, timing, and performance",
      "Timed section sets and full mocks",
      "UCAT-replica navigator, calculator, flagging, and keyboard shortcuts",
    ],
    icon: Zap,
    theme: FEATURE_THEME,
    cardPreviewId: "practice-simulator",
    cardPreviewBleed: false,
    details: [
      {
        title: "UCAT simulator",
        body: "Practice inside the same navigator, toolbar, and layout you will see on test day.",
        previewId: "practice-simulator",
      },
      {
        title: "Calculator",
        body: "Master the on-screen UCAT calculator to build your speed for test day.",
        previewId: "practice-calculator",
      },
      {
        title: "Keyboard shortcuts",
        body: "Move through questions, open tools, and submit answers without leaving the keyboard.",
        previewId: "practice-keyboard-shortcuts",
      },
      {
        title: "Practice filters",
        body: "Choose a section, then turn question categories on or off to target the work that matters.",
        previewId: "practice-filters",
      },
      {
        title: "Timed and untimed practice",
        body: "Build accuracy first, then dial in exam pace with a timed slider when you are ready.",
        previewId: "practice-pace",
      },
      {
        title: "Skill trainers",
        body: "Isolate specific skills to hone your speed and accuracy.",
        previewId: "practice-skill-trainer",
      },
    ],
  },
  {
    slug: "adaptive-study-plan",
    number: "02",
    eyebrow: "Adaptive study plan",
    title: "Turn your weaknesses into a daily plan that moves your score.",
    cardHeadline: "A study plan that adapts to your progress.",
    body: "Altitutor UCAT analyzes your section gaps, pacing patterns, and recent attempts, then schedules learning, practice, review, and mocks day by day so your predicted score keeps climbing.",
    points: [
      "Daily tasks targeted at your weakest sections and question types",
      "Planned mocks and review built in before test day",
      "Adapts to your strengths and weaknesses as you progress",
    ],
    icon: CalendarDays,
    theme: FEATURE_THEME,
    cardPreviewId: "study-plan-snapshot",
    details: [
      {
        title: "Study plan",
        body: "See today’s tasks update as you work through learning, practice, review, and mocks.",
        previewId: "study-plan-calendar",
      },
      {
        title: "Set your target score",
        body: "Choose the score you are preparing for and track whether your trajectory is on course.",
        previewId: "study-plan-target-score",
      },
      {
        title: "Pick your study days",
        body: "Tell us your test date, target, and the days you can study so the plan fits your schedule.",
        previewId: "study-plan-setup",
      },
      {
        title: "Study orb",
        body: "Your companion suggests what to do next and celebrates progress as you complete tasks.",
        previewId: "study-plan-orb",
      },
      {
        title: "Insights",
        body: "Insights identify patterns in your practice and suggest improvements.",
        previewId: "study-plan-insights",
      },
    ],
  },
  {
    slug: "guided-learning",
    number: "03",
    eyebrow: "Guided learning",
    title: "Learn the method with guided practice.",
    cardHeadline:
      "Learning modules teach techniques, then guide you through questions.",
    body: "Short learning modules explain the reasoning behind each UCAT skill and place relevant questions inside the lesson. Skill trainers help you isolate the smaller abilities that make the full task easier.",
    points: [
      "Learning modules teach you through every technique you need to know for the UCAT",
      "Concept teaching, worked examples, and tutor tips",
      "Embedded questions and skill trainer drills for immediate application",
    ],
    icon: BookOpen,
    theme: FEATURE_THEME,
    cardPreviewId: "learning-module-snapshot",
    cardPreviewBleed: true,
    details: [
      {
        title: "Comprehensive notes",
        body: "Learning modules cover everything you need to know for the UCAT, from introductory concepts to advanced techniques.",
        previewId: "learn-section-directory",
      },
      {
        title: "Worked examples",
        body: "Step through tutor-style explanations before you attempt questions on your own.",
        previewId: "learn-worked-example",
      },
      {
        title: "Guided walkthroughs",
        body: "Onboarding-style coach marks highlight calculator, flagging, and navigator as you practice.",
        previewId: "learn-guided-walkthrough",
      },
      {
        title: "Target your weaknesses",
        body: "Remediation folders surface the modules your gaps and recent attempts point to.",
        previewId: "learn-remediation-directory",
      },
    ],
  },
  {
    slug: "progress-and-planning",
    number: "04",
    eyebrow: "Progress and analytics",
    title: "Analyse your performance, question by question.",
    cardHeadline:
      "See your estimated score improve over time.",
    body: "Follow your historical estimate and projected score range, then drill into question-by-question review with explanations and timing. Attempt-level analytics reveal patterns that a final score alone would miss.",
    points: [
      "Question-by-question answers, explanations, and timing",
      "Weekly score estimates based on your real practice",
      "Intelligent score trajectory prediction based on your past performance",
    ],
    icon: Target,
    theme: FEATURE_THEME,
    cardPreviewId: "progress-plan-snapshot",
    cardPreviewBleed: true,
    details: [
      {
        title: "Practice day discounts",
        body: "Earn discounts on Unlimited for every qualifying practice day in your billing period.",
        previewId: "progress-practice-discounts",
      },
      {
        title: "See weaknesses and strengths",
        body: "Category breakdowns show your best and worst question types within each section.",
        previewId: "progress-section-strengths",
      },
      {
        title: "Explanations",
        body: "Review the question, your answer, and a full explanation side by side.",
        previewId: "review-explanation-dm",
      },
      {
        title: "Timing comparison",
        body: "Spot questions where you spent far too long, with insight into what to change.",
        previewId: "review-timing-interactive",
      },
      {
        title: "Score tracking",
        body: "Follow your estimate over time and see how close you are to your target.",
        previewId: "progress-score-tracking",
      },
      {
        title: "Score estimation",
        body: "Understand your current estimate, plausible range, and projected improvement.",
        previewId: "progress-score-insight",
      },
    ],
  },
];

export type UcatFeatureSlug = UcatFeature["slug"];
