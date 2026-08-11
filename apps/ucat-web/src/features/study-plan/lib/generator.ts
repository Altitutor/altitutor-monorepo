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
  outstandingSectionEquivalents: number,
  schedulableSectionEquivalents: number,
  demandFitsSlots: boolean,
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
    outstandingSectionEquivalents > schedulableSectionEquivalents ||
    !demandFitsSlots ||
    profile.availableDays.length < minimumDays ||
    timingCapacityConstrained;
  return {
    level: risky ? "warning" : "none",
    availableMinutesPerWeek: available,
    recommendedMinutesPerWeek: recommended,
    outstandingSectionEquivalents,
    schedulableSectionEquivalents,
    message: risky
      ? outstandingSectionEquivalents > schedulableSectionEquivalents ||
        !demandFitsSlots
        ? `${outstandingSectionEquivalents.toFixed(1)} outstanding section-equivalents cannot fit inside the sustainable 21-day intensity envelope. Add an available weekday or expect the plan to prioritise the most important milestones.`
        : timingCapacityConstrained
        ? "There may not be enough broad practice opportunities to reach reliable exam pace before the exam phase. The plan will move gradually and prioritise representative work."
        : readiness.mode === "exam"
          ? "There are fewer available study days than the exam-phase mock cadence needs. The plan will prioritise mocks and the highest-value weaknesses on the days you selected."
          : "There are very few available study days. The plan will still prioritise the highest-value work and replan unfinished work instead of building a backlog."
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
  if (activity.kind === "related_practice" || activity.dose.questionCount === 10) {
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
        ? "Practise full-exam pacing, stamina and decision-making under realistic conditions."
        : "Rehearse the complete exam under realistic conditions.",
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
  const rankedActivities = rankActivityCandidates({
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
  const mocks = mockDates(
    dates,
    readiness,
    input.profile.preferredMockWeekday,
    input.planningDate,
    input.lastCompletedMockDate ?? null,
  );
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
  const hasLearning = readiness.sections.some(
    (section) => section.mode === "learning",
  );
  const hasTiming = readiness.sections.some(
    (section) => section.mode !== "learning",
  );
  const demandPerNonMockDay =
    outstandingSectionEquivalents / Math.max(1, nonMockDayCount);
  const ordinaryCoreSlots = hasLearning ? (hasTiming ? 2 : 1) : 2;
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
      !mocks.has(scheduledDate) &&
      hasTiming &&
      input.skillTrainers.length > 0,
  }));
  const doseByMilestone = new Map<string, number>();
  for (const activity of plannedActivities) {
    const key = demandKey(activity);
    if (!remainingDemand.has(key)) continue;
    doseByMilestone.set(
      key,
      Math.max(
        doseByMilestone.get(key) ?? 0,
        Math.max(0.25, activity.dose.sectionEquivalents),
      ),
    );
  }
  const requiredSessionCount = [...remainingDemand].reduce(
    (count, [key, remaining]) =>
      count + Math.ceil(remaining / Math.max(0.25, doseByMilestone.get(key) ?? 0)),
    0,
  );
  const discreteSlotCapacity = dayEnvelopes
    .filter((envelope) => !envelope.isMock)
    .reduce((sum, envelope) => sum + envelope.coreSlotCount, 0);
  const demandFitsSlots = requiredSessionCount <= discreteSlotCapacity;

  const useCounts = new Map<string, number>();
  const sectionEquivalentUse = new Map<string, number>();
  const consumedOnce = new Set<string>();
  const canonicalTasks: GeneratedStudyPlanTask[] = [];
  let canonicalMockNumber = input.completedMockCount;
  let ordinaryCoreSessionCount = 0;
  let calibrationCount = 0;

  const taskForCandidate = (
    activity: PreparationActivityCandidate,
    scheduledDate: string,
    sortOrder: number,
  ): GeneratedStudyPlanTask | null => {
    const section = activity.sectionId
      ? sectionById.get(activity.sectionId)
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
      generated = benchmarkTask(
        section,
        scheduledDate,
        sortOrder,
        readinessBySection.get(section.id)?.paceMultiplier ?? 1,
      );
      if (activity.reasonCode === "activity.diagnostic_due") {
        generated.title = `${section.shortName} diagnostic`;
      }
    } else if (activity.kind === "mock") {
      generated = mockTask(
        ++canonicalMockNumber,
        scheduledDate,
        sortOrder,
        readiness.mode,
      );
    } else if (isPracticeActivity(activity) && section) {
      const categories = activity.categoryIds.flatMap((categoryId) => {
        const category = input.categories.find((item) => item.id === categoryId);
        return category ? [category] : [];
      });
      const sectionReadiness = readinessBySection.get(section.id);
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
    return {
      ...generated,
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
        optional: false,
      },
    };
  };

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
      for (let slot = 0; slot < envelope.coreSlotCount; slot += 1) {
        const eligible = plannedActivities.filter((activity) => {
            if (activity.kind === "mock" || activity.kind === "review") return false;
            if ((remainingDemand.get(demandKey(activity)) ?? 0) <= 0) {
              return false;
            }
            if (
              activity.kind === "calibration" &&
              (slot > 0 ||
                (readiness.mode !== "exam" &&
                  ordinaryCoreSessionCount < (calibrationCount + 1) * 2))
            ) {
              return false;
            }
            if (
              (activity.kind === "instruction" || activity.kind === "calibration") &&
              consumedOnce.has(activity.id)
            ) {
              return false;
            }
            if (
              dailySectionEquivalents + activity.dose.sectionEquivalents >
              2.01
            ) {
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
        const broadEligible = eligible.filter(
          (activity) =>
            activity.kind === "broad_practice" ||
            activity.kind === "mixed_practice" ||
            activity.kind === "related_practice",
        );
        const slotEligible =
          envelope.coreSlotCount > 2 && slot === 0 && broadEligible.length > 0
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
          return rightAdjusted - leftAdjusted || left.id.localeCompare(right.id);
        })[0];
        if (!selected) break;
        if (selected.kind === "calibration") {
          candidatesForDay.splice(0, candidatesForDay.length, selected);
          consumedOnce.add(selected.id);
          calibrationCount += 1;
          remainingDemand.set(demandKey(selected), 0);
          break;
        }
        candidatesForDay.push(selected);
        remainingDemand.set(
          demandKey(selected),
          (remainingDemand.get(demandKey(selected)) ?? 0) -
            Math.max(0.25, selected.dose.sectionEquivalents),
        );
        dailySectionEquivalents += selected.dose.sectionEquivalents;
        if (selected.sectionId) dailyCognitiveSections.add(selected.sectionId);
        useCounts.set(selected.id, (useCounts.get(selected.id) ?? 0) + 1);
        if (selected.sectionId && isPracticeActivity(selected)) {
          ordinaryCoreSessionCount += 1;
          sectionEquivalentUse.set(
            selected.sectionId,
            (sectionEquivalentUse.get(selected.sectionId) ?? 0) +
              selected.dose.sectionEquivalents,
          );
        }
        if (selected.kind === "instruction") {
          consumedOnce.add(selected.id);
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
      const selectedTask = taskForCandidate(activity, date, sortOrder++);
      if (!selectedTask) continue;
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
            derivedReview: true,
          },
        });
      }
    }
  }

  const allDemandPacked = [...remainingDemand.values()].every(
    (remaining) => remaining <= 0.01,
  );
  return {
    tasks: canonicalTasks,
    capacityRisk: capacityRisk(
      input.profile,
      input.signals,
      readiness,
      outstandingSectionEquivalents,
      schedulableSectionEquivalents,
      demandFitsSlots && allDemandPacked,
    ),
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
    ? input.categories.find((candidate) => candidate.id === extension.categoryIds[0])
    : null;
  const category =
    rankedCategory ?? pickCategory(section.id, input.categories, scheduledCounts);
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
