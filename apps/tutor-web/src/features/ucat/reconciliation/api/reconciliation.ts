export type StemWithNoCategory = {
  id: string
  sectionId: string
  sectionName: string
  stemText: unknown
  questions: Array<{ id: string; question_text: unknown; index: number }>
}

export type QuestionWithNoExplanation = {
  stemId: string
  stemText: unknown
  sectionId: string
  sectionName: string
  questionId: string
  questionText: unknown
  questionIndex: number
}

export type PrivateStemNotInSet = {
  id: string
  sectionId: string
  sectionName: string
  categoryName: string | null
  stemText: unknown
  questions: Array<{ id: string; question_text: unknown; index: number }>
}

export type SetReconciliationRow = {
  id: string
  name: string
  sectionDisplay: string
  stemCount: number
  questionCount: number
  timeLimitSeconds?: number | null
  sectionCount: number
  firstSectionNumber: number | null
  questionCountStatus: 'match' | 'mismatch'
  questionCountTooltip: string
  timeLimitStatus: 'match' | 'partial' | 'mismatch' | 'untimed'
  timeLimitTooltip: string
}

export type MockWithIncorrectSets = {
  id: string
  name: string
  setCount: number
  sets: Array<{ id: string; name: string }>
}

export type ReconciliationData = {
  stemsWithNoCategory: StemWithNoCategory[]
  questionsWithNoExplanation: QuestionWithNoExplanation[]
  privateStemsNotInSet: PrivateStemNotInSet[]
  setsWithIncorrectQuestionCount: SetReconciliationRow[]
  setsWithIncorrectTiming: SetReconciliationRow[]
  setsWithMultipleSections: SetReconciliationRow[]
  mocksWithIncorrectSets: MockWithIncorrectSets[]
}

export async function fetchReconciliationData(): Promise<ReconciliationData> {
  const res = await fetch('/api/ucat/reconciliation')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body.error as string) ?? 'Failed to fetch reconciliation data')
  }
  return res.json()
}
