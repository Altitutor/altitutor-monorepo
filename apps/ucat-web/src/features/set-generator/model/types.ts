export type SectionKey = 'verbal_reasoning' | 'decision_making' | 'quantitative_reasoning' | 'situational_judgement'

export type SetGeneratorInput = {
  sections: SectionKey[]
  unansweredOnly: boolean
  incorrectOnly: boolean
  difficultyMin: number
  difficultyMax: number
  questionCount: number
}

export type GeneratedPracticeSet = {
  id: string
  name: string
  questions: number
  estimatedMinutes: number
}
