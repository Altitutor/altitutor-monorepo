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
  return useQuery({
    queryKey: ['question-engine', mode, setId ?? null, mockId ?? null],
    queryFn: () => getQuestionEngineExam({ mode, setId, mockId }),
  })
}
