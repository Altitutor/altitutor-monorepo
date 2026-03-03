import type { QuestionItem } from '@/features/question-engine/model/types'
import type { ReviewFilter } from '@/features/question-engine/model/types'

export type ReviewQuestionStatus = 'unseen' | 'incomplete' | 'complete'

export function getReviewQuestionStatus(
  questionId: string,
  visitedQuestionIds: string[],
  selectedAnswers: Record<string, string>
): ReviewQuestionStatus {
  const answered = Boolean(selectedAnswers[questionId])
  if (answered) return 'complete'
  const visited = visitedQuestionIds.includes(questionId)
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
  flaggedIds: string[]
): number[] {
  const indices: number[] = []
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const status = getReviewQuestionStatus(q.id, visitedQuestionIds, selectedAnswers)
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
  selectedAnswers: Record<string, string>
): number {
  return questions.filter(
    (q) => getReviewQuestionStatus(q.id, visitedQuestionIds, selectedAnswers) !== 'complete'
  ).length
}
