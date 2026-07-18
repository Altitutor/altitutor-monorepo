export type StemWithNoCategory = {
  id: string
  sectionId: string
  sectionName: string
  stemText: unknown
  questions: Array<{ id: string; question_text: unknown; index: number; answer_options?: Array<{ answer_text?: unknown }> }>
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

export type UntaggedQuestion = {
  stemId: string
  stemText: unknown
  sectionId: string
  sectionName: string
  questionId: string
  questionText: unknown
  questionIndex: number
  answerOptions?: Array<{ answer_text?: unknown }>
}

export type PrivateStemNotInSet = {
  id: string
  sectionId: string
  sectionName: string
  categoryId: string | null
  categoryName: string | null
  stemText: unknown
  questions: Array<{ id: string; question_text: unknown; index: number; answer_options?: Array<{ answer_text?: unknown }> }>
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

export type PotentialDuplicateStemSide = {
  id: string
  sectionId: string
  sectionName: string
  categoryId: string | null
  categoryName: string | null
  stemText: unknown
  isPrivate: boolean
  setNames: string[]
  questions: Array<{
    id: string
    question_text: unknown
    index: number
    answer_options?: Array<{ answer_text?: unknown; is_answer?: boolean | null }>
  }>
}

export type PotentialDuplicatePair = {
  id: string
  sectionId: string
  sectionName: string
  stemA: PotentialDuplicateStemSide
  stemB: PotentialDuplicateStemSide
  tokenRatio: number
  trigramRatio: number
  sharedTokenPreview: string[]
}

export type ReconciliationData = {
  stemsWithNoCategory: StemWithNoCategory[]
  questionsWithNoExplanation: QuestionWithNoExplanation[]
  untaggedQuestions: UntaggedQuestion[]
  privateStemsNotInSet: PrivateStemNotInSet[]
  potentialDuplicatePairs: PotentialDuplicatePair[]
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
