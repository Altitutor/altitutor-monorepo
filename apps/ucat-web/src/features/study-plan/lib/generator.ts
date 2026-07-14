import {
  addDays,
  daysBetween,
  parseIsoDate,
  weekday,
} from "@/features/study-plan/lib/dates";
import type {
  GeneratedStudyPlanTask,
  StudyPlanAvailability,
  StudyPlanCapacityRisk,
  StudyPlanGenerationResult,
  StudyPlanLearningModule,
  StudyPlanPhase,
  StudyPlanProfileInput,
  StudyPlanSection,
  StudyPlanSectionSignal,
} from "@/features/study-plan/model/types";

type GenerateStudyPlanInput = {
  today: string;
  planningDate: string;
  profile: StudyPlanProfileInput;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  learningModules: StudyPlanLearningModule[];
  completedMockCount: number;
};

type DatedAvailability = StudyPlanAvailability & { date: string };

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

function practiceSpeed(phase: StudyPlanPhase, evidenceCount: number): number | null {
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
  const urgency = daysRemaining < 90 ? 1 + (90 - Math.max(7, daysRemaining)) / 90 : 1;
  return Math.round(Math.min(720, Math.max(75, (90 + scoreGap * 0.35) * urgency)) / 15) * 15;
}

function capacityRisk(
  profile: StudyPlanProfileInput,
  signals: StudyPlanSectionSignal[],
  daysRemaining: number,
): StudyPlanCapacityRisk {
  const available = profile.availableDays.reduce((sum, day) => sum + day.maxMinutes, 0);
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

function allocateSectionTargets(
  targetScore: number,
  sections: StudyPlanSection[],
  signals: StudyPlanSectionSignal[],
): Record<string, number> {
  const cognitive = sections.slice(0, COGNITIVE_SECTION_COUNT);
  const signalMap = new Map(signals.map((signal) => [signal.sectionId, signal]));
  const known = cognitive
    .map((section) => signalMap.get(section.id)?.currentEstimate ?? null)
    .filter((value): value is number => value != null);
  const mean = known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : 600;
  const raw = cognitive.map((section) => {
    const estimate = signalMap.get(section.id)?.currentEstimate ?? mean;
    return targetScore / COGNITIVE_SECTION_COUNT + (estimate - mean) * 0.25;
  });
  const rounded = raw.map((value) => Math.max(300, Math.min(900, Math.round(value / 10) * 10)));
  let difference = targetScore - rounded.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (difference !== 0 && cursor < 200) {
    const index = cursor % rounded.length;
    const step = difference > 0 ? 10 : -10;
    if (rounded[index] + step >= 300 && rounded[index] + step <= 900) {
      rounded[index] += step;
      difference -= step;
    }
    cursor += 1;
  }
  return Object.fromEntries(cognitive.map((section, index) => [section.id, rounded[index]]));
}

function sectionPriority(
  sections: StudyPlanSection[],
  signals: StudyPlanSectionSignal[],
  sectionTargets: Record<string, number>,
): StudyPlanSection[] {
  const signalMap = new Map(signals.map((signal) => [signal.sectionId, signal]));
  return [...sections].sort((a, b) => {
    const aSignal = signalMap.get(a.id);
    const bSignal = signalMap.get(b.id);
    const aGap = a.sectionNumber <= 3
      ? (sectionTargets[a.id] ?? 600) - (aSignal?.currentEstimate ?? 520)
      : 50 - (aSignal?.evidenceCount ?? 0) * 5;
    const bGap = b.sectionNumber <= 3
      ? (sectionTargets[b.id] ?? 600) - (bSignal?.currentEstimate ?? 520)
      : 50 - (bSignal?.evidenceCount ?? 0) * 5;
    return bGap - aGap || a.sectionNumber - b.sectionNumber;
  });
}

function practiceTask(
  section: StudyPlanSection,
  signal: StudyPlanSectionSignal | undefined,
  phase: StudyPlanPhase,
  budgetMinutes: number,
  scheduledDate: string,
  sortOrder: number,
): GeneratedStudyPlanTask {
  const speed = practiceSpeed(phase, signal?.evidenceCount ?? 0);
  const timed = speed != null;
  const secondsPerQuestion = timed
    ? Math.round(section.timePerQuestionSeconds / speed)
    : null;
  const questionCount = Math.max(
    5,
    Math.min(30, Math.floor((budgetMinutes * 60) / (secondsPerQuestion ?? 120))),
  );
  const timingLabel = timed ? `${speed}x exam speed` : "untimed";
  return {
    scheduledDate,
    sortOrder,
    taskType: "practice",
    title: `${section.shortName} practice · ${timingLabel}`,
    description: `${questionCount} questions with ${phase === "foundation" ? "feedback after each stem" : "feedback at the end"}.`,
    rationale: signal?.currentEstimate == null
      ? `Build a reliable baseline in ${section.name}.`
      : `Prioritised from your current ${section.name} score trajectory.`,
    estimatedMinutes: Math.max(10, Math.min(budgetMinutes, Math.ceil(questionCount * (secondsPerQuestion ?? 120) / 60) + 5)),
    targetUnits: questionCount,
    sectionId: section.id,
    learningModuleId: null,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      section: section.key,
      ucatSectionId: section.id,
      questionCount,
      categoryIds: [],
      timeMode: timed ? "speed" : "off",
      timeSpeedMultiplier: speed ?? 1,
      timePerQuestionSeconds: secondsPerQuestion,
      reviewTiming: phase === "foundation" ? "afterEachStem" : "atEnd",
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
    estimatedMinutes: Math.max(20, Math.ceil(section.questionCount * section.timePerQuestionSeconds / speed / 60) + 5),
    targetUnits: section.questionCount,
    sectionId: section.id,
    learningModuleId: null,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      section: section.key,
      ucatSectionId: section.id,
      questionCount: section.questionCount,
      categoryIds: [],
      timeMode: "speed",
      timeSpeedMultiplier: speed,
      timePerQuestionSeconds: Math.round(section.timePerQuestionSeconds / speed),
      reviewTiming: "atEnd",
      benchmark: true,
    },
  };
}

export function generateStudyPlan(input: GenerateStudyPlanInput): StudyPlanGenerationResult {
  parseIsoDate(input.today);
  parseIsoDate(input.planningDate);
  const endsOn = input.planningDate < input.today ? input.today : input.planningDate;
  const dates = selectedDates(input.today, endsOn, input.profile.availableDays);
  const daysRemainingAtStart = Math.max(1, daysBetween(input.today, endsOn));
  const risk = capacityRisk(input.profile, input.signals, daysRemainingAtStart);
  const sectionTargets = allocateSectionTargets(
    input.profile.targetScore,
    input.sections,
    input.signals,
  );
  const signals = new Map(input.signals.map((signal) => [signal.sectionId, signal]));
  const sectionsByPriority = sectionPriority(input.sections, input.signals, sectionTargets);
  const cognitiveSections = input.sections.filter((section) => section.sectionNumber <= 3);
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
      return rank[a.priority] - rank[b.priority]
        || b.relevanceScore - a.relevanceScore
        || a.completionPercent - b.completionPercent;
    });
  let moduleCursor = 0;
  let sectionCursor = 0;
  let practiceDays = 0;
  let mockCount = input.completedMockCount;
  let lastMockDate: string | null = null;
  const tasks: GeneratedStudyPlanTask[] = [];

  dates.forEach((day, dayIndex) => {
    const daysRemaining = Math.max(0, daysBetween(day.date, endsOn));
    const phase = phaseFor(daysRemaining);
    const usableMinutes = Math.max(15, Math.round(day.maxMinutes * workloadFraction(phase) / 5) * 5);
    let remaining = Math.min(day.maxMinutes, phase === "foundation" ? Math.min(45, usableMinutes) : usableMinutes);
    let sortOrder = 0;

    const shouldLearn = moduleCursor < moduleQueue.length && (
      phase === "foundation" ||
      (phase === "development" && dayIndex % 2 === 0) ||
      moduleQueue[moduleCursor]?.priority === "essential"
    );
    if (shouldLearn) {
      const learningModule = moduleQueue[moduleCursor++];
      const minutes = Math.min(remaining, Math.max(5, learningModule.estimatedMinutes));
      tasks.push({
        scheduledDate: day.date,
        sortOrder: sortOrder++,
        taskType: "learn",
        title: learningModule.title,
        description: learningModule.completionPercent > 0 ? "Continue this learning module." : "Complete this learning module.",
        rationale: learningModule.priority === "essential"
          ? "This is essential groundwork for the practice ahead."
          : "Learn the method before increasing question volume.",
        estimatedMinutes: minutes,
        targetUnits: null,
        sectionId: learningModule.sectionId,
        learningModuleId: learningModule.id,
        launchPath: `/learn/${learningModule.id}`,
        launchConfig: { kind: "learning_module", learningModuleId: learningModule.id },
      });
      remaining -= minutes;
    }

    const allBenchmarksReady = cognitiveSections.every(
      (section) => benchmarked.has(section.id) || scheduledBenchmarks.has(section.id),
    );
    const isPreferredMockDay = weekday(day.date) === input.profile.preferredMockWeekday;
    const mockIntervalDays = daysRemaining <= 28 ? 7 : 14;
    const canScheduleMock =
      phase !== "foundation" &&
      allBenchmarksReady &&
      isPreferredMockDay &&
      (lastMockDate == null || daysBetween(lastMockDate, day.date) >= mockIntervalDays) &&
      remaining >= 110;

    if (canScheduleMock) {
      mockCount += 1;
      lastMockDate = day.date;
      tasks.push({
        scheduledDate: day.date,
        sortOrder: sortOrder++,
        taskType: "mock",
        title: `Full mock ${mockCount}`,
        description: "Complete a full mock under uninterrupted exam conditions.",
        rationale: "Your full-section evidence is ready; this mock will recalibrate the plan.",
        estimatedMinutes: Math.min(day.maxMinutes, 125),
        targetUnits: null,
        sectionId: null,
        learningModuleId: null,
        launchPath: "/mocks",
        launchConfig: { kind: "mock" },
      });
      return;
    }

    const benchmarkCandidate = cognitiveSections.find(
      (section) => !benchmarked.has(section.id) && !scheduledBenchmarks.has(section.id),
    );
    const readyForBenchmark =
      benchmarkCandidate &&
      (input.completedMockCount > 0 || practiceDays >= Math.max(3, cognitiveSections.length));
    if (readyForBenchmark && remaining >= 25 && dayIndex % 2 === 0) {
      const speed = phase === "foundation" ? 0.75 : phase === "development" ? 0.9 : 1;
      const benchmark = benchmarkTask(
        benchmarkCandidate,
        day.date,
        sortOrder++,
        speed,
      );
      if (benchmark.estimatedMinutes <= day.maxMinutes) {
        tasks.push(benchmark);
        scheduledBenchmarks.add(benchmarkCandidate.id);
        return;
      }
    }

    if (remaining >= 10) {
      const section = sectionsByPriority[sectionCursor++ % sectionsByPriority.length];
      tasks.push(
        practiceTask(
          section,
          signals.get(section.id),
          phase,
          remaining,
          day.date,
          sortOrder++,
        ),
      );
      practiceDays += 1;
    }
  });

  return { tasks, capacityRisk: risk, sectionTargets, endsOn };
}
