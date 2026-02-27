'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import type {
  QuestionEngineExam,
  QuestionEngineMode,
  QuestionEngineState,
  QuestionItem,
} from '@/features/question-engine/model/types'

type CreateMockAttemptResponse = {
  id: string
}

type CreateSetAttemptResponse = {
  id: string
}

type UpsertQuestionAttemptInput = {
  studentQuestionSetAttemptId: string | null
  questionId: string
  questionAnswerOptionId: string | null
  timeSpentSeconds?: number | null
  isFlagged?: boolean
}

type CompleteSetAttemptInput = {
  studentQuestionSetAttemptId: string
}

type CompleteMockAttemptInput = {
  studentMockAttemptId: string
}

type SetAttemptState = {
  mockAttemptId: string | null
  setAttemptIdsBySetId: Map<string, string>
}

function findQuestion(exam: QuestionEngineExam | undefined, questionId: string): QuestionItem | undefined {
  if (!exam) return undefined
  return exam.questions.find((q) => q.id === questionId)
}

export function useQuestionEnginePersistence({
  mode,
  exam,
  state,
}: {
  mode: QuestionEngineMode
  exam: QuestionEngineExam | undefined
  state: QuestionEngineState
}) {
  const isStudentEngine = true

  const attemptStateRef = useRef<SetAttemptState>({
    mockAttemptId: null,
    setAttemptIdsBySetId: new Map(),
  })

  const examSourceSetId = useMemo(() => {
    if (!exam) return null
    if (mode === 'set') {
      return exam.sourceId
    }
    return null
  }, [exam, mode])

  const createMockAttempt = useMutation<CreateMockAttemptResponse, Error, { mockId: string }>({
    mutationFn: async ({ mockId }) => {
      const response = await fetch('/api/ucat/mock-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mockId }),
      })
      if (!response.ok) {
        throw new Error('Failed to create mock attempt')
      }
      return response.json()
    },
  })

  const createSetAttempt = useMutation<CreateSetAttemptResponse, Error, { questionSetId: string; mockAttemptId?: string | null }>({
    mutationFn: async ({ questionSetId, mockAttemptId }) => {
      const response = await fetch('/api/ucat/set-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionSetId,
          mockAttemptId: mockAttemptId ?? null,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to create set attempt')
      }
      return response.json()
    },
  })

  const upsertQuestionAttempt = useMutation<unknown, Error, UpsertQuestionAttemptInput>({
    mutationFn: async (input) => {
      const response = await fetch('/api/ucat/question-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        throw new Error('Failed to upsert question attempt')
      }
      return response.json()
    },
  })

  const completeSetAttempt = useMutation<unknown, Error, CompleteSetAttemptInput>({
    mutationFn: async ({ studentQuestionSetAttemptId }) => {
      const response = await fetch(`/api/ucat/set-attempts/${studentQuestionSetAttemptId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ complete: true }),
      })
      if (!response.ok) {
        throw new Error('Failed to complete set attempt')
      }
      return response.json()
    },
  })

  const completeMockAttempt = useMutation<unknown, Error, CompleteMockAttemptInput>({
    mutationFn: async ({ studentMockAttemptId }) => {
      const response = await fetch(`/api/ucat/mock-attempts/${studentMockAttemptId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ complete: true }),
      })
      if (!response.ok) {
        throw new Error('Failed to complete mock attempt')
      }
      return response.json()
    },
  })

  useEffect(() => {
    if (!isStudentEngine) return
    if (!exam) return

    if (mode === 'set') {
      if (!examSourceSetId) return
      const existingSetAttemptId = attemptStateRef.current.setAttemptIdsBySetId.get(examSourceSetId)
      if (existingSetAttemptId || createSetAttempt.isPending) return

      createSetAttempt.mutate(
        { questionSetId: examSourceSetId, mockAttemptId: null },
        {
          onSuccess: (data) => {
            attemptStateRef.current.setAttemptIdsBySetId.set(examSourceSetId, data.id)
          },
        }
      )
      return
    }

    if (mode === 'mock') {
      if (!exam.sourceId) return
      if (attemptStateRef.current.mockAttemptId || createMockAttempt.isPending) return

      createMockAttempt.mutate(
        { mockId: exam.sourceId },
        {
          onSuccess: (data) => {
            attemptStateRef.current.mockAttemptId = data.id
          },
        }
      )
    }
  }, [exam, examSourceSetId, mode, isStudentEngine, createSetAttempt, createMockAttempt])

  function ensureSetAttemptForQuestion(question: QuestionItem | undefined): string | null {
    if (!isStudentEngine) return null
    if (!exam || !question) return null

    const setId = question.questionSetId
    const existingId = attemptStateRef.current.setAttemptIdsBySetId.get(setId)
    if (existingId) return existingId

    if (mode === 'mock') {
      if (!attemptStateRef.current.mockAttemptId) {
        if (exam.sourceId && !createMockAttempt.isPending && !attemptStateRef.current.mockAttemptId) {
          createMockAttempt.mutate(
            { mockId: exam.sourceId },
            {
              onSuccess: (data) => {
                attemptStateRef.current.mockAttemptId = data.id
              },
            }
          )
        }
        return null
      }

      const mockAttemptId = attemptStateRef.current.mockAttemptId
      createSetAttempt.mutate(
        { questionSetId: setId, mockAttemptId },
        {
          onSuccess: (data) => {
            attemptStateRef.current.setAttemptIdsBySetId.set(setId, data.id)
          },
        }
      )
      return null
    }

    if (mode === 'set') {
      if (!createSetAttempt.isPending) {
        createSetAttempt.mutate(
          { questionSetId: setId, mockAttemptId: null },
          {
            onSuccess: (data) => {
              attemptStateRef.current.setAttemptIdsBySetId.set(setId, data.id)
            },
          }
        )
      }
      return null
    }

    return null
  }

  function recordAnswer(questionId: string, questionAnswerOptionId: string, isFlagged: boolean) {
    if (!isStudentEngine) return
    if (!exam) return

    if (mode === 'questionStem' || mode === 'questions') {
      upsertQuestionAttempt.mutate({
        studentQuestionSetAttemptId: null,
        questionId,
        questionAnswerOptionId,
        isFlagged,
      })
      return
    }

    const question = findQuestion(exam, questionId)
    if (!question) return

    const setAttemptIdExisting = attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId)
    const setAttemptId = setAttemptIdExisting ?? ensureSetAttemptForQuestion(question)
    if (!setAttemptId) return

    upsertQuestionAttempt.mutate({
      studentQuestionSetAttemptId: setAttemptId,
      questionId,
      questionAnswerOptionId,
      isFlagged,
    })
  }

  const questionTimingRef = useRef<{
    currentQuestionId: string | null
    startedAt: number | null
    accumulatedSecondsByQuestionId: Map<string, number>
  }>({
    currentQuestionId: null,
    startedAt: null,
    accumulatedSecondsByQuestionId: new Map(),
  })

  useEffect(() => {
    if (!isStudentEngine) return
    if (!exam) return
    if (state.phase !== 'question') return

    const questions = exam.questions
    if (!questions.length) return

    const currentQuestion = questions[state.currentIndex]
    if (!currentQuestion) return

    const timing = questionTimingRef.current
    const now = Date.now()

    if (timing.currentQuestionId && timing.startedAt != null && timing.currentQuestionId !== currentQuestion.id) {
      const elapsedSeconds = Math.max(0, Math.round((now - timing.startedAt) / 1000))
      const prevTotal = timing.accumulatedSecondsByQuestionId.get(timing.currentQuestionId) ?? 0
      const newTotal = prevTotal + elapsedSeconds
      timing.accumulatedSecondsByQuestionId.set(timing.currentQuestionId, newTotal)

          const prevAnswerOptionId = state.selectedAnswers[timing.currentQuestionId]
          const isFlagged = state.flaggedIds.includes(timing.currentQuestionId)
      if (prevAnswerOptionId) {
        const question = findQuestion(exam, timing.currentQuestionId)
        if (question) {
          const setAttemptIdExisting = attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId)
          const setAttemptId = setAttemptIdExisting ?? ensureSetAttemptForQuestion(question)
          if (setAttemptId) {
            upsertQuestionAttempt.mutate({
              studentQuestionSetAttemptId: setAttemptId,
              questionId: timing.currentQuestionId,
              questionAnswerOptionId: prevAnswerOptionId,
              timeSpentSeconds: newTotal,
              isFlagged,
            })
          }
        }
      }
    }

    if (timing.currentQuestionId !== currentQuestion.id) {
      timing.currentQuestionId = currentQuestion.id
      timing.startedAt = now
    } else if (timing.startedAt == null) {
      timing.startedAt = now
    }
  }, [state.currentIndex, state.phase, exam, isStudentEngine, state.selectedAnswers, ensureSetAttemptForQuestion, upsertQuestionAttempt])

  function handleExamCompleted() {
    if (!isStudentEngine) return
    if (!exam) return

    if (mode === 'questionStem' || mode === 'questions') {
      return
    }

    const setIds = new Set<string>()
    exam.questions.forEach((q) => setIds.add(q.questionSetId))

    setIds.forEach((setId) => {
      const setAttemptId = attemptStateRef.current.setAttemptIdsBySetId.get(setId)
      if (!setAttemptId) return

      completeSetAttempt.mutate({ studentQuestionSetAttemptId: setAttemptId })
    })

    if (mode === 'mock' && attemptStateRef.current.mockAttemptId) {
      completeMockAttempt.mutate({ studentMockAttemptId: attemptStateRef.current.mockAttemptId })
    }
  }

  return {
    recordAnswer,
    handleExamCompleted,
  }
}

