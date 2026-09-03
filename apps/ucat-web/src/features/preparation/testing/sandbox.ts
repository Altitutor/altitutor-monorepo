import { prepareStudent } from "@/features/preparation/lib/engine";
import {
  CURRENT_PREPARATION_VERSIONS,
  STANDARD_PREPARATION_TIMING_PROFILE,
} from "@/features/preparation/lib/policy";
import type {
  PreparationEngineInput,
  PreparationEngineResult,
  PreparationVersions,
} from "@/features/preparation/model/types";
import type {
  StudyPlanCategorySignal,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
} from "@/features/study-plan/model/types";

export const PREPARATION_SANDBOX_SCHEMA_VERSION = 1 as const;

export type PreparationSandboxCase = {
  schemaVersion: typeof PREPARATION_SANDBOX_SCHEMA_VERSION;
  key: string;
  label: string;
  description: string;
  input: PreparationEngineInput;
};

export type PreparationSandboxRun = {
  fixture: PreparationSandboxCase;
  result: PreparationEngineResult;
  dailyWork: Array<{
    date: string;
    practiceMinutes: number;
    reviewMinutes: number;
  }>;
};

export type PreparationSandboxPolicy = {
  versions: PreparationVersions;
  timingProfile: PreparationEngineInput["timingProfile"];
};

export type PreparationSandboxComparisonCase = {
  schemaVersion: typeof PREPARATION_SANDBOX_SCHEMA_VERSION;
  fixture: PreparationSandboxCase;
  policies: {
    left: PreparationSandboxPolicy;
    right: PreparationSandboxPolicy;
  };
};

export type PreparationSandboxJourney = {
  key: string;
  label: string;
  description: string;
  checkpoints: Array<{
    fixtureKey: keyof typeof PREPARATION_SANDBOX_PERSONAS;
    label: string;
    description: string;
  }>;
};

const SECTIONS: StudyPlanSection[] = [
  ["vr", "verbal_reasoning", "Verbal Reasoning", "VR", 1, 44, 47],
  ["dm", "decision_making", "Decision Making", "DM", 2, 35, 64],
  ["qr", "quantitative_reasoning", "Quantitative Reasoning", "QR", 3, 36, 42],
  ["sjt", "situational_judgement", "Situational Judgement", "SJT", 4, 69, 32],
].map(([id, key, name, shortName, sectionNumber, questionCount, seconds]) => ({
  id: String(id),
  key: key as StudyPlanSection["key"],
  name: String(name),
  shortName: String(shortName),
  sectionNumber: Number(sectionNumber),
  questionCount: Number(questionCount),
  timePerQuestionSeconds: Number(seconds),
}));

// Mirrors the enabled production trainers that currently have approved,
// active content. The preview uses fixture section IDs but keeps production
// trainer identities, ordering and configured one-minute duration.
const SKILL_TRAINERS = [
  {
    id: "a1000001-0000-4000-8000-000000000001",
    key: "find_word",
    name: "Find the word",
    sectionId: "vr",
    categoryIds: [],
    estimatedMinutes: 1,
  },
  {
    id: "a1000001-0000-4000-8000-000000000003",
    key: "quick_syllogism",
    name: "Quick syllogisms",
    sectionId: "dm",
    categoryIds: [],
    estimatedMinutes: 1,
  },
  {
    id: "a1000001-0000-4000-8000-000000000004",
    key: "mental_maths",
    name: "Mental maths",
    sectionId: "qr",
    categoryIds: [],
    estimatedMinutes: 1,
  },
  {
    id: "a1000001-0000-4000-8000-000000000006",
    key: "calculator_maths",
    name: "Calculator maths speed",
    sectionId: "qr",
    categoryIds: [],
    estimatedMinutes: 1,
  },
  {
    id: "a1000001-0000-4000-8000-000000000005",
    key: "numpad_speed",
    name: "Numpad speed",
    sectionId: "qr",
    categoryIds: [],
    estimatedMinutes: 1,
  },
] satisfies StudyPlanSkillTrainer[];

const CATEGORY_NAMES: Record<string, string[]> = {
  vr: ["Reading Comprehension", "True, False, Can’t Tell"],
  dm: [
    "Logical Puzzles",
    "Probability and Statistics",
    "Recognising Assumptions",
    "Syllogisms",
    "Venn Diagrams",
  ],
  qr: ["Quantitative Reasoning"],
  sjt: ["Situational Judgement"],
};

const LEARNING_MODULE_TITLES: Record<string, string[]> = {
  vr: [
    "Reading for structure",
    "Main idea and author purpose",
    "Evaluating statements from the passage",
    "Handling dense passages",
  ],
  dm: [
    "Drawing valid conclusions",
    "Structuring logical puzzles",
    "Working with probability",
    "Testing arguments and assumptions",
  ],
  qr: [
    "Setting up calculations",
    "Working with rates and proportions",
    "Reading tables and charts",
    "Choosing efficient numerical methods",
  ],
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function categories(): StudyPlanCategorySignal[] {
  return SECTIONS.flatMap((section) =>
    (CATEGORY_NAMES[section.id] ?? []).map((name, index) => ({
      id: `${section.id}-category-${index + 1}`,
      sectionId: section.id,
      name,
      availableQuestionCount: 80,
      correctScore: 0,
      maxScore: 0,
      weaknessScore: 0.5,
      attemptedQuestionCount: 0,
      completedPracticeSessions: 0,
      qualifyingPracticeSessions: 0,
      largestPracticeSessionQuestionCount: 0,
      recentAccuracy: null,
      observedPace: null,
    })),
  );
}

function sectionSignals(): StudyPlanSectionSignal[] {
  return SECTIONS.map((section) => ({
    sectionId: section.id,
    currentEstimate: null,
    evidenceCount: 0,
    completedFullSets: 0,
    attemptedQuestionCount: 0,
    completedPracticeSessions: 0,
    qualifyingPracticeSessions: 0,
    largestPracticeSessionQuestionCount: 0,
    recentAccuracy: null,
    observedPace: null,
  }));
}

function baseInput(): PreparationEngineInput {
  return {
    clock: {
      today: "2026-01-05",
      now: "2026-01-05T00:00:00.000Z",
    },
    seed: "sandbox:new-student:v1",
    versions: CURRENT_PREPARATION_VERSIONS,
    timingProfile: STANDARD_PREPARATION_TIMING_PROFILE,
    goal: {
      planningDate: "2026-08-05",
      profile: {
        studyPlanEnabled: true,
        targetScore: 2200,
        testYear: 2026,
        testDate: "2026-08-05",
        availableDays: [{ weekday: 1 }, { weekday: 3 }, { weekday: 6 }],
        preferredMockWeekday: 6,
        sjtPreference: "a_little",
      },
    },
    content: {
      sections: SECTIONS,
      categories: categories(),
      learningModules: SECTIONS.slice(0, 3).flatMap((section) =>
        (LEARNING_MODULE_TITLES[section.id] ?? []).map((title, index) => ({
          id: `module-${section.id}-${index + 1}`,
          title,
          sectionId: section.id,
          sectionNumber: section.sectionNumber,
          priority:
            index < 3 ? ("essential" as const) : ("recommended" as const),
          authoredOrder: index + 1,
          categoryIds: [
            `${section.id}-category-${
              (index % (CATEGORY_NAMES[section.id]?.length ?? 1)) + 1
            }`,
          ],
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
        })),
      ),
      skillTrainers: SKILL_TRAINERS,
      benchmarkSets: SECTIONS.slice(0, 3).flatMap((section) =>
        [0.5, 0.8, 1].map((pace) => ({
          id: `${section.id}-set-${pace}`,
          name: `${section.shortName} ${pace.toFixed(1)}× set`,
          sectionId: section.id,
          questionCount: section.questionCount,
          pace,
          completedAttempts: [],
        })),
      ),
      benchmarkMocks: Array.from({ length: 8 }, (_, index) => ({
        id: `mock-${index + 1}`,
        name: `UCAT mock ${index + 1}`,
        completedAttempts: [],
      })),
    },
    evidence: {
      sectionSignals: sectionSignals(),
      completedMockCount: 0,
      forecast: {
        expectedPlanUptake: 0.5,
        planUptakeUncertainty: 0.25,
      },
    },
    guidance: {
      dailyWarmup: false,
      incompleteReview: null,
      trainerAttemptCounts: {},
    },
  };
}

function representativeEvidence(
  input: PreparationEngineInput,
  accuracyBySection: Record<string, number>,
): void {
  input.evidence.scoreEvidence = SECTIONS.slice(0, 3).map((section) => ({
    evidenceSessionId: `${input.seed}:${section.id}`,
    source: "mock" as const,
    sectionId: section.id,
    sectionNumber: section.sectionNumber,
    completedAt: input.clock.now,
    marksAwarded:
      section.questionCount * (accuracyBySection[section.id] ?? 0.6),
    marksAvailable: section.questionCount,
    questionCount: section.questionCount,
    sectionQuestionCount: section.questionCount,
    sectionCategoryCount: 4,
    wasTimed: true,
    prescribedPace: 1,
    breadth: "broad" as const,
    feedbackWithheld: true,
    isStudentGenerated: false,
    categoryIds: [`${section.id}-category-1`, `${section.id}-category-2`],
  }));
}

function setExperiencedEvidence(
  input: PreparationEngineInput,
  accuracyBySection: Record<string, number>,
  paceBySection: Record<string, number>,
): void {
  input.content.learningModules = input.content.learningModules.map(
    (module) => ({
      ...module,
      completionPercent: 100,
    }),
  );
  input.content.categories = input.content.categories.map((category) => {
    const accuracy = accuracyBySection[category.sectionId] ?? 0.7;
    const pace = paceBySection[category.sectionId] ?? 1;
    return {
      ...category,
      correctScore: Math.round(accuracy * 30),
      maxScore: 30,
      weaknessScore: 1 - accuracy,
      attemptedQuestionCount: 30,
      completedPracticeSessions: 4,
      qualifyingPracticeSessions: 3,
      largestPracticeSessionQuestionCount: 15,
      recentAccuracy: accuracy,
      observedPace: pace,
    };
  });
  input.evidence.sectionSignals = input.evidence.sectionSignals.map(
    (signal) => {
      const section = SECTIONS.find(
        (candidate) => candidate.id === signal.sectionId,
      )!;
      const accuracy = accuracyBySection[signal.sectionId] ?? 0.7;
      const pace = paceBySection[signal.sectionId] ?? 1;
      return {
        ...signal,
        currentEstimate:
          section.sectionNumber <= 3 ? Math.round(300 + accuracy * 600) : null,
        evidenceCount: 6,
        scoreConfidence:
          section.sectionNumber <= 3 ? ("medium" as const) : null,
        completedFullSets: section.sectionNumber <= 3 ? 2 : 0,
        attemptedQuestionCount: section.questionCount * 3,
        completedPracticeSessions: 5,
        qualifyingPracticeSessions: 4,
        largestPracticeSessionQuestionCount: section.questionCount,
        recentAccuracy: accuracy,
        observedPace: pace,
        representativeSessionCount: 3,
        representativeSectionEquivalents: 2,
        representativeAccuracy: accuracy,
        benchmarkCompleted: section.sectionNumber <= 3,
        benchmarkAccuracy: accuracy,
        benchmarkPace: pace,
        prescribedPace: Math.min(1, pace),
        prescribedPaceSetAt: input.clock.now,
        pacePolicyVersion: input.versions.policy,
        learningGraduatedAt:
          section.sectionNumber <= 3
            ? `${addDays(input.clock.today, -35)}T00:00:00.000Z`
            : null,
        learningGraduationRoute:
          section.sectionNumber <= 3 ? ("experience" as const) : null,
      };
    },
  );
  input.evidence.timingSessions = SECTIONS.slice(0, 3).flatMap((section) => {
    const accuracy = accuracyBySection[section.id] ?? 0.7;
    const pace = paceBySection[section.id] ?? 1;
    return [
      {
        id: `mock-history:${section.id}`,
        sectionId: section.id,
        source: "mock" as const,
        completedAt: `${addDays(input.clock.today, -35)}T00:00:00.000Z`,
        prescribedPace: 1,
        observedPace: pace,
        accuracy,
        sectionEquivalents: 1,
        breadth: "broad" as const,
        categoryIds: [],
      },
      {
        id: `set-history:${section.id}`,
        sectionId: section.id,
        source: "set" as const,
        completedAt: `${addDays(input.clock.today, -10)}T00:00:00.000Z`,
        prescribedPace: Math.min(1, pace),
        observedPace: pace,
        accuracy,
        sectionEquivalents: 1,
        breadth: "broad" as const,
        categoryIds: [],
      },
      {
        id: `practice-history:${section.id}`,
        sectionId: section.id,
        source: "practice" as const,
        completedAt: `${addDays(input.clock.today, -5)}T00:00:00.000Z`,
        prescribedPace: Math.min(1, pace),
        observedPace: pace,
        accuracy,
        sectionEquivalents: 0.55,
        breadth: "narrow" as const,
        categoryIds: [`${section.id}-category-1`],
      },
    ];
  });
  representativeEvidence(input, accuracyBySection);
  input.evidence.completedMockCount = 2;
}

function fixture(
  key: string,
  label: string,
  description: string,
  apply?: (input: PreparationEngineInput) => void,
): PreparationSandboxCase {
  const input = baseInput();
  input.seed = `sandbox:${key}:v1`;
  apply?.(input);
  return {
    schemaVersion: PREPARATION_SANDBOX_SCHEMA_VERSION,
    key,
    label,
    description,
    input,
  };
}

export const PREPARATION_SANDBOX_PERSONAS = {
  "new-student": fixture(
    "new-student",
    "New student",
    "No prior evidence; begins with methods and representative exposure.",
  ),
  "learning-progressing": fixture(
    "learning-progressing",
    "Learning foundations in progress",
    "The Student has completed an initial learning loop and the plan rotates to the next outstanding section.",
    (input) => {
      input.content.learningModules = input.content.learningModules.map(
        (module) =>
          module.id === "module-vr-1"
            ? { ...module, completionPercent: 100 }
            : module,
      );
      input.content.categories = input.content.categories.map((category) =>
        category.sectionId === "vr"
          ? {
              ...category,
              correctScore: 7,
              maxScore: 10,
              weaknessScore: 0.3,
              attemptedQuestionCount: 10,
              completedPracticeSessions: 1,
              qualifyingPracticeSessions: 1,
              largestPracticeSessionQuestionCount: 10,
              recentAccuracy: 0.7,
            }
          : category,
      );
      input.evidence.lastLearningModuleServedAtBySection = {
        vr: input.clock.now,
      };
    },
  ),
  "benchmark-ready": fixture(
    "benchmark-ready",
    "Ready for first benchmarks",
    "Essential learning and broad category exposure are complete, so full-section diagnostics come next.",
    (input) => {
      input.content.learningModules = input.content.learningModules.map(
        (module) => ({ ...module, completionPercent: 100 }),
      );
      input.content.categories = input.content.categories.map((category) => ({
        ...category,
        correctScore: 15,
        maxScore: 20,
        weaknessScore: 0.25,
        attemptedQuestionCount: 20,
        completedPracticeSessions: 2,
        qualifyingPracticeSessions: 2,
        largestPracticeSessionQuestionCount: 10,
        recentAccuracy: 0.75,
        observedPace: 0.7,
      }));
      input.evidence.sectionSignals = input.evidence.sectionSignals.map(
        (signal) => ({
          ...signal,
          attemptedQuestionCount: 40,
          completedPracticeSessions: 2,
          qualifyingPracticeSessions: 2,
          largestPracticeSessionQuestionCount: 20,
          recentAccuracy: 0.75,
          observedPace: 0.7,
          representativeSessionCount: 2,
          representativeSectionEquivalents: 1,
          representativeAccuracy: 0.75,
          benchmarkCompleted: false,
        }),
      );
    },
  ),
  "recommended-learning": fixture(
    "recommended-learning",
    "Benchmark shows more learning is useful",
    "Essential modules are complete, but a weak first benchmark keeps the section in Learning and unlocks recommended modules.",
    (input) => {
      input.content.learningModules = input.content.learningModules.map(
        (module) => ({
          ...module,
          completionPercent: module.priority === "essential" ? 100 : 0,
        }),
      );
      input.content.categories = input.content.categories.map((category) => ({
        ...category,
        correctScore: 10,
        maxScore: 20,
        weaknessScore: 0.5,
        attemptedQuestionCount: 20,
        completedPracticeSessions: 2,
        qualifyingPracticeSessions: 2,
        largestPracticeSessionQuestionCount: 10,
        recentAccuracy: 0.5,
        observedPace: 0.7,
      }));
      input.evidence.sectionSignals = input.evidence.sectionSignals.map(
        (signal) => ({
          ...signal,
          attemptedQuestionCount: 40,
          completedPracticeSessions: 2,
          qualifyingPracticeSessions: 2,
          largestPracticeSessionQuestionCount: 20,
          recentAccuracy: 0.5,
          observedPace: 0.7,
          representativeSessionCount: 2,
          representativeSectionEquivalents: 1,
          representativeAccuracy: 0.5,
          benchmarkCompleted: true,
          benchmarkAccuracy: 0.5,
          benchmarkPace: 0.7,
        }),
      );
    },
  ),
  "experienced-high-performing": fixture(
    "experienced-high-performing",
    "Experienced, high-performing",
    "Broad, accurate evidence recognises prior preparation and avoids unnecessary lessons.",
    (input) =>
      setExperiencedEvidence(
        input,
        { vr: 0.84, dm: 0.82, qr: 0.86 },
        { vr: 1, dm: 1, qr: 1 },
      ),
  ),
  "accurate-slow": fixture(
    "accurate-slow",
    "Accurate but slow",
    "Strong accuracy with useful pace work still outstanding.",
    (input) =>
      setExperiencedEvidence(
        input,
        { vr: 0.84, dm: 0.8, qr: 0.82 },
        { vr: 0.65, dm: 0.75, qr: 0.8 },
      ),
  ),
  "fast-inaccurate": fixture(
    "fast-inaccurate",
    "Fast but inaccurate",
    "Fast natural pace is held while accuracy and method evidence catch up.",
    (input) =>
      setExperiencedEvidence(
        input,
        { vr: 0.44, dm: 0.48, qr: 0.46 },
        { vr: 1.2, dm: 1.15, qr: 1.25 },
      ),
  ),
  "uneven-sections": fixture(
    "uneven-sections",
    "Uneven sections",
    "Strong QR, developing DM and weak VR exercise section-specific assessment.",
    (input) =>
      setExperiencedEvidence(
        input,
        { vr: 0.42, dm: 0.64, qr: 0.86 },
        { vr: 0.7, dm: 0.85, qr: 1 },
      ),
  ),
  "calibration-due": fixture(
    "calibration-due",
    "Section benchmark due",
    "At least 1.5 targeted section-equivalents have accumulated since the last full-section Set, so a fresh calibration is due.",
    (input) => {
      setExperiencedEvidence(
        input,
        { vr: 0.58, dm: 0.66, qr: 0.76 },
        { vr: 0.8, dm: 0.85, qr: 0.9 },
      );
      input.evidence.timingSessions?.push({
        id: "practice-history:vr:extra",
        sectionId: "vr",
        source: "practice",
        completedAt: `${addDays(input.clock.today, -2)}T00:00:00.000Z`,
        prescribedPace: 0.8,
        observedPace: 0.8,
        accuracy: 0.58,
        sectionEquivalents: 1,
        breadth: "narrow",
        categoryIds: ["vr-category-1"],
      });
    },
  ),
  "low-availability": fixture(
    "low-availability",
    "Low availability",
    "One available day exposes capacity trade-offs instead of an unlimited backlog.",
    (input) => {
      input.goal.profile.availableDays = [{ weekday: 6 }];
      setExperiencedEvidence(
        input,
        { vr: 0.62, dm: 0.65, qr: 0.67 },
        { vr: 0.8, dm: 0.8, qr: 0.85 },
      );
    },
  ),
  "imminent-exam": fixture(
    "imminent-exam",
    "Imminent exam",
    "Final-month mock cadence, capacity and recovery policy are visible together.",
    (input) => {
      input.goal.planningDate = addDays(input.clock.today, 20);
      input.goal.profile.testDate = input.goal.planningDate;
      input.goal.profile.availableDays = [0, 1, 2, 3, 4, 5].map((weekday) => ({
        weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5,
      }));
      setExperiencedEvidence(
        input,
        { vr: 0.7, dm: 0.72, qr: 0.74 },
        { vr: 1, dm: 1, qr: 1 },
      );
    },
  ),
} satisfies Record<string, PreparationSandboxCase>;

export const PREPARATION_SANDBOX_JOURNEYS: PreparationSandboxJourney[] = [
  {
    key: "foundations",
    label: "First-time Student",
    description:
      "Follow the transition from first methods through targeted loops to full-section diagnostics.",
    checkpoints: [
      {
        fixtureKey: "new-student",
        label: "Starting point",
        description: "No prior evidence or completed learning.",
      },
      {
        fixtureKey: "learning-progressing",
        label: "After initial learning loops",
        description: "One section has begun building reliable experience.",
      },
      {
        fixtureKey: "benchmark-ready",
        label: "Ready for first benchmarks",
        description: "Essential learning and broad exposure are complete.",
      },
      {
        fixtureKey: "recommended-learning",
        label: "Benchmark needs more learning",
        description: "Recommended modules follow a weak first benchmark.",
      },
    ],
  },
  {
    key: "timing",
    label: "Timing improvement",
    description:
      "Compare how the plan responds when pace and accuracy are out of balance.",
    checkpoints: [
      {
        fixtureKey: "accurate-slow",
        label: "Accurate but slow",
        description: "Accuracy is protected while pace increases gradually.",
      },
      {
        fixtureKey: "fast-inaccurate",
        label: "Fast but inaccurate",
        description:
          "Timing pressure is held while method and accuracy recover.",
      },
      {
        fixtureKey: "experienced-high-performing",
        label: "Reliable at exam pace",
        description: "Broad evidence supports advanced preparation.",
      },
      {
        fixtureKey: "calibration-due",
        label: "Fresh section benchmark due",
        description:
          "Targeted work since the last Set now needs recalibration.",
      },
    ],
  },
  {
    key: "uneven",
    label: "Uneven sections",
    description:
      "See section-specific decisions when strengths, weaknesses and pace differ.",
    checkpoints: [
      {
        fixtureKey: "uneven-sections",
        label: "Mixed section readiness",
        description: "Strong QR, developing DM and weak VR.",
      },
    ],
  },
  {
    key: "constraints",
    label: "Time and capacity pressure",
    description:
      "Inspect prioritisation when study days are scarce or the test is close.",
    checkpoints: [
      {
        fixtureKey: "low-availability",
        label: "One study day per week",
        description: "The plan must prioritise within limited availability.",
      },
      {
        fixtureKey: "imminent-exam",
        label: "Test in 20 days",
        description: "Exam preparation and mock cadence take precedence.",
      },
    ],
  },
];

function dailyWork(result: PreparationEngineResult, today: string) {
  return Array.from({ length: 21 }, (_, day) => {
    const date = addDays(today, day);
    const tasks = result.plan.tasks.filter(
      (task) => task.scheduledDate === date,
    );
    return {
      date,
      practiceMinutes: tasks.reduce((total, task) => {
        const split = task.launchConfig.practiceMinutes;
        return (
          total +
          (typeof split === "number"
            ? split
            : task.taskType === "review"
              ? 0
              : task.estimatedMinutes)
        );
      }, 0),
      reviewMinutes: tasks.reduce((total, task) => {
        const split = task.launchConfig.reviewMinutes;
        if (task.taskType === "review") {
          return (
            total + (typeof split === "number" ? split : task.estimatedMinutes)
          );
        }
        return total;
      }, 0),
    };
  });
}

export function runPreparationSandboxCase(
  fixture: PreparationSandboxCase,
): PreparationSandboxRun {
  const safeFixture = clone(fixture);
  const result = prepareStudent(safeFixture.input);
  return {
    fixture: safeFixture,
    result,
    dailyWork: dailyWork(result, safeFixture.input.clock.today),
  };
}

export function exportPreparationSandboxCase(
  fixture: PreparationSandboxCase,
): string {
  return JSON.stringify(fixture, null, 2);
}

export function replayPreparationSandboxCase(
  exported: string,
): PreparationSandboxRun {
  const parsed = JSON.parse(exported) as PreparationSandboxCase;
  if (parsed.schemaVersion !== PREPARATION_SANDBOX_SCHEMA_VERSION) {
    throw new Error("Unsupported Preparation sandbox fixture version.");
  }
  return runPreparationSandboxCase(parsed);
}

export function exportPreparationSandboxComparison(
  comparison: Omit<PreparationSandboxComparisonCase, "schemaVersion">,
): string {
  return JSON.stringify(
    {
      schemaVersion: PREPARATION_SANDBOX_SCHEMA_VERSION,
      ...comparison,
    } satisfies PreparationSandboxComparisonCase,
    null,
    2,
  );
}

export function replayPreparationSandboxComparison(exported: string): {
  fixture: PreparationSandboxCase;
  policies: PreparationSandboxComparisonCase["policies"];
  left: PreparationSandboxRun;
  right: PreparationSandboxRun;
} {
  const parsed = JSON.parse(exported) as PreparationSandboxComparisonCase;
  if (
    parsed.schemaVersion !== PREPARATION_SANDBOX_SCHEMA_VERSION ||
    parsed.fixture?.schemaVersion !== PREPARATION_SANDBOX_SCHEMA_VERSION
  ) {
    throw new Error("Unsupported Preparation sandbox comparison version.");
  }
  return {
    fixture: parsed.fixture,
    policies: parsed.policies,
    ...comparePreparationSandboxCase(parsed.fixture, parsed.policies),
  };
}

export function comparePreparationSandboxCase(
  fixture: PreparationSandboxCase,
  policies: { left: PreparationSandboxPolicy; right: PreparationSandboxPolicy },
): { left: PreparationSandboxRun; right: PreparationSandboxRun } {
  const left = clone(fixture);
  const right = clone(fixture);
  left.input.versions = clone(policies.left.versions);
  left.input.timingProfile = clone(policies.left.timingProfile);
  right.input.versions = clone(policies.right.versions);
  right.input.timingProfile = clone(policies.right.timingProfile);
  return {
    left: runPreparationSandboxCase(left),
    right: runPreparationSandboxCase(right),
  };
}
