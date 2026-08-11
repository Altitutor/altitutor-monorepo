export { prepareStudent } from "@/features/preparation/lib/engine";
export {
  rankActivityCandidates,
  selectActivityCandidates,
} from "@/features/preparation/lib/activity-ranking";
export type {
  ActivityCandidateSelection,
  ActivityRankingInput,
  ActivityTagSignal,
  PreparationActivityCandidate,
  PreparationActivityKind,
  PreparationActivityObjective,
} from "@/features/preparation/lib/activity-ranking";
export {
  parseRepresentativeScoreEvidence,
  REPRESENTATIVE_SCORE_EVIDENCE_SELECT,
} from "@/features/preparation/lib/score-evidence-adapter";
export {
  classifyScoreEvidence,
  estimateRepresentativeScore,
} from "@/features/preparation/lib/score-model";
export type {
  RepresentativeScoreEstimate,
  RepresentativeScoreEvidence,
  RepresentativeSectionScore,
  ScoreEvidenceClassification,
} from "@/features/preparation/lib/score-model";
export {
  CURRENT_PREPARATION_VERSIONS,
  STANDARD_PREPARATION_TIMING_PROFILE,
} from "@/features/preparation/lib/policy";
export type {
  PreparationCurrentScoreEstimate,
  PreparationEngineInput,
  PreparationEngineResult,
  PreparationExplanationTraceItem,
  PreparationGuidanceItem,
  PreparationGuidanceContext,
  PreparationTimingProfile,
  PreparationTrajectory,
  PreparationVersions,
} from "@/features/preparation/model/types";
