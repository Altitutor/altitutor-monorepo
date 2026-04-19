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
  averageScaledScore: number | null
  weightedAverageScaledScore: number | null
  weightedAveragePercentage: number | null
  /** Total public question points in this section (syllogism=2, else=1) */
  totalPublicQuestions?: number
}

export type SetAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  questionSetId: string
  questionSetName: string | null
  isStudentGenerated: boolean
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
}

export type MockAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  ucatMockId: string
  mockName: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  /** Max possible scaled score (900 × section 1–3 sets). Section 4 excluded. */
  scaledScoreMax: number | null
  timeTakenSeconds: number | null
  setTimeLimitSeconds: number | null
  studentSetSpeed: number | null
  studentExamSpeed: number | null
  wasTimed: boolean
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
  unlimited: boolean
}

export type QuestionAttemptRow = {
  id: string
  questionId: string
  studentQuestionSetAttemptId: string | null
  attemptedAt: string
  score: number | null
  questionType: string | null
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
  weightedAveragePercentage: number | null
  /** Total public question points in this category (syllogism=2, else=1) */
  totalPublicQuestions?: number
}

export type ProgressResponse = {
  sectionProgress: SectionProgress[]
  setAttempts: SetAttemptRow[]
  mockAttempts: MockAttemptRow[]
  practiceAttempts: PracticeAttemptRow[]
  questionAttempts: QuestionAttemptRow[]
  /** Per-section category stats (all-time and weighted %) */
  sectionCategoryProgress: Record<string, SectionCategoryProgress[]>
  /** Total count of public mocks (for mocks completed card) */
  totalPublicMocks?: number
  /** Per-section: total count of public non-student-generated sets */
  totalPublicSetsBySection?: Record<string, number>
  /** Per-section: total count of public untimed sets (for breakdown denominator) */
  totalPublicUntimedSetsBySection?: Record<string, number>
  /** Per-section: total count of public timed sets (for breakdown denominator) */
  totalPublicTimedSetsBySection?: Record<string, number>
}
