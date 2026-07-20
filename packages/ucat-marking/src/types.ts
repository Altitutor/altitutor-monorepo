export type UcatQuestionType = 'multiple_choice' | 'syllogism'

export type QuestionMeta = {
  id: string
  stemId: string
  sectionName: string
  questionType: UcatQuestionType
  correctOptionId: string
  /** Options ordered by index. For SJT: index 0=A, 1=B, 2=C, 3=D. */
  options: Array<{ id: string; index: number }>
}

export type Attempt = {
  questionId: string
  selectedOptionId: string
}

export type RawScoreResult = {
  questionScores: Map<string, number>
  totalRawScore: number
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
