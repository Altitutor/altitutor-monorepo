import type {
  StudyPlanCapacityRisk,
  StudyPlanCategorySignal,
  StudyPlanGenerationResult,
  StudyGuidanceItem,
  StudyPlanLearningModule,
  StudyPlanProfileInput,
  StudyPlanReadinessSnapshot,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
  StudyPlanTimingEvidenceSession,
} from "@/features/study-plan/model/types";
import type { RepresentativeScoreEvidence } from "@/features/preparation/lib/score-model";
import type {
  ActivityTagSignal,
  PreparationActivityCandidate,
} from "@/features/preparation/lib/activity-ranking";

export type PreparationVersions = {
  readonly engine: string;
  readonly policy: string;
  readonly scoreModel: string;
  readonly trajectoryModel: string;
};

export type PreparationGuidanceItem = Omit<
  StudyGuidanceItem,
  "id" | "position" | "triggerKey" | "generatedOn"
>;

export type PreparationTimingProfile = {
  id: string;
  version: string;
  defaultTimeMultiplier: number;
  sectionTimeMultipliers: Partial<Record<StudyPlanSection["key"], number>>;
  restBreaks: Array<{
    afterSectionNumber: number;
    durationSeconds: number;
    pausesClock: boolean;
  }>;
};

export type PreparationGuidanceContext = {
  dailyWarmup: boolean;
  incompleteReview: {
    attemptType: "practice_session" | "set_attempt" | "mock_attempt";
    attemptId: string;
    attemptLabel: string;
  } | null;
  trainerAttemptCounts: Record<string, number>;
};

export type PreparationEngineInput = {
  clock: {
    now: string;
    today: string;
  };
  seed: string;
  versions: PreparationVersions;
  timingProfile: PreparationTimingProfile;
  goal: {
    planningDate: string;
    profile: StudyPlanProfileInput;
  };
  content: {
    sections: StudyPlanSection[];
    categories: StudyPlanCategorySignal[];
    learningModules: StudyPlanLearningModule[];
    skillTrainers: StudyPlanSkillTrainer[];
    tagSignals?: ActivityTagSignal[];
  };
  evidence: {
    sectionSignals: StudyPlanSectionSignal[];
    timingSessions?: StudyPlanTimingEvidenceSession[];
    scoreEvidence?: RepresentativeScoreEvidence[];
    completedMockCount: number;
    forecast?: {
      previousSectionTargets?: Record<string, number>;
      previousSectionTargetsSetAt?: string | null;
      recentCoreSectionEquivalentsPerWeek?: number | null;
      expectedAdherence?: number | null;
      adherenceUncertainty?: number | null;
      learningResponse?: number | null;
      learningResponseUncertainty?: number | null;
      history?: PreparationTrajectoryHistoryPoint[];
    };
  };
  guidance?: PreparationGuidanceContext;
};

export type PreparationCurrentScoreEstimate = {
  modelVersion: string;
  status: "available" | "unavailable";
  currentEstimate: number | null;
  confidence: "low" | "medium" | "high" | null;
  uncertainty: number | null;
  plausibleRange: { min: number; max: number } | null;
  sections: Array<{
    sectionId: string;
    sectionNumber: number;
    currentEstimate: number | null;
    evidenceCount: number;
    confidence: "low" | "medium" | "high" | null;
    uncertainty: number | null;
    evidenceStatus: "available" | "unavailable";
  }>;
  situationalJudgement: {
    sectionId: string;
    sectionNumber: 4;
    currentEstimate: number | null;
    evidenceCount: number;
    confidence: "low" | "medium" | "high" | null;
    uncertainty: number | null;
    evidenceStatus: "available" | "unavailable";
  } | null;
};

export type PreparationTrajectoryHistoryPoint = {
  date: string;
  currentEstimate: number;
  modelVersion: string;
};

export type PreparationTrajectoryPoint = {
  date: string;
  day: number;
  lower: number;
  middle: number;
  upper: number;
};

export type PreparationTrajectory =
  | {
      status: "unavailable";
      reason: "insufficient_score_evidence" | "no_future_dose";
      modelVersion: string;
      history: PreparationTrajectoryHistoryPoint[];
      points: [];
    }
  | {
      status: "available";
      modelVersion: string;
      doseSource: "scheduled_core" | "recent_sustained_workload";
      coreSectionEquivalentsPerWeek: number;
      expectedAdherence: number;
      percentiles: { lower: 20; middle: 50; upper: 80 };
      history: PreparationTrajectoryHistoryPoint[];
      points: PreparationTrajectoryPoint[];
    };

export type PreparationExplanationTraceItem = {
  code: string;
  source: "assessment" | "score" | "plan" | "guidance" | "timing";
  details: Record<string, string | number | boolean | null>;
};

export type PreparationEngineResult = {
  generatedAt: string;
  seed: string;
  versions: PreparationVersions;
  timingProfile: PreparationTimingProfile;
  assessment: StudyPlanReadinessSnapshot;
  currentScore: PreparationCurrentScoreEstimate;
  plan: StudyPlanGenerationResult;
  trajectory: PreparationTrajectory;
  immediateGuidance: PreparationGuidanceItem[];
  activityCandidates: PreparationActivityCandidate[];
  capacityRisks: StudyPlanCapacityRisk[];
  progressionEvents: Array<
    | {
        type: "learning_graduated";
        sectionId: string;
        route: "accuracy" | "experience";
        occurredAt: string;
        policyVersion: string;
      }
    | {
        type: "timing_pace_changed";
        sectionId: string;
        fromPace: number | null;
        toPace: number;
        reason: "initial" | "normal" | "accelerated_1x" | "deadline";
        occurredAt: string;
        policyVersion: string;
      }
  >;
  explanationTrace: PreparationExplanationTraceItem[];
};
