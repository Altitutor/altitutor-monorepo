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

export type PreparationVersions = {
  readonly engine: string;
  readonly policy: string;
  readonly scoreModel: string;
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
  };
  evidence: {
    sectionSignals: StudyPlanSectionSignal[];
    timingSessions?: StudyPlanTimingEvidenceSession[];
    scoreEvidence?: RepresentativeScoreEvidence[];
    completedMockCount: number;
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

export type PreparationTrajectory = {
  status: "unavailable";
  reason: "legacy_adapter";
  points: [];
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
