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
import { ACCURATE_SLOW_PREPARATION_PERSONA } from "@/features/preparation/testing/personas";
import type {
  StudyPlanCategorySignal,
  StudyPlanSection,
  StudyPlanSectionSignal,
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
        availableDays: [
          { weekday: 1, maxMinutes: 90 },
          { weekday: 3, maxMinutes: 90 },
          { weekday: 6, maxMinutes: 90 },
        ],
        preferredMockWeekday: 6,
        sjtPreference: "a_little",
      },
    },
    content: {
      sections: SECTIONS,
      categories: categories(),
      learningModules: SECTIONS.slice(0, 3).map((section) => ({
        id: `module-${section.id}`,
        title: `${section.shortName} foundations`,
        sectionId: section.id,
        sectionNumber: section.sectionNumber,
        priority: "essential" as const,
        estimatedMinutes: 15,
        completionPercent: 0,
        relevanceScore: 1,
      })),
      skillTrainers: [
        {
          id: "trainer-dm",
          key: "decision_making_warmup",
          name: "Decision Making warm-up",
          sectionId: "dm",
          categoryIds: ["dm-category-1"],
          estimatedMinutes: 3,
        },
      ],
    },
    evidence: {
      sectionSignals: sectionSignals(),
      completedMockCount: 0,
      forecast: {
        expectedAdherence: 0.8,
        adherenceUncertainty: 0.15,
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
    marksAwarded: section.questionCount * (accuracyBySection[section.id] ?? 0.6),
    marksAvailable: section.questionCount,
    questionCount: section.questionCount,
    sectionQuestionCount: section.questionCount,
    wasTimed: true,
    prescribedPace: 1,
    breadth: "broad" as const,
    feedbackWithheld: true,
    isStudentGenerated: false,
    isStandardised: true,
  }));
}

function setExperiencedEvidence(
  input: PreparationEngineInput,
  accuracyBySection: Record<string, number>,
  paceBySection: Record<string, number>,
): void {
  input.content.learningModules = input.content.learningModules.map((module) => ({
    ...module,
    completionPercent: 100,
  }));
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
  input.evidence.sectionSignals = input.evidence.sectionSignals.map((signal) => {
    const section = SECTIONS.find((candidate) => candidate.id === signal.sectionId)!;
    const accuracy = accuracyBySection[signal.sectionId] ?? 0.7;
    const pace = paceBySection[signal.sectionId] ?? 1;
    return {
      ...signal,
      currentEstimate: section.sectionNumber <= 3 ? Math.round(300 + accuracy * 600) : null,
      evidenceCount: 6,
      scoreConfidence: section.sectionNumber <= 3 ? "medium" as const : null,
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
    };
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
  "experienced-high-performing": fixture(
    "experienced-high-performing",
    "Experienced, high-performing",
    "Broad, accurate evidence recognises prior preparation and avoids unnecessary lessons.",
    (input) => setExperiencedEvidence(input, { vr: 0.84, dm: 0.82, qr: 0.86 }, { vr: 1, dm: 1, qr: 1 }),
  ),
  "accurate-slow": fixture(
    "accurate-slow",
    "Accurate but slow",
    "Strong accuracy with useful pace work still outstanding.",
    (input) => Object.assign(input, ACCURATE_SLOW_PREPARATION_PERSONA.apply(input)),
  ),
  "fast-inaccurate": fixture(
    "fast-inaccurate",
    "Fast but inaccurate",
    "Fast natural pace is held while accuracy and method evidence catch up.",
    (input) => setExperiencedEvidence(input, { vr: 0.44, dm: 0.48, qr: 0.46 }, { vr: 1.2, dm: 1.15, qr: 1.25 }),
  ),
  "uneven-sections": fixture(
    "uneven-sections",
    "Uneven sections",
    "Strong QR, developing DM and weak VR exercise section-specific assessment.",
    (input) => setExperiencedEvidence(input, { vr: 0.42, dm: 0.64, qr: 0.86 }, { vr: 0.7, dm: 0.85, qr: 1 }),
  ),
  "low-availability": fixture(
    "low-availability",
    "Low availability",
    "One available day exposes capacity trade-offs instead of an unlimited backlog.",
    (input) => {
      input.goal.profile.availableDays = [{ weekday: 6, maxMinutes: 120 }];
      setExperiencedEvidence(input, { vr: 0.62, dm: 0.65, qr: 0.67 }, { vr: 0.8, dm: 0.8, qr: 0.85 });
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
        maxMinutes: 180,
      }));
      setExperiencedEvidence(input, { vr: 0.7, dm: 0.72, qr: 0.74 }, { vr: 1, dm: 1, qr: 1 });
    },
  ),
} satisfies Record<string, PreparationSandboxCase>;

function dailyWork(result: PreparationEngineResult, today: string) {
  return Array.from({ length: 21 }, (_, day) => {
    const date = addDays(today, day);
    const tasks = result.plan.tasks.filter((task) => task.scheduledDate === date);
    return {
      date,
      practiceMinutes: tasks.reduce((total, task) => {
        const split = task.launchConfig.practiceMinutes;
        return total +
          (typeof split === "number"
            ? split
            : task.taskType === "review"
              ? 0
              : task.estimatedMinutes);
      }, 0),
      reviewMinutes: tasks.reduce((total, task) => {
        const split = task.launchConfig.reviewMinutes;
        if (task.taskType === "review") {
          return total +
            (typeof split === "number" ? split : task.estimatedMinutes);
        }
        return total +
          (task.taskType === "mock" && typeof split === "number" ? split : 0);
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
