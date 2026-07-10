export type SituationalJudgementMarkingOutcome = 'correct' | 'partial' | 'incorrect'

/** Match UCAT SJ scoring: A/B share one polarity and C/D share the other. */
export function getSituationalJudgementMarkingOutcome(params: {
  sectionName: string | null | undefined
  optionCount: number
  selectedIndex: number
  correctIndex: number
}): SituationalJudgementMarkingOutcome | null {
  const { sectionName, optionCount, selectedIndex, correctIndex } = params
  if (
    sectionName !== 'Situational Judgement' ||
    optionCount !== 4 ||
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
