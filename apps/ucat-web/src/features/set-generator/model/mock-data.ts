import type { SectionKey } from './types'

export const sectionLabels: Record<SectionKey, string> = {
  verbal_reasoning: 'Verbal Reasoning',
  decision_making: 'Decision Making',
  quantitative_reasoning: 'Quantitative Reasoning',
  situational_judgement: 'Situational Judgement',
}

export const SECTION_KEY_TO_NUMBER: Record<SectionKey, number> = {
  verbal_reasoning: 1,
  decision_making: 2,
  quantitative_reasoning: 3,
  situational_judgement: 4,
}
