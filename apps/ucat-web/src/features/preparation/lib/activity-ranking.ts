import type {
  StudyPlanCategorySignal,
  StudyPlanLearningModule,
  StudyPlanReadinessSnapshot,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSjtPreference,
  StudyPlanSkillTrainer,
} from "@/features/study-plan/model/types";
import {
  hasCurrentSjtMockCredit,
  normalizeSjtPreference,
  sjtAllocationWeight,
} from "@/features/preparation/lib/sjt-allocation-policy";

export type PreparationActivityKind =
  | "instruction"
  | "related_practice"
  | "broad_practice"
  | "mixed_practice"
  | "targeted_practice"
  | "calibration"
  | "mock"
  | "review"
  | "optional_warmup"
  | "optional_extension";

export type PreparationActivityObjective =
  | "complete_instruction"
  | "build_learning_exposure"
  | "remediate_reliable_weakness"
  | "build_representative_breadth"
  | "refresh_calibration"
  | "rehearse_full_exam"
  | "maintain_sjt_judgement"
  | "consolidate_review"
  | "warm_up";

export type PreparationActivityCandidate = {
  id: string;
  kind: PreparationActivityKind;
  requirement: "required" | "optional";
  sectionId: string | null;
  categoryIds: string[];
  questionTagIds: string[];
  learningModuleId: string | null;
  skillTrainerId: string | null;
  sourceAttemptId: string | null;
  scope: "attempt" | "category" | "mixed" | "section" | "full_exam";
  dose: { questionCount: number | null; sectionEquivalents: number };
  duration: { practiceMinutes: number; reviewMinutes: number };
  objective: PreparationActivityObjective;
  reasonCode: string;
  studentReason: string;
  ranking: {
    milestone: number;
    weakness: number;
    uncertainty: number;
    targetGap: number;
    tagSampling: number;
    total: number;
  };
};

export type ActivityTagSignal = {
  id: string;
  sectionId: string;
  categoryId: string;
  availableQuestionCount: number;
  independentSessionCount: number;
  weaknessScore: number;
};

export type ActivityRankingInput = {
  today: string;
  planningDate: string;
  targetScore: number;
  readiness: StudyPlanReadinessSnapshot;
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  tagSignals?: ActivityTagSignal[];
  trainerAttemptCounts: Map<string, number>;
  incompleteReview: {
    attemptType: "practice_session" | "set_attempt" | "mock_attempt";
    attemptId: string;
    attemptLabel: string;
  } | null;
  completedMockCount: number;
  sjtPreference?: StudyPlanSjtPreference;
  lastCompletedMockDate?: string | null;
};

type Factors = Omit<PreparationActivityCandidate["ranking"], "total">;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function factors(input: Factors): PreparationActivityCandidate["ranking"] {
  return {
    ...input,
    total: Object.values(input).reduce((sum, value) => sum + value, 0),
  };
}

function duration(
  section: StudyPlanSection,
  questionCount: number,
  timed: boolean,
): PreparationActivityCandidate["duration"] {
  return {
    practiceMinutes: timed
      ? Math.ceil((questionCount * section.timePerQuestionSeconds) / 60)
      : Math.ceil(questionCount * 1.5),
    reviewMinutes: timed ? 5 : 8,
  };
}

function candidate(
  input: Omit<
    PreparationActivityCandidate,
    | "categoryIds"
    | "questionTagIds"
    | "learningModuleId"
    | "skillTrainerId"
    | "sourceAttemptId"
  > &
    Partial<
      Pick<
        PreparationActivityCandidate,
        | "categoryIds"
        | "questionTagIds"
        | "learningModuleId"
        | "skillTrainerId"
        | "sourceAttemptId"
      >
    >,
): PreparationActivityCandidate {
  return {
    categoryIds: [],
    questionTagIds: [],
    learningModuleId: null,
    skillTrainerId: null,
    sourceAttemptId: null,
    ...input,
  };
}

function eligibleTag(
  input: ActivityRankingInput,
  sectionId: string,
  categoryId: string | null,
): { id: string | null; priority: number } {
  const tag = (input.tagSignals ?? [])
    .filter(
      (item) =>
        item.sectionId === sectionId &&
        item.categoryId === categoryId &&
        item.independentSessionCount >= 2 &&
        item.availableQuestionCount >= 20,
    )
    .sort(
      (left, right) =>
        right.weaknessScore - left.weaknessScore ||
        left.id.localeCompare(right.id),
    )[0];
  return tag
    ? { id: tag.id, priority: clamp(tag.weaknessScore * 10, 0, 10) }
    : { id: null, priority: 0 };
}

/**
 * Rank outstanding preparation milestones once for every Student experience.
 * Category and tag signals are maxima within a section, never sums, so a
 * larger taxonomy cannot manufacture a larger share of the plan.
 */
export function rankActivityCandidates(
  input: ActivityRankingInput,
): PreparationActivityCandidate[] {
  const result: PreparationActivityCandidate[] = [];
  const sectionById = new Map(input.sections.map((item) => [item.id, item]));
  const signalBySection = new Map(input.signals.map((item) => [item.sectionId, item]));
  const equalTarget = input.targetScore / 3;

  if (input.incompleteReview) {
    result.push(
      candidate({
        id: `review:${input.incompleteReview.attemptId}`,
        kind: "review",
        requirement: "required",
        sectionId: null,
        sourceAttemptId: input.incompleteReview.attemptId,
        scope: "attempt",
        dose: { questionCount: null, sectionEquivalents: 0 },
        duration: { practiceMinutes: 0, reviewMinutes: 10 },
        objective: "consolidate_review",
        reasonCode: "activity.incomplete_review",
        studentReason: "Review this result while the decisions are still fresh.",
        ranking: factors({
          milestone: 400,
          weakness: 0,
          uncertainty: 0,
          targetGap: 0,
          tagSampling: 0,
        }),
      }),
    );
  }

  for (const readiness of input.readiness.sections) {
    const section = sectionById.get(readiness.sectionId);
    if (!section || section.sectionNumber > 3) continue;
    const signal = signalBySection.get(section.id);
    const evidenceReliability = signal?.scoreConfidence
      ? { low: 0.25, medium: 0.6, high: 1 }[signal.scoreConfidence]
      : clamp((signal?.evidenceCount ?? 0) / 5, 0, 1);
    const targetGap =
      signal?.currentEstimate == null
        ? 0
        : clamp((equalTarget - signal.currentEstimate) / 2, 0, 80) *
          evidenceReliability;
    const uncertainty = clamp(30 - (signal?.evidenceCount ?? 0) * 5, 0, 30);
    const milestone =
      readiness.mode === "learning"
        ? 75
        : readiness.calibrationDue
          ? 80
          : readiness.mode === "exam"
            ? 65
            : 50;
    const categoryHasReliableVolume = (item: StudyPlanCategorySignal) =>
      item.maxScore >= 8 ||
      (item.attemptedQuestionCount ?? 0) >= 10 ||
      (item.qualifyingPracticeSessions ?? 0) >= 2;
    const reliableCategories = input.categories
      .filter(
        (item) =>
          item.sectionId === section.id && categoryHasReliableVolume(item),
      )
      .sort(
        (left, right) =>
          right.weaknessScore - left.weaknessScore ||
          right.maxScore - left.maxScore ||
          left.id.localeCompare(right.id),
      );
    const strongestCategory = reliableCategories[0];
    const similarlyReliableCategories = reliableCategories
      .filter(
        (item) =>
          strongestCategory != null &&
          strongestCategory.weaknessScore - item.weaknessScore < 0.2,
      )
      .sort(
        (left, right) =>
          right.weaknessScore - left.weaknessScore || left.id.localeCompare(right.id),
      )
      .slice(0, 3);
    const useMixedScope = similarlyReliableCategories.length >= 2;
    const weakness = clamp((strongestCategory?.weaknessScore ?? 0) * 50, 0, 50);
    const tag = eligibleTag(input, section.id, strongestCategory?.id ?? null);

    if (readiness.mode === "learning") {
      const learningModules = input.learningModules
        .filter(
          (item) =>
            item.completionPercent < 100 &&
            (item.sectionId == null || item.sectionId === section.id),
        )
        .sort(
          (left, right) =>
            Number(right.priority === "essential") -
              Number(left.priority === "essential") ||
            right.relevanceScore - left.relevanceScore ||
            left.id.localeCompare(right.id),
        );
      for (const [moduleIndex, learningModule] of learningModules.entries()) {
        result.push(
          candidate({
            id: `instruction:${learningModule.id}`,
            kind: "instruction",
            requirement: "required",
            sectionId: section.id,
            learningModuleId: learningModule.id,
            scope: "section",
            dose: { questionCount: null, sectionEquivalents: 0.25 },
            duration: {
              practiceMinutes: learningModule.estimatedMinutes,
              reviewMinutes: 0,
            },
            objective: "complete_instruction",
            reasonCode: "activity.outstanding_instruction",
            studentReason: "Build the method here before adding timing pressure.",
            ranking: factors({
              milestone: milestone + 75 - moduleIndex,
              weakness: 0,
              uncertainty,
              targetGap,
              tagSampling: 0,
            }),
          }),
        );
      }
      if (!signal?.benchmarkCompleted) {
        result.push(
          candidate({
            id: `diagnostic:${section.id}`,
            kind: "calibration",
            requirement: "required",
            sectionId: section.id,
            scope: "section",
            dose: { questionCount: section.questionCount, sectionEquivalents: 1 },
            duration: duration(section, section.questionCount, true),
            objective: "refresh_calibration",
            reasonCode: "activity.diagnostic_due",
            studentReason: "A whole-section diagnostic will establish a useful baseline.",
            ranking: factors({
              milestone: 20,
              weakness: 0,
              uncertainty,
              targetGap,
              tagSampling: 0,
            }),
          }),
        );
      }
    }

    if (readiness.calibrationDue) {
      result.push(
        candidate({
          id: `calibration:${section.id}`,
          kind: "calibration",
          requirement: "required",
          sectionId: section.id,
          scope: "section",
          dose: { questionCount: section.questionCount, sectionEquivalents: 1 },
          duration: duration(section, section.questionCount, true),
          objective: "refresh_calibration",
          reasonCode: "activity.calibration_due",
          studentReason: "A whole-section check will show whether your pace transfers.",
          ranking: factors({
            milestone: milestone + 20,
            weakness: 0,
            uncertainty,
            targetGap,
            tagSampling: 0,
          }),
        }),
      );
    }

    const questionCount = readiness.overspeedEligible
      ? Math.max(20, Math.ceil(section.questionCount * 0.8))
      : readiness.mode === "learning"
        ? 10
        : Math.max(20, Math.ceil(section.questionCount * 0.55));
    const objective: PreparationActivityObjective = strongestCategory
      ? "remediate_reliable_weakness"
      : readiness.mode === "learning"
        ? "build_learning_exposure"
        : "build_representative_breadth";
    const reasonCode = strongestCategory
      ? "activity.reliable_weakness"
      : readiness.mode === "learning"
        ? "activity.learning_exposure"
        : "activity.evidence_uncertainty";
    const studentReason = strongestCategory
      ? "Reliable evidence shows this is the most useful area to revisit."
      : "Broader work will strengthen the evidence behind your next decision.";
    const commonRanking = factors({
      milestone,
      weakness,
      uncertainty,
      targetGap,
      tagSampling: tag.priority,
    });
    result.push(
      candidate({
        id: strongestCategory
          ? useMixedScope
            ? `mixed:${section.id}:${similarlyReliableCategories.map((item) => item.id).join(":")}`
            : `targeted:${section.id}:${strongestCategory.id}`
          : `broad:${section.id}`,
        kind: strongestCategory
          ? useMixedScope
            ? "mixed_practice"
            : "targeted_practice"
          : readiness.mode === "learning"
            ? "related_practice"
            : "broad_practice",
        requirement: "required",
        sectionId: section.id,
        categoryIds: strongestCategory
          ? useMixedScope
            ? similarlyReliableCategories.map((item) => item.id)
            : [strongestCategory.id]
          : [],
        questionTagIds: tag.id ? [tag.id] : [],
        scope: strongestCategory
          ? useMixedScope
            ? "mixed"
            : "category"
          : "section",
        dose: {
          questionCount,
          sectionEquivalents: questionCount / section.questionCount,
        },
        duration: duration(section, questionCount, readiness.mode !== "learning"),
        objective,
        reasonCode,
        studentReason,
        ranking: commonRanking,
      }),
    );
    if (strongestCategory) {
      result.push(
        candidate({
          id: `broad:${section.id}:${objective}`,
          kind: "broad_practice",
          requirement: "required",
          sectionId: section.id,
          scope: "section",
          dose: {
            questionCount,
            sectionEquivalents: questionCount / section.questionCount,
          },
          duration: duration(section, questionCount, readiness.mode !== "learning"),
          objective,
          reasonCode,
          studentReason,
          ranking: factors({
            milestone: milestone - 1,
            weakness,
            uncertainty,
            targetGap,
            tagSampling: 0,
          }),
        }),
      );
    }
  }

  const sjtSection = input.sections.find((section) => section.sectionNumber === 4);
  const sjtPreference = normalizeSjtPreference(input.sjtPreference);
  const sjtWeight = sjtAllocationWeight(sjtPreference);
  if (
    sjtSection &&
    sjtWeight > 0 &&
    !hasCurrentSjtMockCredit({
      today: input.today,
      lastCompletedMockDate: input.lastCompletedMockDate,
    })
  ) {
    const questionCount = Math.round(sjtSection.questionCount * sjtWeight);
    result.push(
      candidate({
        id: `sjt:${sjtPreference}`,
        kind: "broad_practice",
        requirement: "required",
        sectionId: sjtSection.id,
        scope: "section",
        dose: { questionCount, sectionEquivalents: sjtWeight },
        duration: duration(
          sjtSection,
          questionCount,
          input.readiness.mode !== "learning",
        ),
        objective: "maintain_sjt_judgement",
        reasonCode: "activity.sjt_preference",
        studentReason:
          sjtPreference === "normally"
            ? "Regular SJT practice matches the emphasis you chose."
            : "A small amount of SJT practice matches the emphasis you chose.",
        ranking: factors({
          milestone: 40 * sjtWeight,
          weakness: 0,
          uncertainty: 0,
          targetGap: 0,
          tagSampling: 0,
        }),
      }),
    );
  }

  if (input.readiness.sections.every((section) => section.mode !== "learning")) {
    result.push(
      candidate({
        id: `mock:${input.completedMockCount + 1}`,
        kind: "mock",
        requirement: "required",
        sectionId: null,
        scope: "full_exam",
        dose: { questionCount: null, sectionEquivalents: 3 },
        duration: { practiceMinutes: 120, reviewMinutes: 30 },
        objective: "rehearse_full_exam",
        reasonCode: "activity.mock_cadence",
        studentReason:
          input.readiness.mode === "exam"
            ? "Full-exam pacing and stamina are now a priority."
            : "Rehearse the complete exam under realistic conditions.",
        ranking: factors({
          milestone: input.readiness.mode === "exam" ? 350 : 35,
          weakness: 0,
          uncertainty: 0,
          targetGap: 0,
          tagSampling: 0,
        }),
      }),
    );
  }

  const warmups = [...input.skillTrainers].sort(
    (left, right) =>
      (input.trainerAttemptCounts.get(left.id) ?? 0) -
        (input.trainerAttemptCounts.get(right.id) ?? 0) ||
      left.name.localeCompare(right.name),
  );
  for (const [warmupIndex, warmup] of warmups.entries()) {
    result.push(
      candidate({
        id: `warmup:${warmup.id}`,
        kind: "optional_warmup",
        requirement: "optional",
        sectionId: warmup.sectionId,
        skillTrainerId: warmup.id,
        scope: "category",
        dose: { questionCount: null, sectionEquivalents: 0 },
        duration: { practiceMinutes: warmup.estimatedMinutes, reviewMinutes: 0 },
        objective: "warm_up",
        reasonCode: "activity.optional_warmup",
        studentReason: "Use this as a short warm-up before core practice.",
        ranking: factors({
          milestone: -warmupIndex,
          weakness: 0,
          uncertainty: 0,
          targetGap: 0,
          tagSampling: 0,
        }),
      }),
    );
  }

  return result.sort(
    (left, right) =>
      Number(left.requirement === "optional") -
        Number(right.requirement === "optional") ||
      right.ranking.total - left.ranking.total ||
      left.id.localeCompare(right.id),
  );
}

export type ActivityCandidateSelection =
  | { experience: "plan" }
  | { experience: "guidance" }
  | { experience: "alternative"; currentCandidateIds: string[] }
  | { experience: "extra"; requiredWorkComplete: boolean };

export function selectActivityCandidates(
  candidates: PreparationActivityCandidate[],
  selection: ActivityCandidateSelection,
): PreparationActivityCandidate[] {
  const required = candidates.filter((item) => item.requirement === "required");
  if (selection.experience === "plan") return required;
  if (selection.experience === "guidance") return required.slice(0, 2);
  if (selection.experience === "extra") {
    if (!selection.requiredWorkComplete) return [];
    const source = required.find(
      (item) =>
        item.kind !== "review" && item.kind !== "calibration" && item.kind !== "mock",
    );
    return source
      ? [
          {
            ...source,
            id: `extension:${source.id}`,
            kind: "optional_extension",
            requirement: "optional",
            reasonCode: "activity.optional_extension",
          },
        ]
      : [];
  }

  const excluded = new Set(selection.currentCandidateIds);
  const objective = candidates.find((item) => excluded.has(item.id))?.objective;
  const available = candidates.filter((item) => !excluded.has(item.id));
  const sameObjective = available.find(
    (item) => item.requirement === "required" && item.objective === objective,
  );
  if (sameObjective) return [sameObjective];
  const optional = available.find((item) => item.requirement === "optional");
  return optional ? [optional] : [];
}
