import {
  addDays,
  daysBetween,
  parseIsoDate,
  weekday,
} from "@/features/study-plan/lib/dates";
import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";
import type {
  GeneratedStudyPlanTask,
  StudyPlanAvailability,
  StudyPlanCapacityRisk,
  StudyPlanCategorySignal,
  StudyPlanExtraStudyInput,
  StudyPlanGenerationResult,
  StudyPlanLearningModule,
  StudyPlanPhase,
  StudyPlanProfileInput,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
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

type DatedAvailability = StudyPlanAvailability & { date: string };

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

const COGNITIVE_SECTION_COUNT = 3;

function phaseFor(daysRemaining: number): StudyPlanPhase {
  if (daysRemaining <= 14) return "taper";
  if (daysRemaining <= 60) return "performance";
  if (daysRemaining <= 150) return "development";
  return "foundation";
}

function workloadFraction(phase: StudyPlanPhase): number {
  if (phase === "foundation") return 0.45;
  if (phase === "development") return 0.65;
  if (phase === "performance") return 0.85;
  return 0.65;
}

function practiceSpeed(
  phase: StudyPlanPhase,
  evidenceCount: number,
): number | null {
  if (phase === "foundation" && evidenceCount < 2) return null;
  if (phase === "foundation") return 0.65;
  if (phase === "development") return 0.8;
  if (phase === "performance") return 1;
  return 1;
}

function selectedDates(
  from: string,
  to: string,
  availability: StudyPlanAvailability[],
): DatedAvailability[] {
  const byWeekday = new Map(availability.map((item) => [item.weekday, item]));
  const result: DatedAvailability[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const available = byWeekday.get(weekday(cursor));
    if (available) result.push({ ...available, date: cursor });
  }
  return result;
}

function recommendedWeeklyMinutes(
  targetScore: number,
  currentTotal: number | null,
  daysRemaining: number,
): number {
  const scoreGap = Math.max(0, targetScore - (currentTotal ?? 1800));
  const urgency =
    daysRemaining < 90 ? 1 + (90 - Math.max(7, daysRemaining)) / 90 : 1;
  return (
    Math.round(
      Math.min(720, Math.max(75, (90 + scoreGap * 0.35) * urgency)) / 15,
    ) * 15
  );
}

function capacityRisk(
  profile: StudyPlanProfileInput,
  signals: StudyPlanSectionSignal[],
  daysRemaining: number,
): StudyPlanCapacityRisk {
  const available = profile.availableDays.reduce(
    (sum, day) => sum + day.maxMinutes,
    0,
  );
  const cognitiveEstimates = signals
    .slice(0, COGNITIVE_SECTION_COUNT)
    .map((signal) => signal.currentEstimate)
    .filter((value): value is number => value != null);
  const currentTotal =
    cognitiveEstimates.length === COGNITIVE_SECTION_COUNT
      ? cognitiveEstimates.reduce((sum, value) => sum + value, 0)
      : null;
  const recommended = recommendedWeeklyMinutes(
    profile.targetScore,
    currentTotal,
    daysRemaining,
  );
  const risky = available < recommended * 0.7;
  return {
    level: risky ? "warning" : "none",
    availableMinutesPerWeek: available,
    recommendedMinutesPerWeek: recommended,
    message: risky
      ? `Your availability is about ${recommended - available} minutes below the weekly workload normally needed for this target. We will still build the best plan that fits.`
      : null,
  };
}

function sectionPriority(
  sections: StudyPlanSection[],
  signals: StudyPlanSectionSignal[],
  sectionTargets: Record<string, number>,
): StudyPlanSection[] {
  const signalMap = new Map(
    signals.map((signal) => [signal.sectionId, signal]),
  );
  return [...sections].sort((a, b) => {
    const aSignal = signalMap.get(a.id);
    const bSignal = signalMap.get(b.id);
    const aGap =
      a.sectionNumber <= 3
        ? (sectionTargets[a.id] ?? 600) - (aSignal?.currentEstimate ?? 520)
        : 50 - (aSignal?.evidenceCount ?? 0) * 5;
    const bGap =
      b.sectionNumber <= 3
        ? (sectionTargets[b.id] ?? 600) - (bSignal?.currentEstimate ?? 520)
        : 50 - (bSignal?.evidenceCount ?? 0) * 5;
    return bGap - aGap || a.sectionNumber - b.sectionNumber;
  });
}

function practiceTask(
  section: StudyPlanSection,
  signal: StudyPlanSectionSignal | undefined,
  category: StudyPlanCategorySignal | null,
  phase: StudyPlanPhase,
  budgetMinutes: number,
  scheduledDate: string,
  sortOrder: number,
  supplementary = false,
): GeneratedStudyPlanTask {
  const speed = practiceSpeed(phase, signal?.evidenceCount ?? 0);
  const timed = speed != null;
  const secondsPerQuestion = timed
    ? Math.round(section.timePerQuestionSeconds / speed)
    : null;
  const requestedQuestionCount = Math.max(
    5,
    Math.min(
      30,
      Math.floor((budgetMinutes * 60) / (secondsPerQuestion ?? 120)),
    ),
  );
  const questionCount = category
    ? Math.max(
        1,
        Math.min(requestedQuestionCount, category.availableQuestionCount),
      )
    : requestedQuestionCount;
  const timingLabel = timed ? `${speed}x exam speed` : "untimed";
  return {
    scheduledDate,
    sortOrder,
    taskType: "practice",
    title: `${supplementary ? "SJT add-on" : (category?.name ?? `${section.shortName} practice`)} · ${timingLabel}`,
    description: `${questionCount} questions with ${phase === "foundation" ? "feedback after each stem" : "feedback at the end"}.`,
    rationale:
      signal?.currentEstimate == null
        ? `Build a reliable baseline in ${category?.name ?? section.name}.`
        : supplementary
          ? "Keep SJT familiar without displacing your scored-section priorities."
          : category
            ? `This is currently one of your highest-value ${section.shortName} categories.`
            : `Prioritised from your current ${section.name} score trajectory.`,
    estimatedMinutes: Math.max(
      10,
      Math.min(
        budgetMinutes,
        Math.ceil((questionCount * (secondsPerQuestion ?? 120)) / 60) + 5,
      ),
    ),
    targetUnits: questionCount,
    sectionId: section.id,
    questionStemCategoryId: category?.id ?? null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      section: section.key,
      ucatSectionId: section.id,
      questionCount,
      categoryIds: category ? [category.id] : [],
      timeMode: timed ? "speed" : "off",
      timeSpeedMultiplier: speed ?? 1,
      timePerQuestionSeconds: secondsPerQuestion,
      reviewTiming: phase === "foundation" ? "afterEachStem" : "atEnd",
      supplementary,
    },
  };
}

function benchmarkTask(
  section: StudyPlanSection,
  scheduledDate: string,
  sortOrder: number,
  speed: number,
): GeneratedStudyPlanTask {
  return {
    scheduledDate,
    sortOrder,
    taskType: "section_benchmark",
    title: `Full ${section.shortName} benchmark`,
    description: `${section.questionCount} questions at ${speed}x exam speed, with feedback at the end.`,
    rationale: `A full-section result lets the plan calibrate ${section.name} before introducing mocks.`,
    estimatedMinutes: Math.max(
      20,
      Math.ceil(
        (section.questionCount * section.timePerQuestionSeconds) / speed / 60,
      ) + 5,
    ),
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
      section: section.key,
      ucatSectionId: section.id,
      questionCount: section.questionCount,
      categoryIds: [],
      timeMode: "speed",
      timeSpeedMultiplier: speed,
      timePerQuestionSeconds: Math.round(
        section.timePerQuestionSeconds / speed,
      ),
      reviewTiming: "atEnd",
      benchmark: true,
    },
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
    description: `A short ${trainer.estimatedMinutes}-minute speed and accuracy warm-up.`,
    rationale: category
      ? `This supports today’s ${category.name} work.`
      : "Wake up the core skill before beginning longer practice.",
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
): GeneratedStudyPlanTask {
  const questionCount =
    sourceTask.taskType === "mock" ? 120 : (sourceTask.targetUnits ?? 1);
  const minutes = estimateReviewMinutes(questionCount);
  return {
    scheduledDate,
    sortOrder,
    taskType: "review",
    title: `Review · ${sourceTask.title}`,
    description:
      "Check the questions that need attention and identify the method or timing change to carry forward.",
    rationale:
      "Immediate review turns the attempt into usable evidence for your next session.",
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
    },
    sourceTaskRef: {
      scheduledDate: sourceTask.scheduledDate,
      sortOrder: sourceTask.sortOrder,
    },
  };
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
  if (!candidates.length) return null;
  const selected = [...candidates].sort((a, b) => {
    const aCount = scheduledCounts.get(a.id) ?? 0;
    const bCount = scheduledCounts.get(b.id) ?? 0;
    const aPriority = (0.5 + a.weaknessScore) / (1 + aCount * 0.55);
    const bPriority = (0.5 + b.weaknessScore) / (1 + bCount * 0.55);
    return (
      bPriority - aPriority ||
      b.availableQuestionCount - a.availableQuestionCount ||
      a.name.localeCompare(b.name)
    );
  })[0];
  scheduledCounts.set(selected.id, (scheduledCounts.get(selected.id) ?? 0) + 1);
  return selected;
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
  const categoryTrainers = categoryId
    ? sectionTrainers.filter((trainer) =>
        trainer.categoryIds.includes(categoryId),
      )
    : [];
  const candidates = categoryTrainers.length
    ? categoryTrainers
    : sectionTrainers;
  return candidates[cursor % candidates.length] ?? null;
}

export function generateExtraStudyTasks(
  input: GenerateExtraStudyTaskInput,
): GeneratedStudyPlanTask[] {
  parseIsoDate(input.today);
  parseIsoDate(input.planningDate);

  const availableSections = input.sections.filter((section) =>
    input.categories.some(
      (category) =>
        category.sectionId === section.id &&
        category.availableQuestionCount > 0,
    ),
  );
  const preferredSection = input.sectionKey
    ? availableSections.find((section) => section.key === input.sectionKey)
    : null;
  if (input.sectionKey && !preferredSection) {
    const requestedSection = input.sections.find(
      (section) => section.key === input.sectionKey,
    );
    throw new Error(
      `There are no suitable ${requestedSection?.shortName ?? "section"} questions available yet.`,
    );
  }
  const cognitiveSections = availableSections.filter(
    (section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT,
  );
  const targets =
    input.sectionTargets && Object.keys(input.sectionTargets).length
      ? input.sectionTargets
      : allocateSectionTargets(
          input.targetScore,
          input.sections
            .filter((section) => section.sectionNumber <= 3)
            .map((section) => ({
              sectionId: section.id,
              currentEstimate:
                input.signals.find((signal) => signal.sectionId === section.id)
                  ?.currentEstimate ?? null,
            })),
        );
  const section =
    preferredSection ??
    sectionPriority(cognitiveSections, input.signals, targets)[0] ??
    availableSections[0];
  if (!section) {
    throw new Error("There are no suitable practice questions available yet.");
  }

  const scheduledCounts = new Map<string, number>();
  for (const categoryId of input.scheduledCategoryIds ?? []) {
    if (!categoryId) continue;
    scheduledCounts.set(categoryId, (scheduledCounts.get(categoryId) ?? 0) + 1);
  }
  const category = pickCategory(section.id, input.categories, scheduledCounts);
  if (!category) {
    throw new Error(
      `There are no suitable ${section.shortName} questions available yet.`,
    );
  }

  const commonLaunchConfig = {
    extraStudy: true,
    requestedMinutes: input.minutes,
    requestedSectionKey: input.sectionKey,
  };
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

  const phase = phaseFor(
    Math.max(0, daysBetween(input.today, input.planningDate)),
  );
  const task = practiceTask(
    section,
    input.signals.find((signal) => signal.sectionId === section.id),
    category,
    phase,
    input.minutes - warmupMinutes,
    input.today,
    input.sortOrder + (includeWarmup ? 1 : 0),
    section.sectionNumber === 4,
  );
  const practice = {
    ...task,
    estimatedMinutes: Math.max(5, input.minutes - warmupMinutes),
    rationale: input.sectionKey
      ? `You chose ${section.name}; this category is the best next use of your extra time.`
      : `This is the best next use of your extra time based on your current score gaps and category performance.`,
    launchConfig: { ...task.launchConfig, ...commonLaunchConfig },
  };
  if (!includeWarmup || !trainer) return [practice];
  const warmup = skillTrainerTask(
    trainer,
    category,
    input.today,
    input.sortOrder,
  );
  return [
    {
      ...warmup,
      rationale:
        "Use this quick warm-up, then spend the rest of the block on targeted questions.",
      launchConfig: { ...warmup.launchConfig, ...commonLaunchConfig },
    },
    practice,
  ];
}

export function generateStudyPlan(
  input: GenerateStudyPlanInput,
): StudyPlanGenerationResult {
  parseIsoDate(input.today);
  parseIsoDate(input.planningDate);
  const endsOn =
    input.planningDate < input.today ? input.today : input.planningDate;
  const dates = selectedDates(input.today, endsOn, input.profile.availableDays);
  const daysRemainingAtStart = Math.max(1, daysBetween(input.today, endsOn));
  const risk = capacityRisk(input.profile, input.signals, daysRemainingAtStart);
  const sectionTargets = allocateSectionTargets(
    input.profile.targetScore,
    input.sections
      .filter((section) => section.sectionNumber <= 3)
      .map((section) => ({
        sectionId: section.id,
        currentEstimate:
          input.signals.find((signal) => signal.sectionId === section.id)
            ?.currentEstimate ?? null,
      })),
  );
  const signals = new Map(
    input.signals.map((signal) => [signal.sectionId, signal]),
  );
  const cognitiveSections = input.sections.filter(
    (section) => section.sectionNumber <= 3,
  );
  const cognitiveByPriority = sectionPriority(
    cognitiveSections,
    input.signals,
    sectionTargets,
  );
  const weightedCognitiveSections = cognitiveByPriority.flatMap(
    (section, index) =>
      Array.from(
        { length: Math.max(1, cognitiveByPriority.length - index) },
        () => section,
      ),
  );
  const sjtSection =
    input.sections.find((section) => section.sectionNumber === 4) ?? null;
  const benchmarked = new Set(
    input.signals
      .filter((signal) => signal.completedFullSets > 0)
      .map((signal) => signal.sectionId),
  );
  const scheduledBenchmarks = new Set<string>();
  const moduleQueue = input.learningModules
    .filter((module) => module.completionPercent < 100)
    .sort((a, b) => {
      const rank = { essential: 0, recommended: 1, optional: 2 };
      return (
        rank[a.priority] - rank[b.priority] ||
        b.relevanceScore - a.relevanceScore ||
        a.completionPercent - b.completionPercent
      );
    });
  let moduleCursor = 0;
  let sectionCursor = 0;
  let practiceDays = 0;
  let mockCount = input.completedMockCount;
  let lastMockDate: string | null = null;
  let trainerCursor = 0;
  const categoryScheduleCounts = new Map<string, number>();
  const pendingReviewSources: GeneratedStudyPlanTask[] = [];
  const tasks: GeneratedStudyPlanTask[] = [];

  dates.forEach((day, dayIndex) => {
    const daysRemaining = Math.max(0, daysBetween(day.date, endsOn));
    const phase = phaseFor(daysRemaining);
    const usableMinutes = Math.max(
      15,
      Math.round((day.maxMinutes * workloadFraction(phase)) / 5) * 5,
    );
    let remaining = Math.min(
      day.maxMinutes,
      phase === "foundation" ? Math.min(45, usableMinutes) : usableMinutes,
    );
    let sortOrder = 0;

    while (pendingReviewSources.length) {
      const review = reviewTask(pendingReviewSources[0], day.date, sortOrder);
      if (review.estimatedMinutes > remaining) break;
      pendingReviewSources.shift();
      tasks.push(review);
      sortOrder += 1;
      remaining -= review.estimatedMinutes;
    }

    const shouldLearn =
      moduleCursor < moduleQueue.length &&
      (phase === "foundation" ||
        (phase === "development" && dayIndex % 2 === 0) ||
        moduleQueue[moduleCursor]?.priority === "essential");
    if (shouldLearn) {
      const learningModule = moduleQueue[moduleCursor++];
      const minutes = Math.min(
        remaining,
        Math.max(5, learningModule.estimatedMinutes),
      );
      tasks.push({
        scheduledDate: day.date,
        sortOrder: sortOrder++,
        taskType: "learn",
        title: learningModule.title,
        description:
          learningModule.completionPercent > 0
            ? "Continue this learning module."
            : "Complete this learning module.",
        rationale:
          learningModule.priority === "essential"
            ? "This is essential groundwork for the practice ahead."
            : "Learn the method before increasing question volume.",
        estimatedMinutes: minutes,
        targetUnits: null,
        sectionId: learningModule.sectionId,
        questionStemCategoryId: null,
        questionTagId: null,
        learningModuleId: learningModule.id,
        questionSetId: null,
        mockId: null,
        skillTrainerId: null,
        launchPath:
          learningModule.sectionNumber != null
            ? `/learn/sections/${learningModule.sectionNumber}/${learningModule.id}`
            : `/learn/${learningModule.id}`,
        launchConfig: {
          kind: "learning_module",
          learningModuleId: learningModule.id,
        },
      });
      remaining -= minutes;
    }

    const allBenchmarksReady = cognitiveSections.every((section) =>
      benchmarked.has(section.id),
    );
    const isPreferredMockDay =
      weekday(day.date) === input.profile.preferredMockWeekday;
    const mockIntervalDays = daysRemaining <= 28 ? 7 : 14;
    const canScheduleMock =
      phase !== "foundation" &&
      allBenchmarksReady &&
      isPreferredMockDay &&
      (lastMockDate == null ||
        daysBetween(lastMockDate, day.date) >= mockIntervalDays) &&
      remaining >= 110;

    if (canScheduleMock) {
      mockCount += 1;
      lastMockDate = day.date;
      const mockTask: GeneratedStudyPlanTask = {
        scheduledDate: day.date,
        sortOrder: sortOrder++,
        taskType: "mock",
        title: `Full mock ${mockCount}`,
        description:
          "Complete a full mock under uninterrupted exam conditions.",
        rationale:
          "Your full-section evidence is ready; this mock will recalibrate the plan.",
        estimatedMinutes: Math.min(remaining, 125),
        targetUnits: input.sections.reduce(
          (total, section) => total + section.questionCount,
          0,
        ),
        sectionId: null,
        questionStemCategoryId: null,
        questionTagId: null,
        learningModuleId: null,
        questionSetId: null,
        mockId: null,
        skillTrainerId: null,
        launchPath: "/mocks",
        launchConfig: { kind: "mock" },
      };
      tasks.push(mockTask);
      remaining -= mockTask.estimatedMinutes;
      const mockReview = reviewTask(mockTask, day.date, sortOrder);
      if (remaining >= mockReview.estimatedMinutes) {
        tasks.push(mockReview);
        sortOrder += 1;
      } else {
        pendingReviewSources.push(mockTask);
      }
      return;
    }

    const benchmarkCandidate = cognitiveSections.find(
      (section) =>
        !benchmarked.has(section.id) && !scheduledBenchmarks.has(section.id),
    );
    const readyForBenchmark =
      benchmarkCandidate &&
      (input.completedMockCount > 0 ||
        practiceDays >= Math.max(3, cognitiveSections.length));
    if (readyForBenchmark && remaining >= 25 && dayIndex % 2 === 0) {
      const speed =
        phase === "foundation" ? 0.75 : phase === "development" ? 0.9 : 1;
      const benchmark = benchmarkTask(
        benchmarkCandidate,
        day.date,
        sortOrder++,
        speed,
      );
      if (benchmark.estimatedMinutes <= remaining) {
        const benchmarkCategory = pickCategory(
          benchmarkCandidate.id,
          input.categories,
          categoryScheduleCounts,
        );
        const trainer = pickSkillTrainer(
          benchmarkCandidate.id,
          benchmarkCategory?.id ?? null,
          input.skillTrainers,
          trainerCursor++,
        );
        const benchmarkReviewMinutes = reviewTask(
          benchmark,
          day.date,
          sortOrder,
        ).estimatedMinutes;
        if (
          trainer &&
          remaining >=
            benchmark.estimatedMinutes +
              trainer.estimatedMinutes +
              benchmarkReviewMinutes
        ) {
          tasks.push(
            skillTrainerTask(
              trainer,
              benchmarkCategory,
              day.date,
              benchmark.sortOrder,
            ),
          );
          benchmark.sortOrder = sortOrder++;
          remaining -= trainer.estimatedMinutes;
        }
        tasks.push(benchmark);
        remaining -= benchmark.estimatedMinutes;
        const benchmarkReview = reviewTask(benchmark, day.date, sortOrder);
        if (remaining >= benchmarkReview.estimatedMinutes) {
          tasks.push(benchmarkReview);
          sortOrder += 1;
        } else {
          pendingReviewSources.push(benchmark);
        }
        scheduledBenchmarks.add(benchmarkCandidate.id);
        return;
      }
    }

    if (remaining >= 10 && weightedCognitiveSections.length) {
      const section =
        weightedCognitiveSections[
          sectionCursor++ % weightedCognitiveSections.length
        ];
      const category = pickCategory(
        section.id,
        input.categories,
        categoryScheduleCounts,
      );
      const trainer = pickSkillTrainer(
        section.id,
        category?.id ?? null,
        input.skillTrainers,
        trainerCursor++,
      );
      const sjtCategory = sjtSection
        ? pickCategory(
            sjtSection.id,
            input.categories,
            new Map(categoryScheduleCounts),
          )
        : null;
      const includeSjt = Boolean(
        sjtSection &&
          sjtCategory &&
          phase !== "foundation" &&
          (practiceDays + 1) % 4 === 0 &&
          remaining >= 55,
      );
      const warmupMinutes =
        trainer && remaining >= 30 ? trainer.estimatedMinutes : 0;
      const sjtReserve = includeSjt ? 15 : 0;
      const provisionalPractice = practiceTask(
        section,
        signals.get(section.id),
        category,
        phase,
        Math.max(10, remaining - warmupMinutes - sjtReserve),
        day.date,
        sortOrder,
      );
      const reviewMinutes = reviewTask(
        provisionalPractice,
        day.date,
        sortOrder + 1,
      ).estimatedMinutes;
      const practiceBudget =
        remaining - warmupMinutes - reviewMinutes - sjtReserve;

      if (trainer && warmupMinutes > 0) {
        tasks.push(skillTrainerTask(trainer, category, day.date, sortOrder++));
        remaining -= warmupMinutes;
      }
      const practice = practiceTask(
        section,
        signals.get(section.id),
        category,
        phase,
        Math.max(10, practiceBudget),
        day.date,
        sortOrder++,
      );
      tasks.push(practice);
      remaining -= practice.estimatedMinutes;
      if (reviewMinutes > 0 && remaining >= reviewMinutes) {
        tasks.push(reviewTask(practice, day.date, sortOrder++));
        remaining -= reviewMinutes;
      } else {
        pendingReviewSources.push(practice);
      }

      if (includeSjt && sjtSection && sjtCategory && remaining >= 10) {
        categoryScheduleCounts.set(
          sjtCategory.id,
          (categoryScheduleCounts.get(sjtCategory.id) ?? 0) + 1,
        );
        const sjtPractice = practiceTask(
          sjtSection,
          signals.get(sjtSection.id),
          sjtCategory,
          phase,
          Math.min(10, remaining),
          day.date,
          sortOrder++,
          true,
        );
        tasks.push(sjtPractice);
        remaining -= sjtPractice.estimatedMinutes;
        const sjtReview = reviewTask(sjtPractice, day.date, sortOrder);
        if (remaining >= sjtReview.estimatedMinutes) {
          tasks.push(sjtReview);
          sortOrder += 1;
        } else {
          pendingReviewSources.push(sjtPractice);
        }
      }
      practiceDays += 1;
    }
  });

  return { tasks, capacityRisk: risk, sectionTargets, endsOn };
}
