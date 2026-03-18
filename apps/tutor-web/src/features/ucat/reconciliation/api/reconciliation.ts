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

export type ReconciliationData = {
  stemsWithNoCategory: StemWithNoCategory[]
  questionsWithNoExplanation: QuestionWithNoExplanation[]
}

export async function fetchReconciliationData(): Promise<ReconciliationData> {
  const res = await fetch('/api/ucat/reconciliation')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body.error as string) ?? 'Failed to fetch reconciliation data')
  }
  return res.json()
}
