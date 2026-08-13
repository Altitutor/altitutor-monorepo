import type {
  ResponseDefinition,
  ReviewContract,
} from '@altitutor/ucat-response-contract'

export type ScoringQuestion = {
  definition: ResponseDefinition
  sectionName: string
}

export type RawScoreResult = {
  questionScores: Map<string, number>
  totalRawScore: number
  maximumRawScore: number
  reviews: Map<string, ReviewContract>
}

export type UcatScoringSection =
  | 'verbal_reasoning'
  | 'decision_making'
  | 'quantitative_reasoning'
  | 'situational_judgement'

export type UcatSectionScoreEstimate = {
  /** Estimated UCAT ANZ section score, rounded to the nearest 10. */
  scaledScore: number
  /** Approximate one-standard-error uncertainty in scaled-score points. */
  standardError: number
  /** Approximate 68% range, bounded to the 300-900 reporting scale. */
  estimatedRange: {
    min: number
    max: number
  }
  modelVersion: string
  evidenceCycle: number
}
