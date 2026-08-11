import { buildReadinessSnapshot } from "@/features/study-plan/lib/readiness";
import {
  rankActivityCandidates,
  selectActivityCandidates,
  type PreparationActivityCandidate,
  type ActivityTagSignal,
} from "@/features/preparation/lib/activity-ranking";
import { latestCompletedMockDate } from "@/features/preparation/lib/sjt-allocation-policy";
import type {
  StudyGuidanceItem,
  StudyPlanCategorySignal,
  StudyPlanLearningModule,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSjtPreference,
  StudyPlanSkillTrainer,
  StudyPlanTimingEvidenceSession,
  StudyPlanTrainingMode,
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
  targetScore?: number;
  dailyWarmup: boolean;
  incompleteReview: IncompleteAttemptReview | null;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  timingSessions?: StudyPlanTimingEvidenceSession[];
  trainerAttemptCounts: Map<string, number>;
  completedMockCount: number;
  sjtPreference?: StudyPlanSjtPreference;
  activityCandidates?: PreparationActivityCandidate[];
  tagSignals?: ActivityTagSignal[];
};

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
  mode: StudyPlanTrainingMode,
  pace: number,
): NextStepDraft {
  const timed = mode !== "learning";
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
      timeSpeedMultiplier: timed ? pace : 1,
      timePerQuestionSeconds: timed
        ? Math.round(section.timePerQuestionSeconds / pace)
        : null,
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

function mockDraft(mode: StudyPlanTrainingMode): NextStepDraft {
  return baseDraft({
    taskType: "mock",
    title: "Complete a UCAT mock",
    description: "Bring the sections together under full exam conditions.",
    rationale:
      mode === "exam"
        ? "Your test is close enough for full-exam pacing and stamina to be a priority."
        : "Rehearse the complete exam under realistic conditions.",
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

export function firstGuidanceTriggerKey(
  nextSteps:
    | readonly Pick<StudyGuidanceItem, "triggerKey">[]
    | null
    | undefined,
): string | null {
  return nextSteps?.[0]?.triggerKey ?? null;
}

function rankedCandidates(input: BuildNextStepsInput) {
  if (input.activityCandidates) return input.activityCandidates;
  const readiness = buildReadinessSnapshot(input);
  return rankActivityCandidates({
    today: input.today,
    planningDate: input.planningDate,
    targetScore: input.targetScore ?? 2100,
    readiness,
    sections: input.sections,
    signals: input.signals,
    categories: input.categories,
    learningModules: input.learningModules,
    skillTrainers: input.skillTrainers,
    tagSignals: input.tagSignals,
    trainerAttemptCounts: input.trainerAttemptCounts,
    incompleteReview: input.incompleteReview,
    completedMockCount: input.completedMockCount,
    sjtPreference: input.sjtPreference,
    lastCompletedMockDate: latestCompletedMockDate(input.timingSessions),
  });
}

function draftForCandidate(
  item: PreparationActivityCandidate,
  input: BuildNextStepsInput,
): NextStepDraft | null {
  if (item.kind === "review" && input.incompleteReview) {
    return baseDraft({
      taskType: "review",
      title: `Review ${input.incompleteReview.attemptLabel}`,
      description: `Review the incorrect questions from ${input.incompleteReview.attemptLabel}.`,
      rationale: item.studentReason,
      estimatedMinutes: item.duration.reviewMinutes,
      sourceAttemptType: input.incompleteReview.attemptType,
      sourceAttemptId: input.incompleteReview.attemptId,
      launchPath: reviewPath(input.incompleteReview),
      launchConfig: { activityCandidateId: item.id, objective: item.objective },
    });
  }
  const learningModule = item.learningModuleId
    ? input.learningModules.find((candidate) => candidate.id === item.learningModuleId)
    : null;
  if (learningModule) {
    return {
      ...learningDraft(learningModule),
      rationale: item.studentReason,
      launchConfig: { activityCandidateId: item.id, objective: item.objective },
    };
  }
  const trainer = item.skillTrainerId
    ? input.skillTrainers.find((candidate) => candidate.id === item.skillTrainerId)
    : null;
  if (trainer) {
    return {
      ...trainerDraft(trainer, item.studentReason),
      launchConfig: {
        skillTrainerKey: trainer.key,
        activityCandidateId: item.id,
        objective: item.objective,
        optional: true,
      },
    };
  }
  if (item.kind === "mock") {
    return {
      ...mockDraft("exam"),
      rationale: item.studentReason,
      launchConfig: { activityCandidateId: item.id, objective: item.objective },
    };
  }
  const section = item.sectionId
    ? input.sections.find((candidate) => candidate.id === item.sectionId)
    : null;
  if (!section) return null;
  if (item.kind === "calibration") {
    return {
      ...benchmarkDraft(section),
      rationale: item.studentReason,
      launchConfig: { activityCandidateId: item.id, objective: item.objective },
    };
  }
  const category = item.categoryIds[0]
    ? input.categories.find((candidate) => candidate.id === item.categoryIds[0])
    : null;
  if (category) {
    const readiness = buildReadinessSnapshot(input).sections.find(
      (candidate) => candidate.sectionId === section.id,
    );
    return {
      ...targetedPracticeDraft(
        category,
        section,
        readiness?.mode ?? "learning",
        readiness?.paceMultiplier ?? 0.5,
      ),
      rationale: item.studentReason,
      launchConfig: {
        kind: "practice",
        section: section.key,
        ucatSectionId: section.id,
        categoryIds: item.categoryIds,
        questionTagIds: item.questionTagIds,
        questionCount: item.dose.questionCount,
        timeMode: readiness?.mode === "learning" ? "off" : "speed",
        timeSpeedMultiplier: readiness?.paceMultiplier ?? 0.5,
        reviewTiming: readiness?.mode === "learning" ? "afterEachStem" : "atEnd",
        activityCandidateId: item.id,
        objective: item.objective,
      },
    };
  }
  return baseDraft({
    taskType: "practice",
    title: `Practice ${section.name}`,
    description: `${item.dose.questionCount ?? 10} questions across ${section.shortName}.`,
    rationale: item.studentReason,
    estimatedMinutes: item.duration.practiceMinutes + item.duration.reviewMinutes,
    sectionId: section.id,
    launchPath: "/practice",
    launchConfig: {
      kind: "practice",
      section: section.key,
      ucatSectionId: section.id,
      categoryIds: [],
      questionCount: item.dose.questionCount,
      activityCandidateId: item.id,
      objective: item.objective,
    },
  });
}

function buildNextStepCandidates(input: BuildNextStepsInput): NextStepDraft[] {
  const drafts = rankedCandidates(input)
    .map((item) => draftForCandidate(item, input))
    .filter((item): item is NextStepDraft => item != null);
  const unique = drafts.filter(
    (draft, index, all) =>
      all.findIndex((candidate) => guidanceItemKey(candidate) === guidanceItemKey(draft)) ===
      index,
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
  const selectedIds = new Set(
    selectActivityCandidates(rankedCandidates(input), {
      experience: "guidance",
    }).map((candidate) => candidate.id),
  );
  const selected = buildNextStepCandidates(input).filter((draft) => {
    const id = draft.launchConfig.activityCandidateId;
    return typeof id === "string" && selectedIds.has(id);
  });
  if (selected.length >= 2) return selected.slice(0, 2);
  const selectedKeys = new Set(selected.map(guidanceItemKey));
  return [
    ...selected,
    ...buildNextStepCandidates(input).filter(
      (draft) => !selectedKeys.has(guidanceItemKey(draft)),
    ),
  ].slice(0, 2);
}

export function buildAlternativeNextStep(
  input: BuildNextStepsInput,
  options: {
    excludedKeys: string[];
    currentTaskTypes: NextStepDraft["taskType"][];
  },
): NextStepDraft | null {
  const candidates = rankedCandidates(input);
  const currentIds = candidates.flatMap((item) => {
    const draft = draftForCandidate(item, input);
    return draft && options.excludedKeys.includes(guidanceItemKey(draft))
      ? [item.id]
      : [];
  });
  const selected = selectActivityCandidates(candidates, {
    experience: "alternative",
    currentCandidateIds: currentIds,
  })[0];
  const selectedDraft = selected ? draftForCandidate(selected, input) : null;
  if (selectedDraft) return selectedDraft;
  const optionalFallback = candidates.find(
    (candidate) =>
      candidate.requirement === "optional" && !currentIds.includes(candidate.id),
  );
  return optionalFallback ? draftForCandidate(optionalFallback, input) : null;
}
