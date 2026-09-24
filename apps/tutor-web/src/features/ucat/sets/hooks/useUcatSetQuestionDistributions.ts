'use client'

import { useQueries } from '@tanstack/react-query'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { buildSetQuestionDistributions } from '@/features/ucat/sets/lib/set-question-distribution'

export function useUcatSetQuestionDistributions(stemIds: string[], enabled = true) {
  const queries = useQueries({
    queries: enabled
      ? stemIds.map((stemId) => ({
          queryKey: ucatKeys.question(stemId),
          queryFn: () => ucatQuestionsApi.getDetail(stemId),
        }))
      : [],
  })

  const isLoading = queries.some((query) => query.isLoading)
  const details = queries.flatMap((query) => {
    const detail = query.data
    if (!detail) return []
    return [{
      categoryName: detail.category_name,
      questions: detail.questions,
    }]
  })
  const distributions = buildSetQuestionDistributions(details)

  return { isLoading, distributions }
}
