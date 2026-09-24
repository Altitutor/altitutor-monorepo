import { useMemo } from 'react'
import {
  usePotentialDuplicateStemsQueue,
  usePrivateStemsNotInSetQueue,
  useReconciliationData,
} from '@/features/ucat/reconciliation/hooks/useReconciliation'
import type { QuestionIssueSlug } from '@/features/ucat/reconciliation/lib/question-issue-definitions'
import type { SetIssueSlug } from '@/features/ucat/reconciliation/lib/set-issue-definitions'

const QUEUE_TOTAL_QUERY = { page: 1, pageSize: 1 } as const

export function useQuestionIssueCounts(): Partial<Record<QuestionIssueSlug, number>> {
  const reconciliationQuery = useReconciliationData()
  const privateQueueQuery = usePrivateStemsNotInSetQueue(QUEUE_TOTAL_QUERY)
  const duplicatesQuery = usePotentialDuplicateStemsQueue(QUEUE_TOTAL_QUERY)

  return useMemo(() => {
    const data = reconciliationQuery.data
    const counts: Partial<Record<QuestionIssueSlug, number>> = {}

    if (data) {
      counts['missing-category'] = data.stemsWithNoCategory.length
      counts['missing-explanation'] = data.questionsWithNoExplanation.length
      counts['downvoted-questions'] = data.downvotedQuestions.length
      counts['downvoted-explanations'] = data.downvotedExplanations.length
      counts.untagged = data.untaggedQuestions.length
      counts['in-multiple-sets'] = data.stemsInMultipleSets.length
    }

    if (privateQueueQuery.data) {
      counts['private-not-in-set'] = privateQueueQuery.data.total
    }

    if (duplicatesQuery.data) {
      counts.duplicates = duplicatesQuery.data.total
    }

    return counts
  }, [
    reconciliationQuery.data,
    privateQueueQuery.data,
    duplicatesQuery.data,
  ])
}

export function useSetIssueCounts(): Partial<Record<SetIssueSlug, number>> {
  const reconciliationQuery = useReconciliationData()

  return useMemo(() => {
    const data = reconciliationQuery.data
    if (!data) return {}
    return {
      'question-count': data.setsWithIncorrectQuestionCount.length,
      timing: data.setsWithIncorrectTiming.length,
      'multiple-sections': data.setsWithMultipleSections.length,
    }
  }, [reconciliationQuery.data])
}
