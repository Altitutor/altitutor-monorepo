import { useMemo } from 'react'
import { useReconciliationData } from '@/features/ucat/reconciliation/hooks/useReconciliation'

export type UcatReconciliationTabCounts = {
  questions: number
  sets: number
  mocks: number
}

export function useReconciliationTabCounts() {
  const query = useReconciliationData()

  const counts = useMemo((): UcatReconciliationTabCounts | undefined => {
    if (!query.data) return undefined
    const data = query.data
    return {
      questions:
        data.stemsWithNoCategory.length +
        data.questionsWithNoExplanation.length +
        data.untaggedQuestions.length +
        data.privateStemsNotInSet.length,
      sets:
        data.setsWithIncorrectQuestionCount.length +
        data.setsWithIncorrectTiming.length +
        data.setsWithMultipleSections.length,
      mocks: data.mocksWithIncorrectSets.length,
    }
  }, [query.data])

  return {
    counts,
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
  }
}
