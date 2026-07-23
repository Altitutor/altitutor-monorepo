export const UCAT_FEATURES = [
  {
    slug: "practice-and-simulation",
    number: "01",
    eyebrow: "Practice and exam simulation",
    title: "Build the skill—and the familiarity to use it under pressure.",
    body: "Choose focused question practice, timed section sets, or a complete mock. The simulator reproduces the UCAT’s distinctive controls and layout, so the interface feels familiar before test day.",
    points: [
      "Filtered practice by section, question type, timing, and performance",
      "Timed section sets and 30+ full mocks",
      "UCAT-style navigator, calculator, flagging, and keyboard shortcuts",
    ],
  },
  {
    slug: "review-and-analytics",
    number: "02",
    eyebrow: "Review and analytics",
    title: "Turn every attempt into evidence you can use.",
    body: "Review the question, your answer, the correct answer, the explanation, and your timing in one place. Attempt-level analytics then reveal patterns that a final score alone would miss.",
    points: [
      "Question-by-question answers and explanations",
      "Accuracy, pacing, and question-level timing",
      "Attempt insights that carry into your progress and plan",
    ],
  },
  {
    slug: "guided-learning",
    number: "03",
    eyebrow: "Guided learning",
    title: "Learn the method, then check that you can apply it.",
    body: "Short learning modules explain the reasoning behind each UCAT skill and place relevant questions inside the lesson. Skill trainers help you isolate the smaller abilities that make the full task easier.",
    points: [
      "Concept teaching, worked examples, and tutor notes",
      "Questions embedded inside the learning sequence",
      "Focused trainers for timing, reading, logic, and calculation skills",
    ],
  },
  {
    slug: "progress-and-planning",
    number: "04",
    eyebrow: "Progress and planning",
    title: "Know where you stand. Open the app and know what to do next.",
    body: "Follow your historical estimate and future score trajectory, compare the gap to your target, and turn that evidence into a realistic schedule. Your plan selects specific learning, practice, review, sets, and mocks around the time you have available.",
    points: [
      "Current estimate, confidence range, and target gap",
      "Historical progress and a future score projection",
      "Specific next tasks in an adaptive plan through to test day",
    ],
  },
] as const;

export type UcatFeature = (typeof UCAT_FEATURES)[number];
export type UcatFeatureSlug = UcatFeature["slug"];
