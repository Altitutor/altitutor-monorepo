import type { QuestionItem } from '@/features/question-engine/model/types'
import type { ReviewFilter } from '@/features/question-engine/model/types'

export type ReviewQuestionStatus = 'unseen' | 'incomplete' | 'complete'

export function getReviewQuestionStatus(
  question: QuestionItem,
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>,
  syllogismSnapshots?: Record<string, Record<string, boolean>>
): ReviewQuestionStatus {
  if (question.questionType === 'syllogism') {
    const snapshot = syllogismSnapshots?.[question.id]
    const optionCount = question.options.length
    const answeredCount = snapshot ? Object.keys(snapshot).length : 0
    const allAnswered = optionCount > 0 && answeredCount >= optionCount
    if (allAnswered) return 'complete'
  } else {
    const answered = Boolean(selectedAnswers[question.id])
    if (answered) return 'complete'
  }

  const visited = visitedQuestionIds.includes(question.id)
  return visited ? 'incomplete' : 'unseen'
}

/**
 * Returns indices into questions array that match the given filter when in review mode.
 */
export function getReviewFilterIndices(
  questions: QuestionItem[],
  filter: ReviewFilter,
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>,
  flaggedIds: string[],
  syllogismSnapshots?: Record<string, Record<string, boolean>>
): number[] {
  const indices: number[] = []
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const status = getReviewQuestionStatus(
      q,
      visitedQuestionIds,
      selectedAnswers,
      syllogismSnapshots
    )
    const flagged = flaggedIds.includes(q.id)
    if (filter === 'all') {
      indices.push(i)
    } else if (filter === 'incomplete') {
      if (status === 'unseen' || status === 'incomplete') indices.push(i)
    } else {
      if (flagged) indices.push(i)
    }
  }
  return indices
}

export function getIncompleteCount(
  questions: QuestionItem[],
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>,
  syllogismSnapshots?: Record<string, Record<string, boolean>>
): number {
  return questions.filter(
    (q) =>
      getReviewQuestionStatus(q, visitedQuestionIds, selectedAnswers, syllogismSnapshots) !==
      'complete'
  ).length
}
