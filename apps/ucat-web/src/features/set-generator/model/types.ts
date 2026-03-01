export type SectionKey = 'verbal_reasoning' | 'decision_making' | 'quantitative_reasoning' | 'situational_judgement'

export type TimeMode = 'off' | 'exam' | 'custom'

export type SetGeneratorInput = {
  sections: SectionKey[]
  unansweredOnly: boolean
  incorrectOnly: boolean
  /**
   * Difficulty range as a numeric band between 0 and 1 (inclusive).
   * These values are interpreted as UCAT question difficulty scores.
   */
  difficultyMin: number
  difficultyMax: number
  /**
   * Optional category IDs (question_stem_categories.id) to filter stems by.
   * When empty, all categories for the selected sections are included.
   */
  categoryIds: string[]
  /**
   * Time mode for the generated set:
   * - 'off'   → no time limit
   * - 'exam'  → UCAT exam timing based on section time_per_question
   * - 'custom' → user-specified time limit
   */
  timeMode: TimeMode
  /**
   * Custom time limit in minutes when timeMode === 'custom'.
   * Stored in minutes for easier UI input; server-side logic
   * should convert this to seconds when persisting.
   */
  customTimeMinutes: number | null
  questionCount: number
}

export type GeneratedPracticeSet = {
  id: string
  name: string
  questions: number
  estimatedMinutes: number
}
