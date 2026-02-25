export type QuestionEngineMode = 'set' | 'mock'

export type AnswerOption = {
  id: string
  index: number
  text: string
}

export type QuestionItem = {
  id: string
  index: number
  stemId: string
  sectionName: string
  stemText: string
  questionText: string
  questionType: 'multiple_choice' | 'syllogism'
  options: AnswerOption[]
}

export type QuestionEngineExam = {
  sourceType: QuestionEngineMode
  sourceId: string
  title: string
  questions: QuestionItem[]
}

export type QuestionEngineState = {
  phase: 'intro' | 'question'
  currentIndex: number
  flaggedIds: string[]
  selectedAnswers: Record<string, string>
  showNavigator: boolean
  showCalculator: boolean
  showEndExamDialog: boolean
}
