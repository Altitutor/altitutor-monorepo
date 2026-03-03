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

export type ScaledScoreStrategy = (
  rawScore: number,
  maxRawScore: number,
  options?: ScaledScoreOptions
) => number

export type ScaledScoreOptions = {
  /** Section name for future section-specific scaling. */
  section?: string
}
