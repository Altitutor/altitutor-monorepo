import { daysBetween } from "@/features/study-plan/lib/dates";
import type {
  StudyPlanCategorySignal,
  StudyPlanLearningModule,
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
export const LEARNING_CATEGORY_EXPOSURE_QUESTIONS = 1;
export const LEARNING_QUALIFYING_SESSION_QUESTIONS = 10;
export const LEARNING_ACCURACY_SESSIONS = 2;
export const LEARNING_ACCURACY_SECTION_EQUIVALENTS = 1;
export const LEARNING_SLOW_ACCURACY = 0.75;
export const LEARNING_EXAM_PACE_ACCURACY = 0.7;
export const LEARNING_EXPERIENCE_SESSIONS = 3;
export const LEARNING_EXPERIENCE_SECTION_EQUIVALENTS = 1.5;
export const PACE_LADDER = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const;

type ReadinessInput = {
  today: string;
  planningDate: string;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules?: StudyPlanLearningModule[];
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
  const clamped = Math.max(PACE_LADDER[0], Math.min(1, observedPace));
  return [...PACE_LADDER].reverse().find((pace) => pace <= clamped) ?? 0.5;
}

function categoryUnit(
  category: StudyPlanCategorySignal,
): StudyPlanReadinessUnit {
  const attemptedQuestionCount = finiteNonNegative(
    category.attemptedQuestionCount,
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
  const coverageComplete =
    attemptedQuestionCount >= LEARNING_CATEGORY_EXPOSURE_QUESTIONS;
  return {
    id: category.id,
    name: category.name,
    scope: "category",
    attemptedQuestionCount,
    completedPracticeSessions,
    qualifyingPracticeSessions,
    largestPracticeSessionQuestionCount,
    accuracy: accuracyFor(category),
    coverageComplete,
    learningComplete: coverageComplete,
    readinessRoute: null,
  };
}

function sectionUnit(
  section: StudyPlanSection,
  signal: StudyPlanSectionSignal | undefined,
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
  const coverageComplete =
    attemptedQuestionCount >= LEARNING_COVERAGE_QUESTIONS;
  return {
    id: section.id,
    name: section.name,
    scope: "section",
    attemptedQuestionCount,
    completedPracticeSessions,
    qualifyingPracticeSessions,
    largestPracticeSessionQuestionCount,
    accuracy: signal?.recentAccuracy ?? null,
    coverageComplete,
    learningComplete: coverageComplete,
    readinessRoute: null,
  };
}

function essentialModulesComplete(
  sectionId: string,
  learningModules: StudyPlanLearningModule[],
): boolean {
  return learningModules
    .filter(
      (module) =>
        module.sectionId === sectionId && module.priority === "essential",
    )
    .every((module) => module.completionPercent >= 100);
}

function learningRoute(input: {
  section: StudyPlanSection;
  signal: StudyPlanSectionSignal | undefined;
  units: StudyPlanReadinessUnit[];
  essentialModulesComplete: boolean;
}): Exclude<StudyPlanReadinessRoute, "exam_override" | null> | null {
  const persisted = input.signal?.learningGraduationRoute;
  if (
    input.signal?.learningGraduatedAt &&
    (persisted === "accuracy" || persisted === "experience")
  ) {
    return persisted;
  }
  const representativeSessions = finiteNonNegative(
    input.signal?.representativeSessionCount ??
      input.signal?.qualifyingPracticeSessions,
  );
  const representativeEquivalents = finiteNonNegative(
    input.signal?.representativeSectionEquivalents ??
      finiteNonNegative(input.signal?.attemptedQuestionCount) /
        input.section.questionCount,
  );
  const representativeAccuracy =
    input.signal?.representativeAccuracy ??
    input.signal?.recentAccuracy ??
    null;
  const benchmarkCompleted =
    input.signal?.benchmarkCompleted ??
    finiteNonNegative(input.signal?.completedFullSets) > 0;
  const benchmarkPace = input.signal?.benchmarkPace ?? 0.5;
  const requiredAccuracy =
    benchmarkPace >= 1 ? LEARNING_EXAM_PACE_ACCURACY : LEARNING_SLOW_ACCURACY;
  const representativeBreadth = input.units.every(
    (unit) => unit.coverageComplete,
  );
  if (
    representativeSessions >= LEARNING_ACCURACY_SESSIONS &&
    representativeEquivalents >= LEARNING_ACCURACY_SECTION_EQUIVALENTS &&
    benchmarkCompleted &&
    representativeBreadth &&
    (representativeAccuracy ?? 0) >= requiredAccuracy
  ) {
    return "accuracy";
  }
  const targetedSessions = finiteNonNegative(
    input.signal?.targetedPracticeSessionCount ??
      input.signal?.completedPracticeSessions,
  );
  const targetedEquivalents = finiteNonNegative(
    input.signal?.targetedSectionEquivalents ??
      finiteNonNegative(input.signal?.attemptedQuestionCount) /
        input.section.questionCount,
  );
  if (
    input.essentialModulesComplete &&
    targetedSessions >= LEARNING_EXPERIENCE_SESSIONS &&
    targetedEquivalents >= LEARNING_EXPERIENCE_SECTION_EQUIVALENTS &&
    benchmarkCompleted
  ) {
    return "experience";
  }
  return null;
}

function modeForSection(
  route: Exclude<StudyPlanReadinessRoute, "exam_override" | null> | null,
  examDateOverride: boolean,
): StudyPlanTrainingMode {
  if (examDateOverride) return "exam";
  return route ? "timing" : "learning";
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
        .map(categoryUnit);
      const units =
        useCategoryReadiness && categoryUnits.length > 0
          ? categoryUnits
          : [sectionUnit(section, signal)];
      const route = learningRoute({
        section,
        signal,
        units,
        essentialModulesComplete: essentialModulesComplete(
          section.id,
          input.learningModules ?? [],
        ),
      });
      const mode = modeForSection(route, examDateOverride);
      const prescribedPace =
        signal?.prescribedPace ?? paceLadderStep(signal?.observedPace);
      const benchmarkCompleted =
        signal?.benchmarkCompleted ??
        finiteNonNegative(signal?.completedFullSets) > 0;
      const breadthComplete = units.every((unit) => unit.coverageComplete);
      return {
        sectionId: section.id,
        sectionKey: section.key,
        mode,
        paceMultiplier: prescribedPace,
        observedPace: signal?.observedPace ?? null,
        learningGraduatedAt: signal?.learningGraduatedAt ?? null,
        learningRoute: route,
        nextMilestone:
          mode === "exam"
            ? "Practise at exam pace and act on recurring weaknesses."
            : mode === "timing"
              ? signal?.timingDecisionCode === "timing.hold_accuracy"
                ? "Protect accuracy at this pace before moving faster."
                : signal?.calibrationDue
                  ? "Refresh this pace with a broad section calibration."
                  : prescribedPace >= 1
                    ? "Keep exam pace reliable across broad and targeted work."
                    : "Complete broad practice reliably at this prescribed pace."
              : !breadthComplete
                ? "Build experience across the whole section."
                : !benchmarkCompleted
                  ? "Complete a full-section diagnostic."
                  : "Show reliable accuracy or build more guided section experience.",
        timingDecisionCode:
          signal?.timingDecisionCode ?? "timing.initial_placement",
        calibrationDue: signal?.calibrationDue ?? false,
        overspeedEligible: signal?.overspeedEligible ?? false,
        overspeedPace: signal?.overspeedPace ?? null,
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
