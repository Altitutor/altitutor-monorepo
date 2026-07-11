import {
  SITUATIONAL_JUDGEMENT_SECTION_NAME,
  SJT_OPTION_COUNT,
} from './config'

export type SituationalJudgementMarkingOutcome = 'correct' | 'partial' | 'incorrect'

/**
 * Resolve the UCAT Situational Judgement outcome for the ordered four-option scale.
 * A/B share one polarity and C/D share the other; the non-exact option in the
 * same polarity group earns partial credit.
 */
export function getSituationalJudgementMarkingOutcome(params: {
  sectionName: string | null | undefined
  optionCount: number
  selectedIndex: number
  correctIndex: number
}): SituationalJudgementMarkingOutcome | null {
  const { sectionName, optionCount, selectedIndex, correctIndex } = params
  if (
    sectionName !== SITUATIONAL_JUDGEMENT_SECTION_NAME ||
    optionCount !== SJT_OPTION_COUNT ||
    selectedIndex < 0 ||
    correctIndex < 0
  ) {
    return null
  }
  if (selectedIndex === correctIndex) return 'correct'
  return Math.floor(selectedIndex / 2) === Math.floor(correctIndex / 2)
    ? 'partial'
    : 'incorrect'
}
