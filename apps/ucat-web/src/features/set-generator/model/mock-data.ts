import type { GeneratedPracticeSet, SectionKey } from './types'

export const sectionLabels: Record<SectionKey, string> = {
  verbal_reasoning: 'Verbal Reasoning',
  decision_making: 'Decision Making',
  quantitative_reasoning: 'Quantitative Reasoning',
  situational_judgement: 'Situational Judgement',
}

export const generatedSetPreview: GeneratedPracticeSet = {
  id: 'set-preview-1',
  name: 'Adaptive Practice Set',
  questions: 22,
  estimatedMinutes: 28,
}
