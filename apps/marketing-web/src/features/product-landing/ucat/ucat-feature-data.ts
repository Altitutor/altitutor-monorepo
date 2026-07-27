import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Target,
  Zap,
} from "lucide-react";

export type FeatureCardPreviewId =
  | "practice-simulator"
  | "review-score-snapshot"
  | "learning-module-snapshot"
  | "progress-plan-snapshot";

export type FeatureDetailPreviewId =
  | "practice-filters"
  | "practice-timing-toggle"
  | "practice-access-arrangements"
  | "practice-calculator"
  | "review-score-breakdown"
  | "review-explanation"
  | "review-timing-chart"
  | "learn-concept-block"
  | "learn-embedded-question"
  | "learn-skill-trainer"
  | "progress-estimate-gauge"
  | "progress-trajectory"
  | "progress-plan-tasks";

export type UcatFeatureTheme = {
  accent: string;
  accentBg: string;
  iconBg: string;
};

/** Shared accent for all feature cards — marketing light blue. */
const FEATURE_THEME: UcatFeatureTheme = {
  accent: "#92b9c6",
  accentBg: "bg-marketing-accent/15",
  iconBg: "bg-marketing-accent/20 text-marketing-accent",
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
    title: "Build the skill—and the familiarity to use it under pressure.",
    cardHeadline:
      "Practise with focus, then step into a simulator that feels like test day.",
    body: "Choose focused question practice, timed section sets, or a complete mock. The simulator reproduces the UCAT’s distinctive controls and layout, so the interface feels familiar before test day.",
    points: [
      "Filtered practice by section, question type, timing, and performance",
      "Timed section sets and 30+ full mocks",
      "UCAT-style navigator, calculator, flagging, and keyboard shortcuts",
    ],
    icon: Zap,
    theme: FEATURE_THEME,
    cardPreviewId: "practice-simulator",
    cardPreviewBleed: false,
    details: [
      {
        title: "Customise practice sessions",
        body: "Tailor sessions to your strengths and weaknesses, and find the exact question set you need to improve.",
        previewId: "practice-filters",
      },
      {
        title: "Take control of your practice",
        body: "Increase your accuracy with untimed practice, then focus on speed with timed practice when you are ready.",
        previewId: "practice-timing-toggle",
      },
      {
        title: "Simulate access arrangements",
        body: "Practise with extra time if you have a disability, such as a learning difficulty or sensory impairment.",
        previewId: "practice-access-arrangements",
      },
      {
        title: "Improve your timing",
        body: "Master the on-screen UCAT calculator to build your speed to the maximum for test day.",
        previewId: "practice-calculator",
      },
    ],
  },
  {
    slug: "review-and-analytics",
    number: "02",
    eyebrow: "Review and analytics",
    title: "Turn every attempt into evidence you can use.",
    cardHeadline:
      "See every answer, explanation, and timing pattern from each attempt.",
    body: "Review the question, your answer, the correct answer, the explanation, and your timing in one place. Attempt-level analytics then reveal patterns that a final score alone would miss.",
    points: [
      "Question-by-question answers and explanations",
      "Accuracy, pacing, and question-level timing",
      "Attempt insights that carry into your progress and plan",
    ],
    icon: BarChart3,
    theme: FEATURE_THEME,
    cardPreviewId: "review-score-snapshot",
    details: [
      {
        title: "Estimate your UCAT score",
        body: "See a mock score breakdown with section estimates and percentile context from timed evidence.",
        previewId: "review-score-breakdown",
      },
      {
        title: "Learn from your mistakes",
        body: "Read the explanation, compare your answer with the correct one, and understand why each option works or fails.",
        previewId: "review-explanation",
      },
      {
        title: "Spot pacing problems early",
        body: "Compare your time on each question with the average so you can see where speed is costing marks.",
        previewId: "review-timing-chart",
      },
    ],
  },
  {
    slug: "guided-learning",
    number: "03",
    eyebrow: "Guided learning",
    title: "Learn the method, then check that you can apply it.",
    cardHeadline:
      "Short modules teach the method, then check that you can apply it.",
    body: "Short learning modules explain the reasoning behind each UCAT skill and place relevant questions inside the lesson. Skill trainers help you isolate the smaller abilities that make the full task easier.",
    points: [
      "Concept teaching, worked examples, and tutor notes",
      "Questions embedded inside the learning sequence",
      "Focused trainers for timing, reading, logic, and calculation skills",
    ],
    icon: BookOpen,
    theme: FEATURE_THEME,
    cardPreviewId: "learning-module-snapshot",
    details: [
      {
        title: "Learn the method first",
        body: "Concept blocks and worked examples explain the reasoning behind each UCAT skill before you practise it.",
        previewId: "learn-concept-block",
      },
      {
        title: "Check understanding in context",
        body: "Relevant questions sit inside the lesson so you apply the method immediately—not weeks later in a random set.",
        previewId: "learn-embedded-question",
      },
      {
        title: "Isolate smaller skills",
        body: "Skill trainers focus on timing, reading pace, logic steps, or calculation speed—the building blocks of the full task.",
        previewId: "learn-skill-trainer",
      },
    ],
  },
  {
    slug: "progress-and-planning",
    number: "04",
    eyebrow: "Progress and planning",
    title: "Know where you stand. Open the app and know what to do next.",
    cardHeadline:
      "Track your estimate, see the gap to your target, and open a plan built for you.",
    body: "Follow your historical estimate and future score trajectory, compare the gap to your target, and turn that evidence into a realistic schedule. Your plan selects specific learning, practice, review, sets, and mocks around the time you have available.",
    points: [
      "Current estimate, confidence range, and target gap",
      "Historical progress and a future score projection",
      "Specific next tasks in an adaptive plan through to test day",
    ],
    icon: Target,
    theme: FEATURE_THEME,
    cardPreviewId: "progress-plan-snapshot",
    details: [
      {
        title: "See your current position",
        body: "Your estimate, plausible range, and confidence level update as you complete more timed evidence.",
        previewId: "progress-estimate-gauge",
      },
      {
        title: "Follow the trajectory",
        body: "Historical estimates and a future projection show whether you are on track for your target.",
        previewId: "progress-trajectory",
      },
      {
        title: "Know what to do next",
        body: "Your adaptive plan selects specific learning, practice, review, sets, and mocks around the time you have.",
        previewId: "progress-plan-tasks",
      },
    ],
  },
];

export type UcatFeatureSlug = UcatFeature["slug"];
