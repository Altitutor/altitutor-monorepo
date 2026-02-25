export type SyllogismStatement = {
  text: string
  isYes: boolean
}

export type QuestionOptionDraft = {
  answerText: string
  isAnswer: boolean
}

export function statementsToOptions(statements: SyllogismStatement[]): QuestionOptionDraft[] {
  return statements.map((statement) => ({
    answerText: statement.text,
    isAnswer: statement.isYes,
  }))
}

export function optionsToStatements(options: QuestionOptionDraft[]): SyllogismStatement[] {
  return options.map((option) => ({
    text: option.answerText,
    isYes: option.isAnswer,
  }))
}
