export type SectionKey = 'verbal_reasoning' | 'decision_making' | 'quantitative_reasoning' | 'situational_judgement'

export type TimeMode = 'off' | 'exam' | 'speed' | 'custom'

export type SetGeneratorInput = {
  section: SectionKey
  unansweredOnly: boolean
  incorrectOnly: boolean
  /**
   * Optional category IDs (question_stem_categories.id) to filter stems by.
   * When empty, all categories for the selected sections are included.
   */
  categoryIds: string[]
  /**
   * Time mode for the generated set:
   * - 'off'   → no time limit
   * - 'exam'  → UCAT exam timing based on section time_per_question
   * - 'speed' → exam timing scaled by timeSpeedMultiplier (0.1–1); 1 = exam, 0.5 = 2× time, 0.1 = 10× time
   * - 'custom' → user-specified time limit
   */
  timeMode: TimeMode
  /**
   * Speed multiplier when timeMode === 'speed'. Range 0.1–1.
   * 1 = exam timing, 0.5 = double exam time, 0.1 = 10× exam time.
   */
  timeSpeedMultiplier: number
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
