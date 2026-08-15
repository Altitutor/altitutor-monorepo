import {
  addDays,
  daysBetween,
  parseIsoDate,
  weekday,
} from "@/features/study-plan/lib/dates";
import {
  buildReadinessSnapshot,
  paceLadderStep,
  STUDY_PLAN_DETAILED_HORIZON_DAYS,
} from "@/features/study-plan/lib/readiness";
import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";
import {
  rankActivityCandidates,
  selectActivityCandidates,
  LEARNING_MODULE_SESSION_MINUTES,
  type PreparationActivityCandidate,
  type ActivityTagSignal,
} from "@/features/preparation/lib/activity-ranking";
import type {
  GeneratedStudyPlanTask,
  StudyPlanCapacityRisk,
  StudyPlanCategorySignal,
  StudyPlanExtraStudyInput,
  StudyPlanGenerationResult,
  StudyPlanLearningModule,
  StudyPlanProfileInput,
  StudyPlanReadinessSnapshot,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
  StudyPlanTrainingMode,
} from "@/features/study-plan/model/types";
import {
  mockIntervalDays,
  targetMocksInHorizon,
  UCAT_MOCK_CADENCE_POLICY,
} from "@/features/preparation/lib/mock-cadence-policy";
import {
  selectBenchmarkMock,
  selectBenchmarkSet,
  type BenchmarkMockAsset,
  type BenchmarkSetAsset,
} from "@/features/preparation/lib/benchmark-selection";
import {
  learningLoopTargetQuestionCount,
  LEARNING_LOOP_TARGET_SECTION_EQUIVALENTS,
} from "@/features/preparation/lib/policy";

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
  lastCompletedMockDate?: string | null;
  tagSignals?: ActivityTagSignal[];
  sectionTargets?: Record<string, number>;
  readiness?: StudyPlanReadinessSnapshot;
  activityCandidates?: PreparationActivityCandidate[];
  benchmarkSets?: BenchmarkSetAsset[];
  benchmarkMocks?: BenchmarkMockAsset[];
  lastLearningModuleServedAtBySection?: Record<string, string>;
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
  activityCandidates?: PreparationActivityCandidate[];
  readiness?: StudyPlanReadinessSnapshot;
};

const COGNITIVE_SECTION_COUNT = 3;
const FULL_MOCK_MINUTES = 125;
const PRACTICE_ACTIVITY_KINDS: ReadonlySet<
  PreparationActivityCandidate["kind"]
> = new Set([
  "related_practice",
  "broad_practice",
  "mixed_practice",
  "targeted_practice",
]);

function isPracticeActivity(activity: PreparationActivityCandidate): boolean {
  return PRACTICE_ACTIVITY_KINDS.has(activity.kind);
}

function isSjtAllocationActivity(
  activity: PreparationActivityCandidate,
): boolean {
  return activity.objective === "maintain_sjt_judgement";
}

function coreSectionEquivalentsPerWeek(
  tasks: GeneratedStudyPlanTask[],
  sections: StudyPlanSection[],
  startsOn: string,
  endsOn: string,
): number {
  const questionCountBySection = new Map(
    sections
      .filter((section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT)
      .map((section) => [section.id, section.questionCount]),
  );
  const total = tasks.reduce((sum, task) => {
    if (task.launchConfig.optional === true) return sum;
    if (task.taskType === "mock") return sum + COGNITIVE_SECTION_COUNT;
    if (
      (task.taskType === "practice" || task.taskType === "section_benchmark") &&
      task.sectionId &&
      task.targetUnits
    ) {
      const questionCount = questionCountBySection.get(task.sectionId);
      return questionCount ? sum + task.targetUnits / questionCount : sum;
    }
    return sum;
  }, 0);
  const scheduledWeeks = Math.max(
    1 / 7,
    (daysBetween(startsOn, endsOn) + 1) / 7,
  );
  return Math.round((total / scheduledWeeks) * 100) / 100;
}

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

function capacityRisk(
  profile: StudyPlanProfileInput,
  signals: StudyPlanSectionSignal[],
  readiness: StudyPlanReadinessSnapshot,
  outstandingSectionEquivalents: number,
  schedulableSectionEquivalents: number,
): StudyPlanCapacityRisk {
  const recommendedDays = readiness.mode === "exam" ? 3 : 2;
  const timingCapacityConstrained = signals.some(
    (signal) => signal.timingCapacityConstrained,
  );
  const tooFewStudyDays = profile.availableDays.length < recommendedDays;
  const risky = tooFewStudyDays || timingCapacityConstrained;
  return {
    level: risky ? "warning" : "none",
    availableStudyDaysPerWeek: profile.availableDays.length,
    recommendedStudyDaysPerWeek: recommendedDays,
    outstandingSectionEquivalents,
    schedulableSectionEquivalents,
    message: risky
      ? timingCapacityConstrained
        ? "There may not be enough broad practice opportunities to reach reliable exam pace before the exam phase. The plan will move gradually and prioritise representative work."
        : readiness.mode === "exam"
          ? "You selected fewer study days than the exam phase normally needs. The plan will prioritise mocks and the highest-value weaknesses on the days you selected."
          : "You selected one study day each week. Add another day to give the plan more chances to practise and review what you learn."
      : null,
  };
}

function demandKey(activity: PreparationActivityCandidate): string {
  return isPracticeActivity(activity)
    ? `practice:${activity.sectionId}:${activity.objective}`
    : activity.id;
}

function activityDemand(activity: PreparationActivityCandidate): number {
  if (isSjtAllocationActivity(activity)) {
    return activity.dose.sectionEquivalents;
  }
  const practice = isPracticeActivity(activity);
  const calculated =
    Math.max(0.25, activity.dose.sectionEquivalents) +
    (practice ? activity.ranking.targetGap / 80 : 0);
  if (
    activity.kind === "related_practice" ||
    activity.dose.questionCount === 10
  ) {
    return Math.max(calculated, activity.dose.sectionEquivalents * 3);
  }
  if (practice && activity.dose.sectionEquivalents >= 0.75) {
    return Math.max(calculated, activity.dose.sectionEquivalents * 4);
  }
  return calculated;
}

function demandByMilestone(
  activities: PreparationActivityCandidate[],
): Map<string, number> {
  const demandByMilestone = new Map<string, number>();
  for (const activity of activities) {
    if (
      activity.requirement !== "required" ||
      activity.kind === "mock" ||
      activity.kind === "review"
    ) {
      continue;
    }
    const key = demandKey(activity);
    const demand = activityDemand(activity);
    demandByMilestone.set(
      key,
      Math.max(demandByMilestone.get(key) ?? 0, demand),
    );
  }
  return demandByMilestone;
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
  asset: BenchmarkSetAsset,
  repeated: boolean,
): GeneratedStudyPlanTask {
  const pace = asset.pace;
  const atExamPace = pace === 1;
  return {
    scheduledDate,
    sortOrder,
    taskType: "section_benchmark",
    title: `${repeated ? "Repeat benchmark · " : ""}${asset.name}`,
    description: `${asset.questionCount} questions at ${pace.toFixed(1)}× exam pace with feedback held until the end.`,
    rationale: atExamPace
      ? "A regular 1.0x full set keeps the pace ladder calibrated against real section conditions."
      : "This checks whether the section method is holding together and gives the timing phase a reliable baseline.",
    estimatedMinutes:
      Math.ceil(
        (asset.questionCount * section.timePerQuestionSeconds) / (60 * pace),
      ) + 8,
    targetUnits: asset.questionCount,
    sectionId: section.id,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: asset.id,
    mockId: null,
    skillTrainerId: null,
    launchPath: `/sets/${asset.id}`,
    launchConfig: {
      kind: "set",
      corePractice: true,
      benchmark: true,
      repeatedBenchmark: repeated,
      calibrationPurpose: atExamPace ? "exam_pace" : "learning_diagnostic",
      trackActiveAnsweringTime: true,
      section: section.key,
      ucatSectionId: section.id,
      questionCount: asset.questionCount,
      prescribedPace: pace,
      actualPace: pace,
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
      optional: true,
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

function mockTask(
  scheduledDate: string,
  sortOrder: number,
  mode: StudyPlanTrainingMode,
  asset: BenchmarkMockAsset,
  repeated: boolean,
): GeneratedStudyPlanTask {
  return {
    scheduledDate,
    sortOrder,
    taskType: "mock",
    title: `${repeated ? "Repeat benchmark · " : ""}${asset.name}`,
    description:
      "Complete a full mock at 1.0x under uninterrupted exam conditions.",
    rationale:
      mode === "exam"
        ? "Practise full-exam pacing, stamina and decision-making under realistic conditions."
        : "Rehearse the complete exam under realistic conditions.",
    estimatedMinutes: FULL_MOCK_MINUTES,
    targetUnits: null,
    sectionId: null,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: asset.id,
    skillTrainerId: null,
    launchPath: `/mocks/${asset.id}`,
    launchConfig: {
      kind: "mock",
      corePractice: true,
      timeSpeedMultiplier: 1,
      repeatedBenchmark: repeated,
    },
  };
}

function mockDates(
  dates: string[],
  readiness: StudyPlanReadinessSnapshot,
  preferredWeekday: number,
  planningDate: string,
  lastCompletedMockDate: string | null,
): Set<string> {
  if (!dates.length || readiness.mode === "learning") return new Set();
  const cadenceInterval = mockIntervalDays(readiness.daysUntilExam);
  const eligible = dates.filter(
    (date) =>
      daysBetween(date, planningDate) >
        UCAT_MOCK_CADENCE_POLICY.finalRecoveryDays &&
      (!lastCompletedMockDate ||
        daysBetween(lastCompletedMockDate, date) >= cadenceInterval),
  );
  if (!eligible.length) return new Set();
  const calendarSpan = Math.max(
    1,
    daysBetween(eligible[0] ?? dates[0]!, eligible[eligible.length - 1]!) + 1,
  );
  const desired = targetMocksInHorizon({
    daysUntilExam: readiness.daysUntilExam,
    horizonDays: calendarSpan,
  });
  const count = Math.min(desired, eligible.length);
  const picked = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const ideal = ((index + 0.5) * eligible.length) / count - 0.5;
    const candidate = eligible
      .filter(
        (date) =>
          !picked.has(date) &&
          [...picked].every(
            (pickedDate) =>
              Math.abs(daysBetween(pickedDate, date)) >=
              UCAT_MOCK_CADENCE_POLICY.mockRecoveryDays,
          ),
      )
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
  const readiness = input.readiness ?? buildReadinessSnapshot(input);
  const sectionTargets =
    input.sectionTargets ??
    allocateSectionTargets({
      totalTarget: input.profile.targetScore,
      sections: input.sections
        .filter((section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT)
        .map((section) => ({
          sectionId: section.id,
          currentEstimate:
            input.signals.find((signal) => signal.sectionId === section.id)
              ?.currentEstimate ?? null,
        })),
    });
  const rankedActivities =
    input.activityCandidates ??
    rankActivityCandidates({
      today: input.today,
      planningDate: input.planningDate,
      targetScore: input.profile.targetScore,
      readiness,
      sections: input.sections,
      signals: input.signals,
      categories: input.categories,
      learningModules: input.learningModules,
      skillTrainers: input.skillTrainers,
      tagSignals: input.tagSignals,
      trainerAttemptCounts: new Map(),
      incompleteReview: null,
      completedMockCount: input.completedMockCount,
      sjtPreference: input.profile.sjtPreference,
      lastCompletedMockDate: input.lastCompletedMockDate,
    });
  const plannedActivities = selectActivityCandidates(rankedActivities, {
    experience: "plan",
  });
  const sectionById = new Map(
    input.sections.map((section) => [section.id, section]),
  );
  const readinessBySection = new Map(
    readiness.sections.map((section) => [section.sectionId, section]),
  );
  const learningModuleById = new Map(
    input.learningModules.map((module) => [module.id, module]),
  );
  const mocks = plannedActivities.some((activity) => activity.kind === "mock")
    ? mockDates(
        dates,
        readiness,
        input.profile.preferredMockWeekday,
        input.planningDate,
        input.lastCompletedMockDate ?? null,
      )
    : new Set<string>();
  const nonMockDayCount = dates.filter((date) => !mocks.has(date)).length;
  const remainingDemand = demandByMilestone(plannedActivities);
  if (mocks.size > 0) {
    for (const activity of plannedActivities) {
      if (isSjtAllocationActivity(activity)) {
        remainingDemand.set(demandKey(activity), 0);
      }
    }
  }
  const outstandingSectionEquivalents = [...remainingDemand.values()].reduce(
    (sum, demand) => sum + demand,
    0,
  );
  const schedulableSectionEquivalents = nonMockDayCount * 2;
  const hasTiming = readiness.sections.some(
    (section) => section.mode !== "learning",
  );
  const demandPerNonMockDay =
    outstandingSectionEquivalents / Math.max(1, nonMockDayCount);
  const ordinaryCoreSlots = 2;
  const lowAvailabilityPressure =
    input.profile.availableDays.length <= 2 && demandPerNonMockDay > 1;
  const justifiedCoreSlots =
    demandPerNonMockDay > 2.5
      ? 4
      : demandPerNonMockDay > 1.5 || lowAvailabilityPressure
        ? 3
        : ordinaryCoreSlots;
  const dayEnvelopes = dates.map((scheduledDate) => ({
    scheduledDate,
    isMock: mocks.has(scheduledDate),
    coreSlotCount: mocks.has(scheduledDate) ? 1 : justifiedCoreSlots,
    includeWarmup:
      !mocks.has(scheduledDate) && hasTiming && input.skillTrainers.length > 0,
  }));
  const useCounts = new Map<string, number>();
  const sectionEquivalentUse = new Map<string, number>();
  const instructionUseBySection = new Map<string, number>();
  const practiceUseBySection = new Map<string, number>();
  const consumedOnce = new Set<string>();
  const canonicalTasks: GeneratedStudyPlanTask[] = [];
  const usedSetIds = new Set<string>();
  const usedMockIds = new Set<string>();
  const contentGaps: StudyPlanGenerationResult["contentGaps"] = [];
  let ordinaryCoreSessionCount = 0;
  let calibrationCount = 0;

  const taskForCandidate = (
    activity: PreparationActivityCandidate,
    scheduledDate: string,
    sortOrder: number,
    intensiveDay: boolean,
  ): GeneratedStudyPlanTask | null => {
    const section = activity.sectionId
      ? sectionById.get(activity.sectionId)
      : null;
    const sectionReadiness = section
      ? readinessBySection.get(section.id)
      : null;
    let generated: GeneratedStudyPlanTask | null = null;
    if (activity.kind === "instruction" && activity.learningModuleId) {
      const learningModule = input.learningModules.find(
        (item) => item.id === activity.learningModuleId,
      );
      generated = learningModule
        ? learningTask(learningModule, scheduledDate, sortOrder)
        : null;
    } else if (activity.kind === "calibration" && section) {
      const selected = selectBenchmarkSet({
        sectionId: section.id,
        sectionQuestionCount: section.questionCount,
        requestedQuestionCount:
          activity.dose.questionCount ?? section.questionCount,
        requestedPace: readinessBySection.get(section.id)?.paceMultiplier ?? 1,
        usedSetIds,
        sets: input.benchmarkSets ?? [],
      });
      if (selected.status === "gap") {
        contentGaps.push({
          kind: "benchmark_set",
          sectionId: section.id,
          reason: selected.reason,
        });
        return null;
      }
      usedSetIds.add(selected.asset.id);
      generated = benchmarkTask(
        section,
        scheduledDate,
        sortOrder,
        selected.asset,
        selected.repeated,
      );
      if (activity.reasonCode === "activity.diagnostic_due") {
        generated.title = `${selected.repeated ? "Repeat benchmark · " : ""}${selected.asset.name}`;
      }
    } else if (activity.kind === "mock") {
      const selected = selectBenchmarkMock({
        usedMockIds,
        mocks: input.benchmarkMocks ?? [],
      });
      if (selected.status === "gap") {
        contentGaps.push({
          kind: "benchmark_mock",
          sectionId: null,
          reason: selected.reason,
        });
        return null;
      }
      usedMockIds.add(selected.asset.id);
      generated = mockTask(
        scheduledDate,
        sortOrder,
        readiness.mode,
        selected.asset,
        selected.repeated,
      );
    } else if (isPracticeActivity(activity) && section) {
      const categories = activity.categoryIds.flatMap((categoryId) => {
        const category = input.categories.find(
          (item) => item.id === categoryId,
        );
        return category ? [category] : [];
      });
      const uses = useCounts.get(activity.id) ?? 0;
      const useOverspeed =
        Boolean(sectionReadiness?.overspeedEligible) && (uses + 1) % 4 === 0;
      const pace = useOverspeed
        ? (sectionReadiness?.overspeedPace ?? 1.1)
        : (sectionReadiness?.paceMultiplier ?? 0.5);
      generated = practiceTask({
        section,
        category: categories[0] ?? null,
        additionalCategories: categories.slice(1),
        mode: sectionReadiness?.mode ?? readiness.mode,
        pace,
        questionCount: activity.dose.questionCount ?? 10,
        scheduledDate,
        sortOrder,
      });
    }
    if (!generated) return null;
    const allocatedLearningSession =
      activity.kind === "instruction" &&
      generated.taskType === "learn" &&
      generated.estimatedMinutes > LEARNING_MODULE_SESSION_MINUTES;
    return {
      ...generated,
      description: allocatedLearningSession
        ? `Work through the next ${LEARNING_MODULE_SESSION_MINUTES} minutes of this module. You can continue it in a later session.`
        : generated.description,
      rationale: activity.studentReason,
      estimatedMinutes: activity.duration.practiceMinutes,
      targetUnits: activity.dose.questionCount ?? generated.targetUnits,
      questionTagId:
        activity.questionTagIds.length === 1
          ? activity.questionTagIds[0]!
          : generated.questionTagId,
      launchConfig: {
        ...generated.launchConfig,
        categoryIds: activity.categoryIds,
        questionTagIds: activity.questionTagIds,
        activityCandidateId: activity.id,
        activityObjective: activity.objective,
        activityReasonCode: activity.reasonCode,
        sectionEquivalents: activity.dose.sectionEquivalents,
        preparationPhase: sectionReadiness?.mode ?? readiness.mode,
        prescribedPace:
          generated.launchConfig.prescribedPace ??
          sectionReadiness?.paceMultiplier ??
          (activity.kind === "mock" ? 1 : null),
        nextMilestone:
          sectionReadiness?.nextMilestone ??
          "Rehearse the complete exam under realistic conditions.",
        sectionName: section?.name ?? "Full UCAT",
        practiceMinutes: activity.duration.practiceMinutes,
        reviewMinutes: activity.duration.reviewMinutes,
        preparationWarning: intensiveDay
          ? "This is an intensive study day because the remaining preparation demand is high for your available days."
          : null,
        optional: false,
      },
    };
  };

  const schedulingDose = (activity: PreparationActivityCandidate) =>
    activity.dose.sectionEquivalents +
    (activity.kind === "instruction"
      ? LEARNING_LOOP_TARGET_SECTION_EQUIVALENTS
      : 0);

  for (const envelope of dayEnvelopes) {
    const date = envelope.scheduledDate;
    const mockCandidate = plannedActivities.find(
      (activity) => activity.kind === "mock",
    );
    const candidatesForDay: PreparationActivityCandidate[] = [];
    let dailySectionEquivalents = 0;
    const dailyCognitiveSections = new Set<string>();
    if (envelope.isMock) {
      if (mockCandidate) candidatesForDay.push(mockCandidate);
    } else {
      const outstandingInstructions = plannedActivities.filter(
        (activity) =>
          activity.kind === "instruction" &&
          !consumedOnce.has(activity.id) &&
          (remainingDemand.get(demandKey(activity)) ?? 0) > 0,
      );
      const intensiveLearningDay = envelope.coreSlotCount > ordinaryCoreSlots;
      const learningLoopDay = outstandingInstructions.length > 0;
      for (let slot = 0; slot < envelope.coreSlotCount; slot += 1) {
        const sectionsRequiringInitialExposure = new Set(
          plannedActivities.flatMap((activity) =>
            activity.kind === "instruction" && activity.sectionId
              ? [activity.sectionId]
              : [],
          ),
        );
        const hasBasicLearningExposure = [
          ...sectionsRequiringInitialExposure,
        ].every(
          (sectionId) => (instructionUseBySection.get(sectionId) ?? 0) > 0,
        );
        const eligible = plannedActivities.filter((activity) => {
          if (activity.kind === "mock" || activity.kind === "review")
            return false;
          if (activity.kind === "instruction" && !learningLoopDay) return false;
          if ((remainingDemand.get(demandKey(activity)) ?? 0) <= 0) {
            return false;
          }
          if (
            activity.kind === "calibration" &&
            ((activity.reasonCode === "activity.diagnostic_due" &&
              !hasBasicLearningExposure) ||
              slot > 0 ||
              (activity.reasonCode !== "activity.diagnostic_due" &&
                readiness.mode !== "exam" &&
                ordinaryCoreSessionCount < (calibrationCount + 1) * 2))
          ) {
            return false;
          }
          if (
            (activity.kind === "instruction" ||
              activity.kind === "calibration") &&
            consumedOnce.has(activity.id)
          ) {
            return false;
          }
          if (dailySectionEquivalents + schedulingDose(activity) > 2.01) {
            return false;
          }
          if (
            envelope.coreSlotCount > 2 &&
            activity.sectionId &&
            !dailyCognitiveSections.has(activity.sectionId) &&
            dailyCognitiveSections.size >= 2
          ) {
            return false;
          }
          return activity.kind !== "optional_warmup";
        });
        const instructionEligible = eligible.filter(
          (activity) => activity.kind === "instruction",
        );
        const initialDiagnosticEligible = eligible.filter(
          (activity) =>
            activity.kind === "calibration" &&
            activity.reasonCode === "activity.diagnostic_due",
        );
        const prioritiseInitialDiagnostic =
          initialDiagnosticEligible.length > 0;
        const prioritiseInstruction =
          !prioritiseInitialDiagnostic &&
          learningLoopDay &&
          instructionEligible.length > 0;
        const broadEligible = eligible.filter(
          (activity) =>
            activity.kind === "broad_practice" ||
            activity.kind === "mixed_practice" ||
            activity.kind === "related_practice",
        );
        const hasOutstandingEssentialInstruction = instructionEligible.some(
          (activity) =>
            learningModuleById.get(activity.learningModuleId ?? "")
              ?.priority === "essential",
        );
        const slotEligible = prioritiseInitialDiagnostic
          ? initialDiagnosticEligible
          : prioritiseInstruction
            ? instructionEligible.filter(
                (activity) =>
                  !hasOutstandingEssentialInstruction ||
                  learningModuleById.get(activity.learningModuleId ?? "")
                    ?.priority === "essential",
              )
            : envelope.coreSlotCount > 2 &&
                slot === 0 &&
                broadEligible.length > 0
              ? broadEligible
              : eligible;
        const adjustedPriority = (activity: PreparationActivityCandidate) =>
          activity.ranking.total -
          (useCounts.get(activity.id) ?? 0) * 60 -
          (activity.sectionId && isPracticeActivity(activity)
            ? ((sectionEquivalentUse.get(activity.sectionId) ?? 0) +
                activity.dose.sectionEquivalents) *
              1000
            : 0) -
          (activity.kind === "targeted_practice" &&
          activity.sectionId &&
          readinessBySection.get(activity.sectionId)?.mode !== "learning"
            ? 2
            : 0);
        const selected = [...slotEligible].sort((left, right) => {
          const leftAdjusted = adjustedPriority(left);
          const rightAdjusted = adjustedPriority(right);
          if (left.kind === "instruction" && right.kind === "instruction") {
            const leftModule = learningModuleById.get(
              left.learningModuleId ?? "",
            );
            const rightModule = learningModuleById.get(
              right.learningModuleId ?? "",
            );
            const priorityDifference =
              Number(rightModule?.priority === "essential") -
              Number(leftModule?.priority === "essential");
            const useDifference =
              (instructionUseBySection.get(left.sectionId ?? "") ?? 0) -
              (instructionUseBySection.get(right.sectionId ?? "") ?? 0);
            const recencyDifference = (
              input.lastLearningModuleServedAtBySection?.[
                left.sectionId ?? ""
              ] ?? ""
            ).localeCompare(
              input.lastLearningModuleServedAtBySection?.[
                right.sectionId ?? ""
              ] ?? "",
            );
            return (
              priorityDifference ||
              useDifference ||
              recencyDifference ||
              (left.sectionId === right.sectionId
                ? (leftModule?.authoredOrder ?? Number.MAX_SAFE_INTEGER) -
                  (rightModule?.authoredOrder ?? Number.MAX_SAFE_INTEGER)
                : 0) ||
              (sectionById.get(left.sectionId ?? "")?.sectionNumber ?? 99) -
                (sectionById.get(right.sectionId ?? "")?.sectionNumber ?? 99) ||
              rightAdjusted - leftAdjusted ||
              left.id.localeCompare(right.id)
            );
          }
          return (
            rightAdjusted - leftAdjusted || left.id.localeCompare(right.id)
          );
        })[0];
        if (!selected) break;
        if (selected.kind === "calibration") {
          candidatesForDay.splice(0, candidatesForDay.length, selected);
          consumedOnce.add(selected.id);
          if (selected.reasonCode !== "activity.diagnostic_due") {
            calibrationCount += 1;
          }
          remainingDemand.set(demandKey(selected), 0);
          break;
        }
        candidatesForDay.push(selected);
        remainingDemand.set(
          demandKey(selected),
          (remainingDemand.get(demandKey(selected)) ?? 0) -
            Math.max(0.25, selected.dose.sectionEquivalents),
        );
        dailySectionEquivalents += schedulingDose(selected);
        if (selected.sectionId) dailyCognitiveSections.add(selected.sectionId);
        useCounts.set(selected.id, (useCounts.get(selected.id) ?? 0) + 1);
        if (selected.sectionId && isPracticeActivity(selected)) {
          ordinaryCoreSessionCount += 1;
          practiceUseBySection.set(
            selected.sectionId,
            (practiceUseBySection.get(selected.sectionId) ?? 0) + 1,
          );
          sectionEquivalentUse.set(
            selected.sectionId,
            (sectionEquivalentUse.get(selected.sectionId) ?? 0) +
              selected.dose.sectionEquivalents,
          );
        }
        if (selected.kind === "instruction") {
          consumedOnce.add(selected.id);
          if (selected.sectionId) {
            instructionUseBySection.set(
              selected.sectionId,
              (instructionUseBySection.get(selected.sectionId) ?? 0) + 1,
            );
          }
          if (!intensiveLearningDay) break;
        }
      }
    }

    let sortOrder = 0;
    const firstSectionId = candidatesForDay[0]?.sectionId;
    const warmupCandidate = rankedActivities.find(
      (activity) =>
        activity.kind === "optional_warmup" &&
        activity.sectionId === firstSectionId &&
        activity.skillTrainerId,
    );
    if (
      warmupCandidate?.skillTrainerId &&
      envelope.includeWarmup &&
      candidatesForDay.every((activity) => activity.kind !== "calibration")
    ) {
      const trainer = input.skillTrainers.find(
        (item) => item.id === warmupCandidate.skillTrainerId,
      );
      if (trainer) {
        const warmup = skillTrainerTask(trainer, null, date, sortOrder++);
        canonicalTasks.push({
          ...warmup,
          rationale: warmupCandidate.studentReason,
          launchConfig: {
            ...warmup.launchConfig,
            activityCandidateId: warmupCandidate.id,
            activityObjective: warmupCandidate.objective,
            activityReasonCode: warmupCandidate.reasonCode,
          },
        });
      }
    }
    for (const activity of candidatesForDay) {
      const selectedTask = taskForCandidate(
        activity,
        date,
        sortOrder++,
        envelope.coreSlotCount > 2,
      );
      if (!selectedTask) continue;
      if (
        activity.kind === "instruction" &&
        selectedTask.taskType === "learn" &&
        selectedTask.sectionId
      ) {
        const section = sectionById.get(selectedTask.sectionId);
        if (section) {
          const learningModule = input.learningModules.find(
            (module) => module.id === selectedTask.learningModuleId,
          );
          const inventory = learningModule?.targetedPracticeInventory;
          const targetQuestionCount = learningLoopTargetQuestionCount(
            section.questionCount,
          );
          const requestedQuestionCount = Math.min(
            targetQuestionCount,
            inventory?.strictSelectableQuestionCount ??
              inventory?.strictQuestionCount ??
              targetQuestionCount,
          );
          if (inventory && requestedQuestionCount < targetQuestionCount) {
            contentGaps.push({
              kind: "targeted_practice",
              sectionId: section.id,
              moduleId: learningModule.id,
              reason: "insufficient_strict_content",
              requestedQuestionCount: targetQuestionCount,
              availableQuestionCount: requestedQuestionCount,
            });
          } else if (
            inventory &&
            activity.questionTagIds.length > 0 &&
            (inventory.preferredTagSelectableQuestionCount ??
              inventory.preferredTagQuestionCount) < requestedQuestionCount
          ) {
            contentGaps.push({
              kind: "targeted_practice",
              sectionId: section.id,
              moduleId: learningModule.id,
              reason: "tag_fallback_required",
              requestedQuestionCount,
              availableQuestionCount:
                inventory.preferredTagSelectableQuestionCount ??
                inventory.preferredTagQuestionCount,
            });
          }
          if (requestedQuestionCount === 0) continue;
          canonicalTasks.push(selectedTask);
          const linkedCategories = activity.categoryIds.flatMap(
            (categoryId) => {
              const category = input.categories.find(
                (item) => item.id === categoryId,
              );
              return category ? [category] : [];
            },
          );
          const linkedPractice = practiceTask({
            section,
            category: linkedCategories[0] ?? null,
            additionalCategories: linkedCategories.slice(1),
            mode: "learning",
            pace: readinessBySection.get(section.id)?.paceMultiplier ?? 0.5,
            questionCount: requestedQuestionCount,
            scheduledDate: date,
            sortOrder: sortOrder++,
            extraConfig: {
              learningModuleId: selectedTask.learningModuleId,
              questionTagIds: activity.questionTagIds,
              linkedLearningPractice: true,
              activityCandidateId: activity.id,
              activityObjective: "build_learning_exposure",
              activityReasonCode: "activity.module_linked_practice",
              preparationPhase: "learning",
              prescribedPace: null,
              nextMilestone: selectedTask.launchConfig.nextMilestone,
              sectionName: section.name,
              optional: false,
            },
          });
          linkedPractice.title = `Practice · ${selectedTask.title}`;
          linkedPractice.estimatedMinutes = Math.ceil(
            requestedQuestionCount * 1.5,
          );
          linkedPractice.rationale =
            "Apply the method from the module while it is still fresh.";
          linkedPractice.questionTagId =
            activity.questionTagIds.length === 1
              ? activity.questionTagIds[0]!
              : null;
          canonicalTasks.push(linkedPractice);
          const linkedReview = reviewTask(
            linkedPractice,
            date,
            sortOrder++,
            "learning",
          );
          canonicalTasks.push({
            ...linkedReview,
            rationale: linkedPractice.rationale,
            launchConfig: {
              ...linkedReview.launchConfig,
              linkedLearningPractice: true,
              learningModuleId: selectedTask.learningModuleId,
              derivedReview: true,
              preparationPhase: "learning",
              prescribedPace: null,
              sectionName: section.name,
            },
          });
          practiceUseBySection.set(
            section.id,
            (practiceUseBySection.get(section.id) ?? 0) + 1,
          );
          sectionEquivalentUse.set(
            section.id,
            (sectionEquivalentUse.get(section.id) ?? 0) +
              linkedPractice.targetUnits! / section.questionCount,
          );
          ordinaryCoreSessionCount += 1;
        }
        continue;
      }
      canonicalTasks.push(selectedTask);
      if (activity.duration.reviewMinutes > 0 && activity.kind !== "mock") {
        const review = reviewTask(selectedTask, date, sortOrder++);
        canonicalTasks.push({
          ...review,
          estimatedMinutes: activity.duration.reviewMinutes,
          rationale: activity.studentReason,
          launchConfig: {
            ...review.launchConfig,
            activityCandidateId: activity.id,
            activityObjective: activity.objective,
            activityReasonCode: activity.reasonCode,
            preparationPhase: selectedTask.launchConfig.preparationPhase,
            prescribedPace: selectedTask.launchConfig.prescribedPace,
            nextMilestone: selectedTask.launchConfig.nextMilestone,
            sectionName: selectedTask.launchConfig.sectionName,
            practiceMinutes: 0,
            reviewMinutes: activity.duration.reviewMinutes,
            preparationWarning: selectedTask.launchConfig.preparationWarning,
            derivedReview: true,
          },
        });
      }
    }
  }

  return {
    tasks: canonicalTasks,
    capacityRisk: capacityRisk(
      input.profile,
      input.signals,
      readiness,
      outstandingSectionEquivalents,
      schedulableSectionEquivalents,
    ),
    sectionTargets,
    coreSectionEquivalentsPerWeek: coreSectionEquivalentsPerWeek(
      canonicalTasks,
      input.sections,
      input.today,
      endsOn,
    ),
    readiness,
    endsOn,
    contentGaps,
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
  const extension = input.activityCandidates
    ? selectActivityCandidates(input.activityCandidates, {
        experience: "extra",
        requiredWorkComplete: true,
      })[0]
    : null;
  const section = input.sectionKey
    ? input.sections.find((candidate) => candidate.key === input.sectionKey)
    : extension?.sectionId
      ? input.sections.find((candidate) => candidate.id === extension.sectionId)
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
  const rankedCategory = extension?.categoryIds[0]
    ? input.categories.find(
        (candidate) => candidate.id === extension.categoryIds[0],
      )
    : null;
  const category =
    rankedCategory ??
    pickCategory(section.id, input.categories, scheduledCounts);
  const signal = signalBySection.get(section.id);
  const canonicalReadiness = input.readiness?.sections.find(
    (candidate) => candidate.sectionId === section.id,
  );
  const daysRemaining = Math.max(
    0,
    daysBetween(input.today, input.planningDate),
  );
  const timed = canonicalReadiness
    ? canonicalReadiness.mode !== "learning"
    : daysRemaining <= 60 || (signal?.completedFullSets ?? 0) > 0;
  const pace =
    canonicalReadiness?.paceMultiplier ?? paceLadderStep(signal?.observedPace);
  const trainer = pickSkillTrainer(
    section.id,
    category?.id ?? null,
    input.skillTrainers,
    category ? (scheduledCounts.get(category.id) ?? 0) : 0,
  );
  const includeWarmup = Boolean(
    trainer && trainer.estimatedMinutes <= Math.max(2, input.minutes * 0.25),
  );
  const practiceMinutes = input.minutes;
  const secondsPerQuestion = timed
    ? Math.round(section.timePerQuestionSeconds / pace)
    : 90;
  const questionCount = Math.max(
    1,
    Math.floor((practiceMinutes * 60) / secondsPerQuestion),
  );
  const commonConfig = {
    extraStudy: true,
    corePractice: false,
    optional: true,
    activityCandidateId: extension?.id ?? null,
    activityObjective: extension?.objective ?? null,
    activityReasonCode: extension?.reasonCode ?? "activity.optional_extension",
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
