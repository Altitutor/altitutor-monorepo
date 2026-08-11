import {
  addDays,
  daysBetween,
  parseIsoDate,
  weekday,
} from "@/features/study-plan/lib/dates";
import {
  buildReadinessSnapshot,
  LEARNING_QUALIFYING_SESSION_QUESTIONS,
  paceLadderStep,
  STUDY_PLAN_DETAILED_HORIZON_DAYS,
} from "@/features/study-plan/lib/readiness";
import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";
import type {
  GeneratedStudyPlanTask,
  StudyPlanCapacityRisk,
  StudyPlanCategorySignal,
  StudyPlanExtraStudyInput,
  StudyPlanGenerationResult,
  StudyPlanLearningModule,
  StudyPlanProfileInput,
  StudyPlanReadinessSnapshot,
  StudyPlanReadinessUnit,
  StudyPlanSection,
  StudyPlanSectionReadiness,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
  StudyPlanTrainingMode,
} from "@/features/study-plan/model/types";

type GenerateStudyPlanInput = {
  today: string;
  planningDate: string;
  profile: StudyPlanProfileInput;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  completedMockCount: number;
};

type GenerateExtraStudyTaskInput = StudyPlanExtraStudyInput & {
  today: string;
  planningDate: string;
  targetScore: number;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  skillTrainers: StudyPlanSkillTrainer[];
  sectionTargets?: Record<string, number>;
  scheduledCategoryIds?: Array<string | null>;
  sortOrder: number;
};

type PlannedUnitEvidence = {
  questions: number;
  sessions: number;
  qualifyingSessions: number;
};

const COGNITIVE_SECTION_COUNT = 3;
const FULL_MOCK_MINUTES = 125;

function selectedDates(
  from: string,
  to: string,
  profile: StudyPlanProfileInput,
): string[] {
  const availableWeekdays = new Set(
    profile.availableDays.map((item) => item.weekday),
  );
  const result: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    if (availableWeekdays.has(weekday(cursor))) result.push(cursor);
  }
  return result;
}

function recommendedWeeklyMinutes(
  targetScore: number,
  currentTotal: number | null,
  readiness: StudyPlanReadinessSnapshot,
): number {
  const scoreGap = Math.max(0, targetScore - (currentTotal ?? 1800));
  const base =
    readiness.mode === "exam" ? 420 : readiness.mode === "timing" ? 240 : 90;
  const scoreAdjustment = Math.min(180, Math.round(scoreGap / 5));
  return Math.round((base + scoreAdjustment) / 15) * 15;
}

function capacityRisk(
  profile: StudyPlanProfileInput,
  signals: StudyPlanSectionSignal[],
  readiness: StudyPlanReadinessSnapshot,
): StudyPlanCapacityRisk {
  const estimates = signals
    .slice(0, COGNITIVE_SECTION_COUNT)
    .map((signal) => signal.currentEstimate)
    .filter((value): value is number => value != null);
  const currentTotal =
    estimates.length === COGNITIVE_SECTION_COUNT
      ? estimates.reduce((sum, value) => sum + value, 0)
      : null;
  const recommended = recommendedWeeklyMinutes(
    profile.targetScore,
    currentTotal,
    readiness,
  );
  const typicalSessionMinutes =
    readiness.mode === "exam" ? 90 : readiness.mode === "timing" ? 75 : 35;
  const available = profile.availableDays.length * typicalSessionMinutes;
  const minimumDays =
    readiness.mode === "exam" ? 3 : readiness.mode === "timing" ? 2 : 1;
  const timingCapacityConstrained = signals.some(
    (signal) => signal.timingCapacityConstrained,
  );
  const risky =
    profile.availableDays.length < minimumDays || timingCapacityConstrained;
  return {
    level: risky ? "warning" : "none",
    availableMinutesPerWeek: available,
    recommendedMinutesPerWeek: recommended,
    message: risky
      ? timingCapacityConstrained
        ? "There may not be enough broad practice opportunities to reach reliable exam pace before the exam phase. The plan will move gradually and prioritise representative work."
        : readiness.mode === "exam"
          ? "There are fewer available study days than the exam-phase mock cadence needs. The plan will prioritise mocks and the highest-value weaknesses on the days you selected."
          : "There are very few available study days. The plan will still prioritise the highest-value work and replan unfinished work instead of building a backlog."
      : null,
  };
}

function sectionPriority(
  sections: StudyPlanSection[],
  signals: StudyPlanSectionSignal[],
  sectionTargets: Record<string, number>,
  readiness: StudyPlanReadinessSnapshot,
): StudyPlanSection[] {
  const signalBySection = new Map(
    signals.map((signal) => [signal.sectionId, signal]),
  );
  const readinessBySection = new Map(
    readiness.sections.map((section) => [section.sectionId, section]),
  );
  return [...sections].sort((a, b) => {
    const aSignal = signalBySection.get(a.id);
    const bSignal = signalBySection.get(b.id);
    const aReadiness = readinessBySection.get(a.id);
    const bReadiness = readinessBySection.get(b.id);
    const aLearning = aReadiness?.mode === "learning" ? 1 : 0;
    const bLearning = bReadiness?.mode === "learning" ? 1 : 0;
    const aGap =
      (sectionTargets[a.id] ?? 700) - (aSignal?.currentEstimate ?? 600);
    const bGap =
      (sectionTargets[b.id] ?? 700) - (bSignal?.currentEstimate ?? 600);
    return (
      bLearning - aLearning || bGap - aGap || a.sectionNumber - b.sectionNumber
    );
  });
}

function categoryForUnit(
  unit: StudyPlanReadinessUnit,
  categories: StudyPlanCategorySignal[],
): StudyPlanCategorySignal | null {
  if (unit.scope !== "category") return null;
  return categories.find((category) => category.id === unit.id) ?? null;
}

function practiceQuestionCount(
  section: StudyPlanSection,
  mode: StudyPlanTrainingMode,
  pace: number,
): number {
  if (mode === "learning") return LEARNING_QUALIFYING_SESSION_QUESTIONS;
  if (pace > 1) return Math.max(20, Math.ceil(section.questionCount * 0.8));
  if (pace >= 0.9) return Math.max(20, Math.ceil(section.questionCount * 0.7));
  return Math.max(15, Math.ceil(section.questionCount * 0.55));
}

function practiceTask(input: {
  section: StudyPlanSection;
  category: StudyPlanCategorySignal | null;
  additionalCategories?: StudyPlanCategorySignal[];
  mode: StudyPlanTrainingMode;
  pace: number;
  questionCount: number;
  scheduledDate: string;
  sortOrder: number;
  supplementary?: boolean;
  extraConfig?: Record<string, unknown>;
}): GeneratedStudyPlanTask {
  const timed = input.mode !== "learning";
  const secondsPerQuestion = timed
    ? Math.round(input.section.timePerQuestionSeconds / input.pace)
    : null;
  const answeringMinutes = timed
    ? Math.ceil((input.questionCount * (secondsPerQuestion ?? 60)) / 60)
    : Math.ceil(input.questionCount * 1.5);
  const timingLabel = timed ? `${input.pace.toFixed(1)}x exam pace` : "untimed";
  const selectedCategories = [
    ...(input.category ? [input.category] : []),
    ...(input.additionalCategories ?? []),
  ];
  const targetName =
    selectedCategories.length > 1
      ? `Mixed ${input.section.shortName}`
      : (input.category?.name ?? input.section.name);
  return {
    scheduledDate: input.scheduledDate,
    sortOrder: input.sortOrder,
    taskType: "practice",
    title: `${input.supplementary ? "Optional SJ" : targetName} · ${timingLabel}`,
    description: `${input.questionCount} questions with feedback ${input.mode === "learning" ? "available as you learn" : "at the end"}.`,
    rationale:
      input.mode === "learning"
        ? "Build enough method exposure to make the move into timed work evidence-led."
        : input.pace > 1
          ? "A near-section-length overspeed block builds decision speed without making the full set artificially fast."
          : "Move one step up the pace ladder while keeping the work targeted to a current priority.",
    estimatedMinutes: answeringMinutes + (timed ? 5 : 8),
    targetUnits: input.questionCount,
    sectionId: input.section.id,
    questionStemCategoryId:
      selectedCategories.length === 1 ? (input.category?.id ?? null) : null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      corePractice: !input.supplementary,
      section: input.section.key,
      ucatSectionId: input.section.id,
      questionCount: input.questionCount,
      categoryIds: selectedCategories.map((category) => category.id),
      timeMode: timed ? "speed" : "off",
      timeSpeedMultiplier: timed ? input.pace : 1,
      timePerQuestionSeconds: secondsPerQuestion,
      reviewTiming: input.mode === "learning" ? "afterEachStem" : "atEnd",
      supplementary: input.supplementary ?? false,
      ...input.extraConfig,
    },
  };
}

function benchmarkTask(
  section: StudyPlanSection,
  scheduledDate: string,
  sortOrder: number,
  prescribedPace: number,
): GeneratedStudyPlanTask {
  const pace = Math.max(0.5, Math.min(1, prescribedPace));
  const atExamPace = pace === 1;
  return {
    scheduledDate,
    sortOrder,
    taskType: "section_benchmark",
    title: `Full ${section.shortName} ${atExamPace ? "calibration set" : "learning benchmark"}`,
    description: `${section.questionCount} questions at ${pace.toFixed(1)}× exam pace with feedback held until the end.`,
    rationale: atExamPace
      ? "A regular 1.0x full set keeps the pace ladder calibrated against real section conditions."
      : "This checks whether the section method is holding together and gives the timing phase a reliable baseline.",
    estimatedMinutes:
      Math.ceil(
        (section.questionCount * section.timePerQuestionSeconds) / (60 * pace),
      ) + 8,
    targetUnits: section.questionCount,
    sectionId: section.id,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      corePractice: true,
      benchmark: true,
      calibrationPurpose: atExamPace ? "exam_pace" : "learning_diagnostic",
      trackActiveAnsweringTime: true,
      section: section.key,
      ucatSectionId: section.id,
      questionCount: section.questionCount,
      categoryIds: [],
      timeMode: "speed",
      timeSpeedMultiplier: pace,
      timePerQuestionSeconds: Math.round(section.timePerQuestionSeconds / pace),
      reviewTiming: "atEnd",
    },
  };
}

function learningTask(
  module: StudyPlanLearningModule,
  scheduledDate: string,
  sortOrder: number,
): GeneratedStudyPlanTask {
  return {
    scheduledDate,
    sortOrder,
    taskType: "learn",
    title: module.title,
    description:
      module.completionPercent > 0
        ? "Continue this learning module."
        : "Use this module to support the method you are practicing today.",
    rationale:
      "Learning modules support uncovered or weak methods, but completing a module is not a readiness gate.",
    estimatedMinutes: Math.max(5, module.estimatedMinutes),
    targetUnits: null,
    sectionId: module.sectionId,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: module.id,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath:
      module.sectionNumber != null
        ? `/learn/sections/${module.sectionNumber}/${module.id}`
        : `/learn/${module.id}`,
    launchConfig: { kind: "learning_module", corePractice: false },
  };
}

function skillTrainerTask(
  trainer: StudyPlanSkillTrainer,
  category: StudyPlanCategorySignal | null,
  scheduledDate: string,
  sortOrder: number,
): GeneratedStudyPlanTask {
  return {
    scheduledDate,
    sortOrder,
    taskType: "skill_trainer",
    title: `Warm up · ${trainer.name}`,
    description: `A short ${trainer.estimatedMinutes}-minute warm-up before the core question work.`,
    rationale: category
      ? `Warm up the skill used in today’s ${category.name} block.`
      : "Warm up without displacing the core question dose.",
    estimatedMinutes: trainer.estimatedMinutes,
    targetUnits: 1,
    sectionId: trainer.sectionId,
    questionStemCategoryId: category?.id ?? null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: trainer.id,
    launchPath: `/skill-trainer/${trainer.key.replaceAll("_", "-")}/play`,
    launchConfig: {
      kind: "skill_trainer",
      corePractice: false,
      skillTrainerId: trainer.id,
      skillTrainerKey: trainer.key,
    },
  };
}

export function estimateReviewMinutes(questionCount: number): number {
  return Math.max(3, Math.min(20, Math.ceil(questionCount / 6)));
}

export function reviewTask(
  sourceTask: GeneratedStudyPlanTask,
  scheduledDate: string,
  sortOrder: number,
  intensity: "learning" | "standard" | "sparse" = "standard",
): GeneratedStudyPlanTask {
  const questionCount =
    sourceTask.taskType === "mock" ? 120 : (sourceTask.targetUnits ?? 1);
  const minutes =
    intensity === "learning"
      ? Math.max(5, Math.min(30, Math.ceil(questionCount / 3)))
      : intensity === "sparse"
        ? Math.max(5, Math.min(15, Math.ceil(questionCount / 12)))
        : estimateReviewMinutes(questionCount);
  return {
    scheduledDate,
    sortOrder,
    taskType: "review",
    title: `Review · ${sourceTask.title}`,
    description:
      intensity === "sparse"
        ? "Look for repeat category or timing trends; avoid reworking every question."
        : "Check the questions that need attention and identify the method or timing change to carry forward.",
    rationale:
      intensity === "learning"
        ? "In learning, each question is evidence about how well the method is understood."
        : intensity === "sparse"
          ? "In exam mode, review is reserved for trends that should change the next practice block."
          : "Use review to preserve accuracy while pace increases.",
    estimatedMinutes: minutes,
    targetUnits: 1,
    sectionId: sourceTask.sectionId,
    questionStemCategoryId: sourceTask.questionStemCategoryId,
    questionTagId: sourceTask.questionTagId,
    learningModuleId: null,
    questionSetId: sourceTask.questionSetId,
    mockId: sourceTask.mockId,
    skillTrainerId: null,
    launchPath: "/progress",
    launchConfig: {
      kind: "review",
      awaitingAttempt: true,
      corePractice: false,
    },
    sourceTaskRef: {
      scheduledDate: sourceTask.scheduledDate,
      sortOrder: sourceTask.sortOrder,
    },
  };
}

function pickSkillTrainer(
  sectionId: string,
  categoryId: string | null,
  trainers: StudyPlanSkillTrainer[],
  cursor: number,
): StudyPlanSkillTrainer | null {
  const sectionTrainers = trainers.filter(
    (trainer) => trainer.sectionId === sectionId,
  );
  if (!sectionTrainers.length) return null;
  const linked = categoryId
    ? sectionTrainers.filter((trainer) =>
        trainer.categoryIds.includes(categoryId),
      )
    : [];
  const candidates = linked.length ? linked : sectionTrainers;
  return candidates[cursor % candidates.length] ?? null;
}

function pickCategory(
  sectionId: string,
  categories: StudyPlanCategorySignal[],
  scheduledCounts: Map<string, number>,
): StudyPlanCategorySignal | null {
  const candidates = categories.filter(
    (category) =>
      category.sectionId === sectionId && category.availableQuestionCount > 0,
  );
  const selected = [...candidates].sort((a, b) => {
    const aCount = scheduledCounts.get(a.id) ?? 0;
    const bCount = scheduledCounts.get(b.id) ?? 0;
    const aPriority = (0.4 + a.weaknessScore) / (1 + aCount * 0.4);
    const bPriority = (0.4 + b.weaknessScore) / (1 + bCount * 0.4);
    return bPriority - aPriority || a.name.localeCompare(b.name);
  })[0];
  if (selected) {
    scheduledCounts.set(
      selected.id,
      (scheduledCounts.get(selected.id) ?? 0) + 1,
    );
  }
  return selected ?? null;
}

function pickMixedCategories(
  sectionId: string,
  categories: StudyPlanCategorySignal[],
  scheduledCounts: Map<string, number>,
  count: number,
): StudyPlanCategorySignal[] {
  const selected: StudyPlanCategorySignal[] = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = pickCategory(
      sectionId,
      categories.filter(
        (category) => !selected.some((item) => item.id === category.id),
      ),
      scheduledCounts,
    );
    if (!candidate) break;
    selected.push(candidate);
  }
  return selected;
}

function mockTask(
  number: number,
  scheduledDate: string,
  sortOrder: number,
  mode: StudyPlanTrainingMode,
): GeneratedStudyPlanTask {
  return {
    scheduledDate,
    sortOrder,
    taskType: "mock",
    title: `Full UCAT mock ${number}`,
    description:
      "Complete a full mock at 1.0x under uninterrupted exam conditions.",
    rationale:
      mode === "exam"
        ? "Mocks are the core exam-phase dose for pacing, stamina and whole-exam calibration."
        : "This intermittent benchmark checks how timing work is transferring to the whole exam.",
    estimatedMinutes: FULL_MOCK_MINUTES,
    targetUnits: null,
    sectionId: null,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/mocks",
    launchConfig: {
      kind: "mock",
      corePractice: true,
      timeSpeedMultiplier: 1,
    },
  };
}

function mockDates(
  dates: string[],
  readiness: StudyPlanReadinessSnapshot,
  preferredWeekday: number,
  planningDate: string,
): Set<string> {
  if (!dates.length || readiness.mode === "learning") return new Set();
  const eligible = dates.filter((date) => daysBetween(date, planningDate) >= 1);
  if (!eligible.length) return new Set();
  const calendarSpan = Math.max(
    1,
    daysBetween(eligible[0] ?? dates[0]!, eligible[eligible.length - 1]!) + 1,
  );
  const desired =
    readiness.mode === "exam"
      ? readiness.daysUntilExam <= 28
        ? Math.max(1, Math.ceil((calendarSpan / 7) * 3))
        : Math.max(1, Math.ceil(calendarSpan / 7))
      : Math.max(1, Math.round(calendarSpan / 14));
  const count = Math.min(desired, eligible.length);
  const picked = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const ideal = ((index + 0.5) * eligible.length) / count - 0.5;
    const candidate = eligible
      .filter((date) => !picked.has(date))
      .sort((a, b) => {
        const aIndex = eligible.indexOf(a);
        const bIndex = eligible.indexOf(b);
        const aScore =
          Math.abs(aIndex - ideal) * 3 -
          (weekday(a) === preferredWeekday ? 1 : 0);
        const bScore =
          Math.abs(bIndex - ideal) * 3 -
          (weekday(b) === preferredWeekday ? 1 : 0);
        return aScore - bScore || a.localeCompare(b);
      })[0];
    if (candidate) picked.add(candidate);
  }
  return picked;
}

function plannedEvidenceFor(
  unit: StudyPlanReadinessUnit,
  planned: Map<string, PlannedUnitEvidence>,
): PlannedUnitEvidence {
  return (
    planned.get(unit.id) ?? {
      questions: 0,
      sessions: 0,
      qualifyingSessions: 0,
    }
  );
}

function addPlannedEvidence(
  unit: StudyPlanReadinessUnit,
  planned: Map<string, PlannedUnitEvidence>,
  questions: number,
): void {
  const current = plannedEvidenceFor(unit, planned);
  planned.set(unit.id, {
    questions: current.questions + questions,
    sessions: current.sessions + 1,
    qualifyingSessions:
      current.qualifyingSessions +
      (questions >= LEARNING_QUALIFYING_SESSION_QUESTIONS ? 1 : 0),
  });
}

function selectLearningUnit(
  section: StudyPlanSectionReadiness,
  planned: Map<string, PlannedUnitEvidence>,
  categories: StudyPlanCategorySignal[],
): StudyPlanReadinessUnit {
  if (section.units.length === 1) return section.units[0]!;
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const availableTotal = section.units.reduce(
    (sum, unit) =>
      sum + Math.max(1, categoryById.get(unit.id)?.availableQuestionCount ?? 1),
    0,
  );
  const totalExposure = section.units.reduce(
    (sum, unit) =>
      sum +
      unit.attemptedQuestionCount +
      plannedEvidenceFor(unit, planned).questions,
    0,
  );
  return [...section.units].sort((left, right) => {
    const leftCategory = categoryById.get(left.id);
    const rightCategory = categoryById.get(right.id);
    const leftObserved =
      left.attemptedQuestionCount + plannedEvidenceFor(left, planned).questions;
    const rightObserved =
      right.attemptedQuestionCount +
      plannedEvidenceFor(right, planned).questions;
    const nextTotal = totalExposure + LEARNING_QUALIFYING_SESSION_QUESTIONS;
    const leftShare =
      Math.max(1, leftCategory?.availableQuestionCount ?? 1) / availableTotal;
    const rightShare =
      Math.max(1, rightCategory?.availableQuestionCount ?? 1) / availableTotal;
    const leftDeficit = nextTotal * leftShare - leftObserved;
    const rightDeficit = nextTotal * rightShare - rightObserved;
    return (
      rightDeficit - leftDeficit ||
      (rightCategory?.weaknessScore ?? 0.5) -
        (leftCategory?.weaknessScore ?? 0.5) ||
      left.name.localeCompare(right.name)
    );
  })[0]!;
}

function learningCandidates(
  readiness: StudyPlanReadinessSnapshot,
  planned: Map<string, PlannedUnitEvidence>,
  categories: StudyPlanCategorySignal[],
  sectionById: Map<string, StudyPlanSection>,
): Array<{
  sectionReadiness: StudyPlanSectionReadiness;
  unit: StudyPlanReadinessUnit;
  exposure: number;
}> {
  return readiness.sections
    .filter((sectionReadiness) => sectionReadiness.mode === "learning")
    .map((sectionReadiness) => {
      const unit = selectLearningUnit(sectionReadiness, planned, categories);
      const section = sectionById.get(sectionReadiness.sectionId);
      const plannedQuestions = sectionReadiness.units.reduce(
        (sum, candidate) =>
          sum + plannedEvidenceFor(candidate, planned).questions,
        0,
      );
      const attemptedQuestions = sectionReadiness.units.reduce(
        (sum, candidate) => sum + candidate.attemptedQuestionCount,
        0,
      );
      return {
        sectionReadiness,
        unit,
        exposure:
          (attemptedQuestions + plannedQuestions) /
          Math.max(1, section?.questionCount ?? 1),
      };
    })
    .sort(
      (left, right) =>
        left.exposure - right.exposure ||
        (sectionById.get(left.sectionReadiness.sectionId)?.sectionNumber ?? 0) -
          (sectionById.get(right.sectionReadiness.sectionId)?.sectionNumber ??
            0),
    );
}

function takeLearningModule(
  sectionId: string,
  modules: StudyPlanLearningModule[],
  scheduledModuleIds: Set<string>,
): StudyPlanLearningModule | null {
  const priority = { essential: 0, recommended: 1, optional: 2 } as const;
  const learningModule = modules
    .filter(
      (candidate) =>
        candidate.sectionId === sectionId &&
        !scheduledModuleIds.has(candidate.id),
    )
    .sort(
      (left, right) =>
        priority[left.priority] - priority[right.priority] ||
        right.relevanceScore - left.relevanceScore ||
        left.title.localeCompare(right.title),
    )[0];
  if (learningModule) scheduledModuleIds.add(learningModule.id);
  return learningModule ?? null;
}

export function generateStudyPlan(
  input: GenerateStudyPlanInput,
): StudyPlanGenerationResult {
  parseIsoDate(input.today);
  parseIsoDate(input.planningDate);
  const examEnd =
    input.planningDate < input.today ? input.today : input.planningDate;
  const horizonEnd = addDays(input.today, STUDY_PLAN_DETAILED_HORIZON_DAYS - 1);
  const endsOn = examEnd < horizonEnd ? examEnd : horizonEnd;
  const dates = selectedDates(input.today, endsOn, input.profile);
  const readiness = buildReadinessSnapshot(input);
  const sectionTargets = allocateSectionTargets(
    input.profile.targetScore,
    input.sections
      .filter((section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT)
      .map((section) => ({
        sectionId: section.id,
        currentEstimate:
          input.signals.find((signal) => signal.sectionId === section.id)
            ?.currentEstimate ?? null,
      })),
  );
  const cognitiveSections = sectionPriority(
    input.sections.filter(
      (section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT,
    ),
    input.signals,
    sectionTargets,
    readiness,
  );
  const cognitiveSectionIds = new Set(
    cognitiveSections.map((section) => section.id),
  );
  const sectionById = new Map(
    input.sections.map((section) => [section.id, section]),
  );
  const readinessBySection = new Map(
    readiness.sections.map((section) => [section.sectionId, section]),
  );
  const moduleQueue = input.learningModules
    .filter(
      (module) =>
        module.completionPercent < 100 &&
        (module.sectionId == null || cognitiveSectionIds.has(module.sectionId)),
    )
    .filter((module) => module.priority !== "optional");
  const plannedEvidence = new Map<string, PlannedUnitEvidence>();
  const scheduledBenchmarks = new Set<string>();
  const scheduledModuleIds = new Set<string>();
  const categoryScheduleCounts = new Map<string, number>();
  const mocks = mockDates(
    dates,
    readiness,
    input.profile.preferredMockWeekday,
    input.planningDate,
  );
  const tasks: GeneratedStudyPlanTask[] = [];
  let sectionCursor = 0;
  let trainerCursor = 0;
  let mockNumber = input.completedMockCount;
  let ordinaryTimingBlocks = 0;
  let calibrationCount = 0;
  const scheduledCalibrations = new Set<string>();
  let narrowTargetedBlocks = 0;

  dates.forEach((date) => {
    let sortOrder = 0;
    if (mocks.has(date)) {
      const mock = mockTask(++mockNumber, date, sortOrder++, readiness.mode);
      tasks.push(mock);
      tasks.push(reviewTask(mock, date, sortOrder, "sparse"));
      return;
    }

    const learningSections = readiness.sections.filter(
      (section) => section.mode === "learning",
    );
    const signalBySection = new Map(
      input.signals.map((signal) => [signal.sectionId, signal]),
    );
    const hasBasicExposure = (section: StudyPlanSectionReadiness) =>
      section.units.some(
        (unit) =>
          unit.attemptedQuestionCount +
            plannedEvidenceFor(unit, plannedEvidence).questions >
          0,
      );
    const allLearningSectionsExposed = learningSections.every(hasBasicExposure);
    const diagnosticSection = allLearningSectionsExposed
      ? learningSections.find(
          (section) =>
            !signalBySection.get(section.sectionId)?.benchmarkCompleted &&
            !scheduledBenchmarks.has(section.sectionId),
        )
      : undefined;
    if (diagnosticSection) {
      const section = sectionById.get(diagnosticSection.sectionId);
      if (section) {
        const diagnostic = benchmarkTask(
          section,
          date,
          sortOrder++,
          diagnosticSection.paceMultiplier,
        );
        diagnostic.title = `${section.shortName} diagnostic`;
        diagnostic.rationale =
          "This early diagnostic establishes a whole-section baseline without blocking the rest of the plan.";
        tasks.push(diagnostic);
        tasks.push(reviewTask(diagnostic, date, sortOrder, "learning"));
        scheduledBenchmarks.add(section.id);
        return;
      }
    }

    const candidates = learningCandidates(
      readiness,
      plannedEvidence,
      input.categories,
      sectionById,
    );
    if (candidates.length > 0) {
      const usedSections = new Set<string>();
      const learningBlockLimit =
        input.profile.targetScore >= 2400 ||
        input.profile.availableDays.length <= 2
          ? 2
          : 1;
      let scheduledCoreBlocks = 0;
      for (const candidate of candidates) {
        if (scheduledCoreBlocks >= learningBlockLimit) break;
        const section = sectionById.get(candidate.sectionReadiness.sectionId);
        if (!section || usedSections.has(section.id)) continue;
        const learningModule = takeLearningModule(
          section.id,
          moduleQueue,
          scheduledModuleIds,
        );
        if (learningModule) {
          tasks.push(learningTask(learningModule, date, sortOrder++));
        }
        const category = categoryForUnit(candidate.unit, input.categories);
        const practice = practiceTask({
          section,
          category,
          mode: "learning",
          pace: candidate.sectionReadiness.paceMultiplier,
          questionCount: LEARNING_QUALIFYING_SESSION_QUESTIONS,
          scheduledDate: date,
          sortOrder: sortOrder++,
        });
        tasks.push(practice);
        tasks.push(reviewTask(practice, date, sortOrder++, "learning"));
        addPlannedEvidence(
          candidate.unit,
          plannedEvidence,
          LEARNING_QUALIFYING_SESSION_QUESTIONS,
        );
        usedSections.add(section.id);
        scheduledCoreBlocks += 1;
      }
      const timingSections = cognitiveSections.filter(
        (section) => readinessBySection.get(section.id)?.mode !== "learning",
      );
      const timingSection =
        timingSections[sectionCursor++ % timingSections.length];
      if (timingSection) {
        const timingReadiness = readinessBySection.get(timingSection.id);
        const pace = timingReadiness?.paceMultiplier ?? 0.5;
        const category: StudyPlanCategorySignal | null = null;
        const trainer = pickSkillTrainer(
          timingSection.id,
          null,
          input.skillTrainers,
          trainerCursor++,
        );
        if (trainer) {
          tasks.push(skillTrainerTask(trainer, category, date, sortOrder++));
        }
        const scheduleCalibration =
          Boolean(timingReadiness?.calibrationDue) &&
          !scheduledCalibrations.has(timingSection.id) &&
          ordinaryTimingBlocks >= (calibrationCount + 1) * 2;
        if (scheduleCalibration) {
          const benchmark = benchmarkTask(
            timingSection,
            date,
            sortOrder++,
            1,
          );
          tasks.push(benchmark);
          tasks.push(reviewTask(benchmark, date, sortOrder, "standard"));
          scheduledCalibrations.add(timingSection.id);
          calibrationCount += 1;
          return;
        }
        const timingPractice = practiceTask({
          section: timingSection,
          category,
          mode: "timing",
          pace,
          questionCount: practiceQuestionCount(timingSection, "timing", pace),
          scheduledDate: date,
          sortOrder: sortOrder++,
        });
        tasks.push(timingPractice);
        ordinaryTimingBlocks += 1;
        tasks.push(reviewTask(timingPractice, date, sortOrder, "standard"));
      }
      return;
    }

    const timingSections = cognitiveSections.filter(
      (candidate) => readinessBySection.get(candidate.id)?.mode !== "learning",
    );
    const section = timingSections[sectionCursor++ % timingSections.length];
    if (!section) return;
    const sectionReadiness = readinessBySection.get(section.id);
    const pace = sectionReadiness?.paceMultiplier ?? 0.5;
    const category = [...input.categories]
      .filter((candidate) => candidate.sectionId === section.id)
      .sort(
        (left, right) =>
          right.weaknessScore - left.weaknessScore ||
          left.name.localeCompare(right.name),
      )[0];
    const trainer = pickSkillTrainer(
      section.id,
      category?.id ?? null,
      input.skillTrainers,
      trainerCursor++,
    );
    if (trainer)
      tasks.push(skillTrainerTask(trainer, category, date, sortOrder++));

    const scheduleCalibration =
      Boolean(sectionReadiness?.calibrationDue) &&
      !scheduledCalibrations.has(section.id) &&
      ordinaryTimingBlocks >= (calibrationCount + 1) * 2;
    if (scheduleCalibration) {
      const benchmark = benchmarkTask(section, date, sortOrder++, 1);
      tasks.push(benchmark);
      if (readiness.mode !== "exam") {
        tasks.push(reviewTask(benchmark, date, sortOrder, "standard"));
      }
      scheduledCalibrations.add(section.id);
      calibrationCount += 1;
      return;
    }

    const blockCount = input.profile.targetScore >= 2400 ? 3 : 2;
    for (let block = 0; block < blockCount; block += 1) {
      const blockSection =
        block === 0
          ? section
          : (timingSections[
              (sectionCursor + block - 1) % timingSections.length
            ] ?? section);
      const blockReadiness = readinessBySection.get(blockSection.id);
      const prescribedPace = blockReadiness?.paceMultiplier ?? pace;
      const breadthSlot = ordinaryTimingBlocks % 4;
      const broad = breadthSlot === 0 || breadthSlot === 3;
      const mixed = breadthSlot === 2;
      const selectedCategories = broad
        ? []
        : pickMixedCategories(
            blockSection.id,
            input.categories,
            categoryScheduleCounts,
            mixed ? 3 : 1,
          );
      const blockCategory = selectedCategories[0] ?? null;
      const nextNarrowTargetedBlock = narrowTargetedBlocks + 1;
      const useOverspeed =
        !broad &&
        !mixed &&
        Boolean(blockReadiness?.overspeedEligible) &&
        nextNarrowTargetedBlock % 4 === 0;
      if (!broad && !mixed) {
        narrowTargetedBlocks = nextNarrowTargetedBlock;
      }
      const blockPace = useOverspeed
        ? (blockReadiness?.overspeedPace ?? 1.1)
        : prescribedPace;
      const practice = practiceTask({
        section: blockSection,
        category: blockCategory,
        additionalCategories: selectedCategories.slice(1),
        mode: readiness.mode === "exam" ? "exam" : "timing",
        pace: blockPace,
        questionCount: practiceQuestionCount(
          blockSection,
          readiness.mode === "exam" ? "exam" : "timing",
          blockPace,
        ),
        scheduledDate: date,
        sortOrder: sortOrder++,
      });
      tasks.push(practice);
      ordinaryTimingBlocks += 1;
      if (readiness.mode === "timing" && block === 0) {
        tasks.push(reviewTask(practice, date, sortOrder++, "standard"));
      }
    }
  });

  return {
    tasks,
    capacityRisk: capacityRisk(input.profile, input.signals, readiness),
    sectionTargets,
    readiness,
    endsOn,
  };
}

export function generateExtraStudyTasks(
  input: GenerateExtraStudyTaskInput,
): GeneratedStudyPlanTask[] {
  const cognitiveSections = input.sections.filter(
    (section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT,
  );
  const signalBySection = new Map(
    input.signals.map((signal) => [signal.sectionId, signal]),
  );
  const section = input.sectionKey
    ? input.sections.find((candidate) => candidate.key === input.sectionKey)
    : [...cognitiveSections].sort((a, b) => {
        const aSignal = signalBySection.get(a.id);
        const bSignal = signalBySection.get(b.id);
        return (
          (aSignal?.currentEstimate ?? 500) -
            (bSignal?.currentEstimate ?? 500) ||
          (aSignal?.evidenceCount ?? 0) - (bSignal?.evidenceCount ?? 0)
        );
      })[0];
  if (!section) {
    throw new Error("There are no suitable practice questions available yet.");
  }
  const scheduledCounts = new Map<string, number>();
  for (const categoryId of input.scheduledCategoryIds ?? []) {
    if (categoryId) {
      scheduledCounts.set(
        categoryId,
        (scheduledCounts.get(categoryId) ?? 0) + 1,
      );
    }
  }
  const category = pickCategory(section.id, input.categories, scheduledCounts);
  if (!category) {
    throw new Error(
      `There are no suitable ${section.shortName} questions available yet.`,
    );
  }
  const signal = signalBySection.get(section.id);
  const daysRemaining = Math.max(
    0,
    daysBetween(input.today, input.planningDate),
  );
  const timed = daysRemaining <= 60 || (signal?.completedFullSets ?? 0) > 0;
  const pace = paceLadderStep(signal?.observedPace);
  const trainer = pickSkillTrainer(
    section.id,
    category.id,
    input.skillTrainers,
    scheduledCounts.get(category.id) ?? 0,
  );
  const includeWarmup = Boolean(
    trainer && trainer.estimatedMinutes <= Math.max(2, input.minutes * 0.25),
  );
  const warmupMinutes = includeWarmup ? trainer!.estimatedMinutes : 0;
  const practiceMinutes = Math.max(5, input.minutes - warmupMinutes);
  const secondsPerQuestion = timed
    ? Math.round(section.timePerQuestionSeconds / pace)
    : 90;
  const questionCount = Math.max(
    1,
    Math.floor((practiceMinutes * 60) / secondsPerQuestion),
  );
  const commonConfig = {
    extraStudy: true,
    requestedMinutes: input.minutes,
    requestedSectionKey: input.sectionKey,
  };
  const practice = practiceTask({
    section,
    category,
    mode: timed ? "timing" : "learning",
    pace,
    questionCount,
    scheduledDate: input.today,
    sortOrder: input.sortOrder + (includeWarmup ? 1 : 0),
    supplementary: section.sectionNumber === 4,
    extraConfig: commonConfig,
  });
  const fittedPractice = {
    ...practice,
    estimatedMinutes: practiceMinutes,
    rationale: input.sectionKey
      ? `You chose ${section.name}; this category is the best next use of your extra time.`
      : "This is the best next use of your extra time based on score gaps and broad category evidence.",
  };
  if (!includeWarmup || !trainer) return [fittedPractice];
  const warmup = skillTrainerTask(
    trainer,
    category,
    input.today,
    input.sortOrder,
  );
  return [
    {
      ...warmup,
      launchConfig: { ...warmup.launchConfig, ...commonConfig },
    },
    fittedPractice,
  ];
}
