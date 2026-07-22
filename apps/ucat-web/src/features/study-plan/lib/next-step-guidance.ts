import { daysBetween } from "@/features/study-plan/lib/dates";
import type {
  StudyGuidanceItem,
  StudyPlanCategorySignal,
  StudyPlanLearningModule,
  StudyPlanPhase,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
} from "@/features/study-plan/model/types";

export type IncompleteAttemptReview = {
  attemptType: NonNullable<StudyGuidanceItem["sourceAttemptType"]>;
  attemptId: string;
  attemptLabel: string;
};

export type LatestGuidanceActivity = {
  kind: string;
  id: string;
  completedAt: string;
};

export function resolveGuidanceTrigger(input: {
  today: string;
  currentTrigger: string | null;
  currentCreatedAt: string | null;
  currentGeneratedOn: string | null;
  latestActivity: LatestGuidanceActivity | null;
}): string | null {
  if (input.currentGeneratedOn !== input.today) return `daily:${input.today}`;
  if (!input.latestActivity) return input.currentTrigger;

  const activityTrigger = `activity:${input.latestActivity.kind}:${input.latestActivity.id}:${input.latestActivity.completedAt}`;
  if (
    activityTrigger !== input.currentTrigger &&
    (!input.currentCreatedAt ||
      input.latestActivity.completedAt > input.currentCreatedAt)
  ) {
    return activityTrigger;
  }
  return input.currentTrigger;
}

export function formatAttemptReviewLabel(input: {
  attemptType: IncompleteAttemptReview["attemptType"];
  name?: string | null;
  sectionKey?: string | null;
  wasTimed?: boolean | null;
}): string {
  if (input.name?.trim()) return input.name.trim();
  if (input.attemptType === "mock_attempt") return "your UCAT mock";
  if (input.attemptType === "set_attempt") {
    return `your ${input.wasTimed ? "timed" : "untimed"} question set`;
  }
  const sectionNames: Record<string, string> = {
    verbal_reasoning: "Verbal Reasoning",
    decision_making: "Decision Making",
    quantitative_reasoning: "Quantitative Reasoning",
    situational_judgement: "Situational Judgement",
  };
  const sectionName =
    (input.sectionKey && sectionNames[input.sectionKey]) || "UCAT";
  return `${sectionName} ${input.wasTimed ? "timed" : "untimed"} practice`;
}

export type NextStepDraft = Omit<
  StudyGuidanceItem,
  "id" | "position" | "triggerKey" | "generatedOn"
>;

export type BuildNextStepsInput = {
  today: string;
  planningDate: string;
  dailyWarmup: boolean;
  incompleteReview: IncompleteAttemptReview | null;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  trainerAttemptCounts: Map<string, number>;
  completedMockCount: number;
};

function phaseFor(daysRemaining: number): StudyPlanPhase {
  if (daysRemaining <= 14) return "taper";
  if (daysRemaining <= 60) return "performance";
  if (daysRemaining <= 150) return "development";
  return "foundation";
}

function baseDraft(
  input: Partial<NextStepDraft> &
    Pick<
      NextStepDraft,
      | "taskType"
      | "title"
      | "description"
      | "rationale"
      | "estimatedMinutes"
      | "launchPath"
    >,
): NextStepDraft {
  return {
    sectionId: null,
    questionStemCategoryId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    sourceAttemptType: null,
    sourceAttemptId: null,
    launchConfig: {},
    ...input,
  };
}

function reviewPath(review: IncompleteAttemptReview): string {
  if (review.attemptType === "practice_session")
    return `/progress/practice-sessions/${review.attemptId}`;
  if (review.attemptType === "set_attempt")
    return `/progress/set-attempts/${review.attemptId}`;
  return `/progress/mocks/mock-attempts/${review.attemptId}`;
}

function trainerDraft(
  trainer: StudyPlanSkillTrainer,
  rationale: string,
): NextStepDraft {
  return baseDraft({
    taskType: "skill_trainer",
    title: `Warm up with ${trainer.name}`,
    description:
      "A short warm-up to get your thinking moving before longer practice.",
    rationale,
    estimatedMinutes: trainer.estimatedMinutes,
    sectionId: trainer.sectionId,
    skillTrainerId: trainer.id,
    launchPath: `/skill-trainer/${trainer.key.replaceAll("_", "-")}/play`,
    launchConfig: { skillTrainerKey: trainer.key },
  });
}

function learningDraft(module: StudyPlanLearningModule): NextStepDraft {
  return baseDraft({
    taskType: "learn",
    title: module.title,
    description: "Build the method before adding more timed pressure.",
    rationale:
      module.relevanceScore > 0.5
        ? "This lesson is linked to a broad area where your reliable evidence shows room to improve."
        : "A focused lesson is the best next step at this stage of your preparation.",
    estimatedMinutes: module.estimatedMinutes,
    sectionId: module.sectionId,
    learningModuleId: module.id,
    launchPath:
      module.sectionNumber != null
        ? `/learn/sections/${module.sectionNumber}/${module.id}`
        : `/learn/${module.id}`,
  });
}

function targetedPracticeDraft(
  category: StudyPlanCategorySignal,
  section: StudyPlanSection,
  phase: StudyPlanPhase,
): NextStepDraft {
  const timed = phase === "performance" || phase === "taper";
  const questionCount = timed ? 20 : 10;
  return baseDraft({
    taskType: "practice",
    title: `Practice ${category.name}`,
    description: `${questionCount} ${timed ? "timed" : "focused"} questions in ${section.shortName}.`,
    rationale:
      category.maxScore >= 4
        ? "Your accumulated category evidence makes this a useful area to revisit."
        : "This gives Altitutor broader evidence before treating a narrow result as a real weakness.",
    estimatedMinutes: Math.max(
      10,
      Math.ceil((questionCount * section.timePerQuestionSeconds) / 60),
    ),
    sectionId: section.id,
    questionStemCategoryId: category.id,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      section: section.key,
      ucatSectionId: section.id,
      categoryIds: [category.id],
      questionCount,
      timeMode: timed ? "speed" : "off",
      timeSpeedMultiplier: 1,
      timePerQuestionSeconds: section.timePerQuestionSeconds,
      reviewTiming: timed ? "atEnd" : "afterEachStem",
    },
  });
}

function benchmarkDraft(section: StudyPlanSection): NextStepDraft {
  return baseDraft({
    taskType: "section_benchmark",
    title: `Complete a timed ${section.shortName} set`,
    description: "Practice sustaining your method across an exam-like section.",
    rationale:
      "Your test is getting closer, so longer timed work now has more value.",
    estimatedMinutes: Math.max(
      15,
      Math.ceil((section.questionCount * section.timePerQuestionSeconds) / 60),
    ),
    sectionId: section.id,
    launchPath: `/sets/sections/${section.sectionNumber}`,
  });
}

function mockDraft(phase: StudyPlanPhase): NextStepDraft {
  return baseDraft({
    taskType: "mock",
    title: "Complete a UCAT mock",
    description: "Bring the sections together under full exam conditions.",
    rationale:
      phase === "performance" || phase === "taper"
        ? "Your test is close enough for full-exam pacing and stamina to be a priority."
        : "A full mock is a useful contrast when you want a broad baseline rather than another narrow activity.",
    estimatedMinutes: 120,
    launchPath: "/mocks",
  });
}

type GuidanceIdentity = Pick<NextStepDraft, "taskType" | "launchPath"> &
  Partial<
    Pick<
      NextStepDraft,
      | "learningModuleId"
      | "questionStemCategoryId"
      | "mockId"
      | "skillTrainerId"
      | "sourceAttemptId"
      | "sectionId"
    >
  >;

export function guidanceItemKey(item: GuidanceIdentity): string {
  if (item.sourceAttemptId)
    return `review:${item.sourceAttemptId}:${item.launchPath}`;
  if (item.learningModuleId) return `learn:${item.learningModuleId}`;
  if (item.questionStemCategoryId)
    return `practice:${item.questionStemCategoryId}`;
  if (item.skillTrainerId) return `skill-trainer:${item.skillTrainerId}`;
  if (item.taskType === "section_benchmark")
    return `timed-set:${item.sectionId ?? item.launchPath}`;
  if (item.mockId) return `mock:${item.mockId}`;
  return `${item.taskType}:${item.launchPath}`;
}

type GuidanceFamily = "focused" | "simulation" | "skill" | "review";

function guidanceFamily(taskType: NextStepDraft["taskType"]): GuidanceFamily {
  if (taskType === "learn" || taskType === "practice") return "focused";
  if (taskType === "section_benchmark" || taskType === "mock")
    return "simulation";
  if (taskType === "skill_trainer") return "skill";
  return "review";
}

function buildNextStepCandidates(input: BuildNextStepsInput): NextStepDraft[] {
  const drafts: NextStepDraft[] = [];
  if (input.incompleteReview) {
    drafts.push(
      baseDraft({
        taskType: "review",
        title: `Review ${input.incompleteReview.attemptLabel}`,
        description: `Review the incorrect questions from ${input.incompleteReview.attemptLabel}.`,
        rationale:
          "Review turns the result you just received into useful feedback for what comes next.",
        estimatedMinutes: 10,
        sourceAttemptType: input.incompleteReview.attemptType,
        sourceAttemptId: input.incompleteReview.attemptId,
        launchPath: reviewPath(input.incompleteReview),
      }),
    );
  }

  const sortedTrainers = [...input.skillTrainers].sort(
    (a, b) =>
      (input.trainerAttemptCounts.get(a.id) ?? 0) -
        (input.trainerAttemptCounts.get(b.id) ?? 0) ||
      a.name.localeCompare(b.name),
  );
  const trainer = sortedTrainers[0] ?? null;
  if (input.dailyWarmup && !input.incompleteReview && trainer) {
    drafts.push(
      trainerDraft(
        trainer,
        "This is the Skill trainer you have played least, so it keeps your warm-up varied.",
      ),
    );
  }

  const daysRemaining = Math.max(
    0,
    daysBetween(input.today, input.planningDate),
  );
  const phase = phaseFor(daysRemaining);
  const signalBySection = new Map(
    input.signals.map((signal) => [signal.sectionId, signal]),
  );
  const sortedSections = [...input.sections].sort((a, b) => {
    const aSignal = signalBySection.get(a.id);
    const bSignal = signalBySection.get(b.id);
    return (
      (aSignal?.currentEstimate ?? 500) - (bSignal?.currentEstimate ?? 500) ||
      (aSignal?.evidenceCount ?? 0) - (bSignal?.evidenceCount ?? 0)
    );
  });
  const weakestSection = sortedSections[0];
  const reliableCategories = input.categories.filter(
    (category) => category.maxScore >= 4,
  );
  const sortedCategories = [
    ...(reliableCategories.length ? reliableCategories : input.categories),
  ].sort(
    (a, b) => b.weaknessScore - a.weaknessScore || b.maxScore - a.maxScore,
  );
  const weakestCategory = sortedCategories[0];
  const categorySection = weakestCategory
    ? input.sections.find((section) => section.id === weakestCategory.sectionId)
    : null;
  const sortedLearningModules = [...input.learningModules]
    .filter((item) => item.completionPercent < 100)
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        (a.priority === "essential" ? -1 : 0) -
          (b.priority === "essential" ? -1 : 0) ||
        a.completionPercent - b.completionPercent,
    );
  const learningModule = sortedLearningModules[0];

  if ((phase === "foundation" || phase === "development") && learningModule) {
    drafts.push(learningDraft(learningModule));
  }
  if (
    (phase === "foundation" || phase === "development") &&
    weakestCategory &&
    categorySection
  ) {
    drafts.push(targetedPracticeDraft(weakestCategory, categorySection, phase));
  }
  if ((phase === "performance" || phase === "taper") && weakestSection) {
    drafts.push(benchmarkDraft(weakestSection));
  }
  if (
    phase === "taper" ||
    (phase === "performance" && input.completedMockCount === 0)
  ) {
    drafts.push(mockDraft(phase));
  }
  if (
    (phase === "performance" || phase === "taper") &&
    weakestCategory &&
    categorySection
  ) {
    drafts.push(targetedPracticeDraft(weakestCategory, categorySection, phase));
  }
  if (trainer) {
    drafts.push(
      trainerDraft(
        trainer,
        "A short skill round keeps your practice varied and gives Altitutor another useful signal.",
      ),
    );
  }
  if (
    learningModule &&
    !drafts.some((draft) => draft.learningModuleId === learningModule.id)
  ) {
    drafts.push(learningDraft(learningModule));
  }
  if (weakestSection) drafts.push(benchmarkDraft(weakestSection));

  for (const learningModuleItem of sortedLearningModules)
    drafts.push(learningDraft(learningModuleItem));
  for (const category of sortedCategories) {
    const section = input.sections.find(
      (item) => item.id === category.sectionId,
    );
    if (section) drafts.push(targetedPracticeDraft(category, section, phase));
  }
  for (const item of sortedTrainers) {
    drafts.push(
      trainerDraft(
        item,
        "A short skill round keeps your practice varied and gives Altitutor another useful signal.",
      ),
    );
  }
  for (const section of sortedSections) drafts.push(benchmarkDraft(section));
  drafts.push(mockDraft(phase));

  const unique = drafts.filter(
    (draft, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.taskType === draft.taskType &&
          candidate.launchPath === draft.launchPath &&
          candidate.learningModuleId === draft.learningModuleId &&
          candidate.questionStemCategoryId === draft.questionStemCategoryId &&
          candidate.skillTrainerId === draft.skillTrainerId &&
          candidate.sourceAttemptId === draft.sourceAttemptId,
      ) === index,
  );
  const fallbacks = [
    baseDraft({
      taskType: "practice",
      title: "Build a focused practice session",
      description:
        "Choose the section and question types that would help you most today.",
      rationale:
        "A short practice session creates useful evidence for a more tailored next step.",
      estimatedMinutes: 15,
      launchPath: "/practice",
    }),
    baseDraft({
      taskType: "learn",
      title: "Choose a learning module",
      description: "Strengthen a method before your next practice session.",
      rationale:
        "A short lesson is a useful alternative when you are not ready for more questions.",
      estimatedMinutes: 10,
      launchPath: "/learn",
    }),
  ];
  for (const fallback of fallbacks) {
    if (unique.length >= 2) break;
    if (!unique.some((draft) => draft.launchPath === fallback.launchPath))
      unique.push(fallback);
  }
  return unique;
}

export function buildNextStepDrafts(
  input: BuildNextStepsInput,
): NextStepDraft[] {
  return buildNextStepCandidates(input).slice(0, 2);
}

export function buildAlternativeNextStep(
  input: BuildNextStepsInput,
  options: {
    excludedKeys: string[];
    currentTaskTypes: NextStepDraft["taskType"][];
  },
): NextStepDraft | null {
  const excluded = new Set(options.excludedKeys);
  const currentFamilies = new Set(options.currentTaskTypes.map(guidanceFamily));
  const currentTypes = new Set(options.currentTaskTypes);
  const candidates = buildNextStepCandidates(input)
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => !excluded.has(guidanceItemKey(candidate)));
  if (!candidates.length) return null;

  const preferredFamily: GuidanceFamily | null = currentFamilies.has("focused")
    ? !currentFamilies.has("simulation")
      ? "simulation"
      : !currentFamilies.has("skill")
        ? "skill"
        : null
    : currentFamilies.has("simulation")
      ? "focused"
      : "focused";

  candidates.sort((left, right) => {
    const leftFamily = guidanceFamily(left.candidate.taskType);
    const rightFamily = guidanceFamily(right.candidate.taskType);
    const leftFamilyRank =
      leftFamily === preferredFamily
        ? 0
        : currentFamilies.has(leftFamily)
          ? 2
          : 1;
    const rightFamilyRank =
      rightFamily === preferredFamily
        ? 0
        : currentFamilies.has(rightFamily)
          ? 2
          : 1;
    return (
      leftFamilyRank - rightFamilyRank ||
      Number(currentTypes.has(left.candidate.taskType)) -
        Number(currentTypes.has(right.candidate.taskType)) ||
      left.index - right.index
    );
  });
  return candidates[0]?.candidate ?? null;
}
