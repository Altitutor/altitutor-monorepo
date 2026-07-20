/** Section name for Situational Judgement (exact match, case-sensitive). */
export const SITUATIONAL_JUDGEMENT_SECTION_NAME = 'Situational Judgement'

/** Number of options required for SJT partial marking (A/B and C/D polarity groups). */
export const SJT_OPTION_COUNT = 4

/** Syllogism: points by correct count (out of 5). */
export const SYLLOGISM_POINTS: Record<number, number> = {
  5: 2,
  4: 1,
  3: 1,
  2: 0,
  1: 0,
  0: 0,
}

/** Scaled score range. */
export const SCALED_MIN = 300
export const SCALED_MAX = 900
export const SCALED_RANGE = SCALED_MAX - SCALED_MIN

/** Round scaled score to nearest multiple. */
export const SCALED_ROUND_TO = 10

/**
 * Active scoring profile for the 2026 UCAT ANZ cycle.
 *
 * The 2026 technical report is not available during the testing window, so the
 * provisional profile is calibrated from the latest complete (2025) UCAT form
 * statistics. Persist this identifier with scored attempts so future profiles
 * never silently change the meaning of historical results.
 */
export const UCAT_SCORING_MODEL = {
  version: 'ucat-anz-2026-provisional-v1',
  jurisdiction: 'anz',
  testCycle: 2026,
  evidenceCycle: 2025,
} as const
