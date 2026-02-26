'use client'

import { useQuery } from '@tanstack/react-query'
import { getQuestionEngineExam } from '@/features/question-engine/api/question-engine-api'
import type { QuestionEngineMode } from '@/features/question-engine/model/types'

export function useQuestionEngineData({
  mode,
  setId,
  mockId,
}: {
  mode: QuestionEngineMode
  setId?: string
  mockId?: string
}) {
  const isDbMode = mode === 'set' || mode === 'mock'

  return useQuery({
    queryKey: ['question-engine', mode, setId ?? null, mockId ?? null],
    queryFn: () => {
      if (!isDbMode) {
        throw new Error('getQuestionEngineExam is only supported for set and mock modes')
      }

      return getQuestionEngineExam({ mode, setId, mockId })
    },
    enabled: isDbMode,
  })
}
