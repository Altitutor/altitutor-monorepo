import type {
  PreparationCurrentScoreEstimate,
  PreparationEngineInput,
  PreparationEngineResult,
  PreparationExplanationTraceItem,
} from "@/features/preparation/model/types";
import {
  assessTimingPolicy,
  type TimingPolicyAssessment,
} from "@/features/preparation/lib/timing-policy";
import { generateStudyPlan } from "@/features/study-plan/lib/generator";
import { buildNextStepDrafts } from "@/features/study-plan/lib/next-step-guidance";
import { buildReadinessSnapshot } from "@/features/study-plan/lib/readiness";
import { estimateRepresentativeScore } from "@/features/preparation/lib/score-model";

const COGNITIVE_SECTION_COUNT = 3;

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function validateInput(input: PreparationEngineInput): void {
  requireNonEmpty(input.seed, "Preparation seed");
  requireNonEmpty(input.versions.engine, "Preparation engine version");
  requireNonEmpty(input.versions.policy, "Preparation policy version");
  requireNonEmpty(input.versions.scoreModel, "Score model version");
  requireNonEmpty(input.timingProfile.id, "Timing profile id");
  requireNonEmpty(input.timingProfile.version, "Timing profile version");
  if (!Number.isFinite(new Date(input.clock.now).getTime())) {
    throw new Error("Preparation clock must contain a valid ISO timestamp.");
  }
  if (
    !Number.isFinite(input.timingProfile.defaultTimeMultiplier) ||
    input.timingProfile.defaultTimeMultiplier <= 0
  ) {
    throw new Error("Timing profile multiplier must be positive.");
  }
  for (const multiplier of Object.values(
    input.timingProfile.sectionTimeMultipliers,
  )) {
    if (multiplier == null) continue;
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error("Section timing multipliers must be positive.");
    }
  }
}

function currentScoreFromRepresentativeEvidence(
  input: PreparationEngineInput,
): PreparationCurrentScoreEstimate {
  const estimate = estimateRepresentativeScore({
    now: input.clock.now,
    modelVersion: input.versions.scoreModel,
    evidence: input.evidence.scoreEvidence ?? [],
  });
  const bySection = new Map(
    estimate.sections.map((section) => [section.sectionId, section]),
  );
  const sections = input.content.sections
    .filter((section) => section.sectionNumber <= COGNITIVE_SECTION_COUNT)
    .sort((left, right) => left.sectionNumber - right.sectionNumber)
    .map((section) => {
      const score = bySection.get(section.id);
      return {
        sectionId: section.id,
        sectionNumber: section.sectionNumber,
        currentEstimate: score?.currentEstimate ?? null,
        evidenceCount: score?.qualifyingEvidenceCount ?? 0,
        confidence: score?.confidence ?? null,
        uncertainty: score?.uncertainty ?? null,
        evidenceStatus: score?.status ?? ("unavailable" as const),
      };
    });
  const situationalJudgement = estimate.situationalJudgement;
  return {
    modelVersion: input.versions.scoreModel,
    status: estimate.status,
    currentEstimate: estimate.currentEstimate,
    confidence: estimate.confidence,
    uncertainty: estimate.uncertainty,
    plausibleRange: estimate.plausibleRange,
    sections,
    situationalJudgement: situationalJudgement
      ? {
          sectionId: situationalJudgement.sectionId,
          sectionNumber: 4,
          currentEstimate: situationalJudgement.currentEstimate,
          evidenceCount: situationalJudgement.qualifyingEvidenceCount,
          confidence: situationalJudgement.confidence,
          uncertainty: situationalJudgement.uncertainty,
          evidenceStatus: situationalJudgement.status,
        }
      : null,
  };
}

function explanationTrace(
  input: PreparationEngineInput,
  capacityWarning: boolean,
  timingAssessments: Map<string, TimingPolicyAssessment>,
): PreparationExplanationTraceItem[] {
  return [
    {
      code: "preparation.assessment.legacy_adapter",
      source: "assessment",
      details: { policyVersion: input.versions.policy },
    },
    ...[...timingAssessments].map(([sectionId, assessment]) => ({
      code: assessment.decisionCode,
      source: "timing" as const,
      details: {
        sectionId,
        prescribedPace: assessment.prescribedPace,
        advanceFrom: assessment.advanceFrom,
        advanceTo: assessment.advanceTo,
        qualifyingSessions: assessment.qualifyingSessionCount,
        effectiveSectionEquivalents: assessment.effectiveSectionEquivalents,
        broadSectionEquivalents: assessment.broadSectionEquivalents,
        weightedAccuracy: assessment.weightedAccuracy,
        calibrationDue: assessment.calibrationDue,
        overspeedEligible: assessment.overspeedEligible,
        overspeedPace: assessment.overspeedPace,
        capacityConstrained: assessment.capacityConstrained,
      },
    })),
    {
      code: "preparation.score.representative_evidence",
      source: "score",
      details: { modelVersion: input.versions.scoreModel },
    },
    {
      code: "preparation.plan.legacy_adapter",
      source: "plan",
      details: { horizonDays: 21, capacityWarning },
    },
    {
      code: "preparation.timing.profile",
      source: "timing",
      details: {
        profileId: input.timingProfile.id,
        profileVersion: input.timingProfile.version,
        defaultTimeMultiplier: input.timingProfile.defaultTimeMultiplier,
      },
    },
    ...(input.guidance
      ? [
          {
            code: "preparation.guidance.legacy_adapter",
            source: "guidance" as const,
            details: {
              dailyWarmup: input.guidance.dailyWarmup,
            },
          },
        ]
      : []),
  ];
}

/**
 * The canonical Preparation module interface. It is intentionally pure: I/O
 * adapters load evidence before this call and persist selected outputs after it.
 */
export function prepareStudent(
  input: PreparationEngineInput,
): PreparationEngineResult {
  validateInput(input);
  const baseAssessment = buildReadinessSnapshot({
    today: input.clock.today,
    planningDate: input.goal.planningDate,
    sections: input.content.sections,
    signals: input.evidence.sectionSignals,
    categories: input.content.categories,
    learningModules: input.content.learningModules,
  });
  const baseReadinessBySection = new Map(
    baseAssessment.sections.map((section) => [section.sectionId, section]),
  );
  const timingAssessments = new Map<string, TimingPolicyAssessment>();
  const enrichedSignals = input.evidence.sectionSignals.map((signal) => {
    const section = input.content.sections.find(
      (candidate) => candidate.id === signal.sectionId,
    );
    if (!section || section.sectionNumber > COGNITIVE_SECTION_COUNT) {
      return signal;
    }
    const baseReadiness = baseReadinessBySection.get(section.id);
    const assessment = assessTimingPolicy({
      today: input.clock.today,
      planningDate: input.goal.planningDate,
      profile: input.goal.profile,
      section,
      signal,
      sessions: (input.evidence.timingSessions ?? []).filter(
        (session) => session.sectionId === section.id,
      ),
      canPersistPace:
        baseReadiness?.learningRoute === "accuracy" ||
        baseReadiness?.learningRoute === "experience",
    });
    timingAssessments.set(section.id, assessment);
    return {
      ...signal,
      prescribedPace: assessment.prescribedPace,
      prescribedPaceSetAt:
        assessment.advanceTo != null || signal.prescribedPace == null
          ? input.clock.now
          : signal.prescribedPaceSetAt,
      pacePolicyVersion: input.versions.policy,
      timingDecisionCode: assessment.decisionCode,
      timingAdvanceFrom: assessment.advanceFrom,
      timingAdvanceTo: assessment.advanceTo,
      timingCapacityConstrained: assessment.capacityConstrained,
      calibrationDue: assessment.calibrationDue,
      overspeedEligible: assessment.overspeedEligible,
      overspeedPace: assessment.overspeedPace,
    };
  });
  const plan = generateStudyPlan({
    today: input.clock.today,
    planningDate: input.goal.planningDate,
    profile: input.goal.profile,
    sections: input.content.sections,
    signals: enrichedSignals,
    categories: input.content.categories,
    learningModules: input.content.learningModules,
    skillTrainers: input.content.skillTrainers,
    completedMockCount: input.evidence.completedMockCount,
  });
  const immediateGuidance = input.guidance
    ? buildNextStepDrafts({
        today: input.clock.today,
        planningDate: input.goal.planningDate,
        dailyWarmup: input.guidance.dailyWarmup,
        incompleteReview: input.guidance.incompleteReview,
        sections: input.content.sections,
        signals: enrichedSignals,
        categories: input.content.categories,
        learningModules: input.content.learningModules,
        skillTrainers: input.content.skillTrainers,
        trainerAttemptCounts: new Map(
          Object.entries(input.guidance.trainerAttemptCounts),
        ),
        completedMockCount: input.evidence.completedMockCount,
      })
    : [];
  const capacityRisks =
    plan.capacityRisk.level === "warning" ? [plan.capacityRisk] : [];
  const signalBySection = new Map(
    input.evidence.sectionSignals.map((signal) => [signal.sectionId, signal]),
  );
  const progressionEvents = plan.readiness.sections.flatMap((section) => {
    const signal = signalBySection.get(section.sectionId);
    if (
      signal?.learningGraduatedAt ||
      (section.learningRoute !== "accuracy" &&
        section.learningRoute !== "experience")
    ) {
      return [];
    }
    return [
      {
        type: "learning_graduated" as const,
        sectionId: section.sectionId,
        route: section.learningRoute,
        occurredAt: input.clock.now,
        policyVersion: input.versions.policy,
      },
    ];
  });
  const timingProgressionEvents = plan.readiness.sections.flatMap((section) => {
    const originalSignal = signalBySection.get(section.sectionId);
    const assessment = timingAssessments.get(section.sectionId);
    const canPersistPace =
      section.learningRoute === "accuracy" ||
      section.learningRoute === "experience";
    if (!assessment || !canPersistPace) return [];
    if (
      assessment.advanceTo == null &&
      originalSignal?.prescribedPace != null
    ) {
      return [];
    }
    const reason: "initial" | "normal" | "accelerated_1x" | "deadline" =
      assessment.decisionCode === "timing.advance_normal"
        ? "normal"
        : assessment.decisionCode === "timing.advance_accelerated_1x"
          ? "accelerated_1x"
          : assessment.decisionCode === "timing.advance_deadline"
            ? "deadline"
            : "initial";
    return [
      {
        type: "timing_pace_changed" as const,
        sectionId: section.sectionId,
        fromPace: assessment.advanceFrom,
        toPace: assessment.prescribedPace,
        reason,
        occurredAt: input.clock.now,
        policyVersion: input.versions.policy,
      },
    ];
  });
  return {
    generatedAt: input.clock.now,
    seed: input.seed,
    versions: { ...input.versions },
    timingProfile: {
      ...input.timingProfile,
      sectionTimeMultipliers: {
        ...input.timingProfile.sectionTimeMultipliers,
      },
      restBreaks: input.timingProfile.restBreaks.map((restBreak) => ({
        ...restBreak,
      })),
    },
    assessment: plan.readiness,
    currentScore: currentScoreFromRepresentativeEvidence(input),
    plan,
    trajectory: {
      status: "unavailable",
      reason: "legacy_adapter",
      points: [],
    },
    immediateGuidance,
    capacityRisks,
    progressionEvents: [...progressionEvents, ...timingProgressionEvents],
    explanationTrace: explanationTrace(
      input,
      capacityRisks.length > 0,
      timingAssessments,
    ),
  };
}
