export type SectionKey =
  | "verbal_reasoning"
  | "decision_making"
  | "quantitative_reasoning"
  | "situational_judgement";

export type TimeMode = "off" | "exam" | "speed" | "custom";

export type PracticeSelectionInput = {
  section: SectionKey;
  unansweredOnly: boolean;
  incorrectOnly: boolean;
  /**
   * Optional category IDs (question_stem_categories.id) to filter stems by.
   * When empty, all categories for the selected sections are included.
   */
  categoryIds: string[];
  /**
   * Time mode for the generated set:
   * - 'off'   → no time limit
   * - 'exam'  → UCAT exam timing based on section time_per_question
   * - 'speed' → exam speed scaled by timeSpeedMultiplier (0.25–2); 1 = exam, 2 = double speed / half time
   * - 'custom' → user-specified time limit
   */
  timeMode: TimeMode;
  /**
   * Speed multiplier when timeMode === 'speed'. Range 0.25–2.
   * 1 = exam timing, 0.5 = half speed / double time, 2 = double speed / half time.
   */
  timeSpeedMultiplier: number;
  /**
   * Custom time limit in minutes when timeMode === 'custom'.
   * Stored in minutes for easier UI input; server-side logic
   * should convert this to seconds when persisting.
   */
  customTimeMinutes: number | null;
  questionCount: number;
  /**
   * Practice mode only. When true, ignore questionCount and fetch stems on demand.
   * Engine keeps loading more as the user progresses.
   */
  unlimited?: boolean;
  /**
   * Practice mode only. Seconds per question for timing. Null = untimed.
   * When set, each question (or stem = perQuestion × questions in stem) is timed.
   */
  timePerQuestionSeconds?: number | null;
};
