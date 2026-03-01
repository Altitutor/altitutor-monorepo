export type QuestionEngineMode = 'set' | 'mock' | 'questionStem' | 'questions'

export type AnswerOption = {
  id: string
  index: number
  text: string
}

export type QuestionItem = {
  id: string
  index: number
  questionSetId: string
  stemId: string
  sectionName: string
  sectionDisplayColumns: 1 | 2
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

export type QuestionStemWithQuestions = {
  id: string
  questionSetId: string
  sectionName: string
  sectionDisplayColumns: 1 | 2
  stemText: string
  questions: {
    id: string
    index: number
    questionText: string
    questionType: 'multiple_choice' | 'syllogism'
    options: AnswerOption[]
  }[]
}

export function mapQuestionStemsToItems(stems: QuestionStemWithQuestions[]): QuestionItem[] {
  const items: QuestionItem[] = []
  let runningIndex = 0

  for (const stem of stems) {
    const sortedQuestions = [...stem.questions].sort((a, b) => a.index - b.index)

    for (const question of sortedQuestions) {
      const sortedOptions = [...question.options].sort((a, b) => a.index - b.index)

      items.push({
        id: question.id,
        index: runningIndex++,
        questionSetId: stem.questionSetId,
        stemId: stem.id,
        sectionName: stem.sectionName,
        sectionDisplayColumns: stem.sectionDisplayColumns,
        stemText: stem.stemText,
        questionText: question.questionText,
        questionType: question.questionType,
        options: sortedOptions,
      })
    }
  }

  return items
}

export type QuestionEngineQuestion = {
  id: string
  stemId: string
  sectionName: string
  sectionDisplayColumns: 1 | 2
  stemText: string
  questionText: string
  questionType: 'multiple_choice' | 'syllogism'
  options: AnswerOption[]
}

export function mapQuestionsToItems(questions: QuestionEngineQuestion[]): QuestionItem[] {
  return questions.map((question, index) => ({
    id: question.id,
    index,
    questionSetId: 'questions-mode',
    stemId: question.stemId,
    sectionName: question.sectionName,
    sectionDisplayColumns: question.sectionDisplayColumns,
    stemText: question.stemText,
    questionText: question.questionText,
    questionType: question.questionType,
    options: [...question.options].sort((a, b) => a.index - b.index),
  }))
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
