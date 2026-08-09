/**
 * Shared UCAT progress API types.
 * Used by both ucat-web (student) and tutor-web (tutor viewing student) progress endpoints.
 */

export type SectionProgress = {
  sectionId: string
  sectionName: string
  sectionNumber: number
  correctScore: number
  maxScore: number
  percentage: number
  /** @deprecated ucat-web no longer uses legacy section-level scaled score averages. */
  averageScaledScore?: number | null
  /** @deprecated ucat-web no longer uses legacy section-level scaled score EMA. */
  weightedAverageScaledScore?: number | null
  /** @deprecated ucat-web no longer uses legacy section-level percentage EMA. */
  weightedAveragePercentage?: number | null
  /** Total accessible question progress points in this section, weighted by answer-scheme maximum marks. */
  totalPublicQuestions?: number
}

export type SetAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  questionSetId: string
  questionSetName: string | null
  studentUcatMockAttemptId: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
  wasTimed: boolean
  /** First section ID for sets with sections (for filtering by section) */
  sectionId: string | null
  /** Null until the student completes the durable attempt review. */
  reviewCompletedAt?: string | null
}

export type MockAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  ucatMockId: string
  mockName: string | null
  scorePoints: number | null
  totalPoints: number | null
  rawScoreBreakdown?: Array<{
    sectionNumber: number
    sectionLabel: string
    scorePoints: number
    totalPoints: number
  }>
  scaledScore: number | null
  /** Max possible scaled score (900 × section 1–3 sets). Section 4 excluded. */
  scaledScoreMax: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
  wasTimed: boolean
  /** Null until the student completes the durable attempt review. */
  reviewCompletedAt?: string | null
}

export type PracticeAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  ucatSectionId: string
  sectionName: string
  scorePoints: number | null
  totalPoints: number | null
  questionCount: number | null
  /** Session duration in seconds when start/end are known. */
  timeTakenSeconds: number | null
  unlimited: boolean
  /** Null until the student completes the durable attempt review. */
  reviewCompletedAt?: string | null
}

export type QuestionAttemptRow = {
  id: string
  questionId: string
  questionStemId: string | null
  studentQuestionSetAttemptId: string | null
  attemptedAt: string
  score: number | null
  questionType: string | null
  answerScheme:
    | 'single_choice'
    | 'situational_judgement_rating'
    | 'decision_making_binary_placement'
    | 'situational_judgement_most_least'
    | null
  timeSpentSeconds: number | null
  studentQuestionSpeed: number | null
  wasTimed: boolean
  ucatSectionId: string | null
  sectionName: string | null
  sectionNumber: number | null
  questionStemCategoryId: string | null
  categoryName: string | null
}

export type SectionCategoryProgress = {
  categoryId: string
  categoryName: string
  correctScore: number
  maxScore: number
  percentage: number
  /** @deprecated ucat-web now uses raw/filtered category correctness only. */
  weightedAveragePercentage?: number | null
  /** Total accessible question progress points in this category, weighted by answer-scheme maximum marks. */
  totalPublicQuestions?: number
}

export type ProgressResponse = {
  sectionProgress: SectionProgress[]
  setAttempts: SetAttemptRow[]
  mockAttempts: MockAttemptRow[]
  practiceAttempts: PracticeAttemptRow[]
  questionAttempts: QuestionAttemptRow[]
  /** Per-section category stats */
  sectionCategoryProgress: Record<string, SectionCategoryProgress[]>
  /** Total count of public mocks (for mocks completed card) */
  totalPublicMocks?: number
  /** Per-section: total count of public non-student-generated sets */
  totalPublicSetsBySection?: Record<string, number>
  /** Per-section: total count of public untimed sets (for breakdown denominator) */
  totalPublicUntimedSetsBySection?: Record<string, number>
  /** Per-section: total count of public timed sets (for breakdown denominator) */
  totalPublicTimedSetsBySection?: Record<string, number>
  /** Daily score projections, exposed to authorised tutors for the selected student. */
  scoreProjectionSnapshots?: Array<{
    date: string
    confidence: 'low' | 'medium' | 'high'
    sectionEstimates: Record<string, number>
  }>
}
