export { computeMaxRawScore, computeRawScore } from './raw-score'
export {
  getSituationalJudgementMarkingOutcome,
  type SituationalJudgementMarkingOutcome,
} from './situational-judgement'
export {
  estimateUcatSectionScore,
  resolveSingleUcatScoringSection,
  resolveUcatScoringSection,
} from './scaled-score'
export {
  SITUATIONAL_JUDGEMENT_SECTION_NAME,
  SJ_OPTION_COUNT,
  SCALED_MAX,
  SCALED_MIN,
  SCALED_RANGE,
  SCALED_ROUND_TO,
  SYLLOGISM_POINTS,
  UCAT_SCORING_MODEL,
} from './config'
export type {
  RawScoreResult,
  ScoringQuestion,
  UcatScoringSection,
  UcatSectionScoreEstimate,
} from './types'
