import { daysBetween } from "@/features/study-plan/lib/dates";
import type {
  StudyPlanCategorySignal,
  StudyPlanReadinessRoute,
  StudyPlanReadinessSnapshot,
  StudyPlanReadinessUnit,
  StudyPlanSection,
  StudyPlanSectionReadiness,
  StudyPlanSectionSignal,
  StudyPlanTrainingMode,
} from "@/features/study-plan/model/types";

export const STUDY_PLAN_DETAILED_HORIZON_DAYS = 21;
export const STUDY_PLAN_EXAM_OVERRIDE_DAYS = 60;
export const LEARNING_COVERAGE_QUESTIONS = 20;
export const LEARNING_EXPOSURE_EXIT_QUESTIONS = 40;
export const LEARNING_MIN_SESSIONS = 2;
export const LEARNING_QUALIFYING_SESSION_QUESTIONS = 10;
export const LEARNING_RELIABLE_ACCURACY = 0.65;
export const PACE_LADDER = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3] as const;

type ReadinessInput = {
  today: string;
  planningDate: string;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
};

function finiteNonNegative(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function accuracyFor(input: {
  recentAccuracy?: number | null;
  correctScore: number;
  maxScore: number;
}): number | null {
  if (input.recentAccuracy != null && Number.isFinite(input.recentAccuracy)) {
    return Math.max(0, Math.min(1, input.recentAccuracy));
  }
  return input.maxScore > 0
    ? Math.max(0, Math.min(1, input.correctScore / input.maxScore))
    : null;
}

export function paceLadderStep(
  observedPace: number | null | undefined,
): number {
  if (observedPace == null || !Number.isFinite(observedPace)) return 0.5;
  const clamped = Math.max(PACE_LADDER[0], Math.min(1.3, observedPace));
  return [...PACE_LADDER].reverse().find((pace) => pace <= clamped) ?? 0.5;
}

function routeForUnit(input: {
  attemptedQuestionCount: number;
  completedPracticeSessions: number;
  qualifyingPracticeSessions: number;
  largestPracticeSessionQuestionCount: number;
  accuracy: number | null;
  completedFullSets: number;
  examDateOverride: boolean;
}): StudyPlanReadinessRoute {
  if (input.examDateOverride) return "exam_override";
  const hasCoverage =
    input.attemptedQuestionCount >= LEARNING_COVERAGE_QUESTIONS &&
    input.completedPracticeSessions >= LEARNING_MIN_SESSIONS &&
    input.qualifyingPracticeSessions >= 1 &&
    input.largestPracticeSessionQuestionCount >=
      LEARNING_QUALIFYING_SESSION_QUESTIONS;
  if (hasCoverage && input.completedFullSets > 0) return "full_set";
  if (hasCoverage && (input.accuracy ?? 0) >= LEARNING_RELIABLE_ACCURACY) {
    return "accuracy";
  }
  if (
    input.attemptedQuestionCount >= LEARNING_EXPOSURE_EXIT_QUESTIONS &&
    input.completedPracticeSessions >= 3 &&
    input.qualifyingPracticeSessions >= 2
  ) {
    return "exposure";
  }
  return null;
}

function unit(input: {
  id: string;
  name: string;
  scope: StudyPlanReadinessUnit["scope"];
  attemptedQuestionCount: number;
  completedPracticeSessions: number;
  qualifyingPracticeSessions: number;
  largestPracticeSessionQuestionCount: number;
  accuracy: number | null;
  completedFullSets: number;
  examDateOverride: boolean;
}): StudyPlanReadinessUnit {
  const readinessRoute = routeForUnit(input);
  return {
    id: input.id,
    name: input.name,
    scope: input.scope,
    attemptedQuestionCount: input.attemptedQuestionCount,
    completedPracticeSessions: input.completedPracticeSessions,
    qualifyingPracticeSessions: input.qualifyingPracticeSessions,
    largestPracticeSessionQuestionCount:
      input.largestPracticeSessionQuestionCount,
    accuracy: input.accuracy,
    coverageComplete:
      input.attemptedQuestionCount >= LEARNING_COVERAGE_QUESTIONS &&
      input.completedPracticeSessions >= LEARNING_MIN_SESSIONS &&
      input.qualifyingPracticeSessions >= 1 &&
      input.largestPracticeSessionQuestionCount >=
        LEARNING_QUALIFYING_SESSION_QUESTIONS,
    learningComplete: readinessRoute != null,
    readinessRoute,
  };
}

function categoryUnit(
  category: StudyPlanCategorySignal,
  completedFullSets: number,
  examDateOverride: boolean,
): StudyPlanReadinessUnit {
  const attemptedQuestionCount = finiteNonNegative(
    category.attemptedQuestionCount ?? category.maxScore,
  );
  const completedPracticeSessions = finiteNonNegative(
    category.completedPracticeSessions,
  );
  const largestPracticeSessionQuestionCount = finiteNonNegative(
    category.largestPracticeSessionQuestionCount,
  );
  const qualifyingPracticeSessions = finiteNonNegative(
    category.qualifyingPracticeSessions ??
      (largestPracticeSessionQuestionCount >=
      LEARNING_QUALIFYING_SESSION_QUESTIONS
        ? 1
        : 0),
  );
  return unit({
    id: category.id,
    name: category.name,
    scope: "category",
    attemptedQuestionCount,
    completedPracticeSessions,
    qualifyingPracticeSessions,
    largestPracticeSessionQuestionCount,
    accuracy: accuracyFor(category),
    completedFullSets,
    examDateOverride,
  });
}

function sectionUnit(
  section: StudyPlanSection,
  signal: StudyPlanSectionSignal | undefined,
  examDateOverride: boolean,
): StudyPlanReadinessUnit {
  const attemptedQuestionCount = finiteNonNegative(
    signal?.attemptedQuestionCount,
  );
  const completedPracticeSessions = finiteNonNegative(
    signal?.completedPracticeSessions,
  );
  const largestPracticeSessionQuestionCount = finiteNonNegative(
    signal?.largestPracticeSessionQuestionCount,
  );
  const qualifyingPracticeSessions = finiteNonNegative(
    signal?.qualifyingPracticeSessions ??
      (largestPracticeSessionQuestionCount >=
      LEARNING_QUALIFYING_SESSION_QUESTIONS
        ? 1
        : 0),
  );
  return unit({
    id: section.id,
    name: section.name,
    scope: "section",
    attemptedQuestionCount,
    completedPracticeSessions,
    qualifyingPracticeSessions,
    largestPracticeSessionQuestionCount,
    accuracy: signal?.recentAccuracy ?? null,
    completedFullSets: signal?.completedFullSets ?? 0,
    examDateOverride,
  });
}

function modeForSection(
  units: StudyPlanReadinessUnit[],
  examDateOverride: boolean,
): StudyPlanTrainingMode {
  if (examDateOverride) return "exam";
  return units.length > 0 && units.every((item) => item.learningComplete)
    ? "timing"
    : "learning";
}

export function buildReadinessSnapshot(
  input: ReadinessInput,
): StudyPlanReadinessSnapshot {
  const daysUntilExam = Math.max(
    0,
    daysBetween(input.today, input.planningDate),
  );
  const examDateOverride = daysUntilExam <= STUDY_PLAN_EXAM_OVERRIDE_DAYS;
  const signalBySection = new Map(
    input.signals.map((signal) => [signal.sectionId, signal]),
  );
  const sections: StudyPlanSectionReadiness[] = input.sections
    .filter((section) => section.sectionNumber <= 3)
    .map((section) => {
      const signal = signalBySection.get(section.id);
      const useCategoryReadiness =
        section.key === "verbal_reasoning" || section.key === "decision_making";
      const categoryUnits = input.categories
        .filter((category) => category.sectionId === section.id)
        .map((category) =>
          categoryUnit(
            category,
            signal?.completedFullSets ?? 0,
            examDateOverride,
          ),
        );
      const units =
        useCategoryReadiness && categoryUnits.length > 0
          ? categoryUnits
          : [sectionUnit(section, signal, examDateOverride)];
      return {
        sectionId: section.id,
        sectionKey: section.key,
        mode: modeForSection(units, examDateOverride),
        paceMultiplier: paceLadderStep(signal?.observedPace),
        observedPace: signal?.observedPace ?? null,
        units,
      };
    });
  const mode: StudyPlanTrainingMode = examDateOverride
    ? "exam"
    : sections.some((section) => section.mode === "learning")
      ? "learning"
      : "timing";
  return { mode, examDateOverride, daysUntilExam, sections };
}
