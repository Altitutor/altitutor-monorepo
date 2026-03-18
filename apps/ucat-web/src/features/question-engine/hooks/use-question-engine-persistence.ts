'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
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

type QuestionAttemptMode = 'question' | 'question_stem' | 'set' | 'mock'

type UpsertQuestionAttemptInput = {
  studentQuestionSetAttemptId: string | null
  studentPracticeSessionId?: string | null
  questionId: string
  questionAnswerOptionId: string | null
  answerSnapshot?: unknown
  timeSpentSeconds?: number | null
  isFlagged?: boolean
  wasTimed?: boolean
  mode?: QuestionAttemptMode
}

type CompleteSetAttemptInput = {
  studentQuestionSetAttemptId: string
}

type CompleteMockAttemptInput = {
  studentMockAttemptId: string
}

type CompletePracticeSessionInput = {
  sessionId: string
  scorePoints: number
  totalPoints: number
  questionCount: number
  stemsSnapshot: unknown
  questionScores: Array<{ questionId: string; score: number }>
}

type SetAttemptState = {
  mockAttemptId: string | null
  setAttemptIdsBySetId: Map<string, string>
}

function findQuestion(exam: QuestionEngineExam | undefined, questionId: string): QuestionItem | undefined {
  if (!exam) return undefined
  return exam.questions.find((q) => q.id === questionId)
}

function getWasTimedForSet(
  mode: QuestionEngineMode,
  exam: QuestionEngineExam | undefined,
  question: QuestionItem | undefined
): boolean {
  if (!exam) return false
  if (mode === 'set') {
    const limit = exam.setModeTiming?.setTimeLimitSeconds ?? 0
    return limit > 0
  }
  if (mode === 'mock' && exam.mockTimingSegments && question) {
    const segments = exam.mockTimingSegments
    const questionIndex = exam.questions.findIndex((q) => q.id === question.id)
    if (questionIndex < 0) return false
    const segment = segments.find(
      (s) =>
        s.type === 'questions' &&
        questionIndex >= s.questionStartIndex &&
        questionIndex <= s.questionEndIndex
    )
    if (!segment || segment.type !== 'questions') return false
    return (segment.timeLimitSeconds ?? 0) > 0
  }
  return false
}

function getWasTimedForSetId(
  mode: QuestionEngineMode,
  exam: QuestionEngineExam | undefined,
  questionSetId: string
): boolean {
  if (!exam) return false
  if (mode === 'set') {
    const limit = exam.setModeTiming?.setTimeLimitSeconds ?? 0
    return limit > 0
  }
  if (mode === 'mock' && exam.mockTimingSegments) {
    const firstQuestion = exam.questions.find((q) => q.questionSetId === questionSetId)
    if (!firstQuestion) return false
    const questionIndex = exam.questions.findIndex((q) => q.id === firstQuestion.id)
    if (questionIndex < 0) return false
    const segment = exam.mockTimingSegments.find(
      (s) =>
        s.type === 'questions' &&
        questionIndex >= s.questionStartIndex &&
        questionIndex <= s.questionEndIndex
    )
    if (!segment || segment.type !== 'questions') return false
    return (segment.timeLimitSeconds ?? 0) > 0
  }
  return false
}

function toDbMode(mode: QuestionEngineMode): QuestionAttemptMode {
  switch (mode) {
    case 'questionStem':
      return 'question_stem'
    case 'questions':
      return 'question'
    case 'set':
      return 'set'
    case 'mock':
      return 'mock'
    default:
      return 'question'
  }
}

export function useQuestionEnginePersistence({
  mode,
  exam,
  state,
  practiceSessionId,
}: {
  mode: QuestionEngineMode
  exam: QuestionEngineExam | undefined
  state: QuestionEngineState
  practiceSessionId?: string | null
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

  const createSetAttempt = useMutation<
    CreateSetAttemptResponse,
    Error,
    { questionSetId: string; mockAttemptId?: string | null; wasTimed?: boolean }
  >({
    mutationFn: async ({ questionSetId, mockAttemptId, wasTimed }) => {
      const response = await fetch('/api/ucat/set-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionSetId,
          mockAttemptId: mockAttemptId ?? null,
          wasTimed: wasTimed ?? false,
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

  type SetAttemptResponse = { success?: boolean; earnedDiscount?: boolean; discountCents?: number }
  const completeSetAttempt = useMutation<SetAttemptResponse, Error, CompleteSetAttemptInput>({
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
      return response.json() as Promise<SetAttemptResponse>
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

  type PracticeSessionResponse = { success?: boolean; earnedDiscount?: boolean; discountCents?: number }
  const completePracticeSession = useMutation<
    PracticeSessionResponse,
    Error,
    CompletePracticeSessionInput
  >({
    mutationFn: async (input) => {
      const response = await fetch(
        `/api/ucat/practice-sessions/${input.sessionId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            complete: true,
            scorePoints: input.scorePoints,
            totalPoints: input.totalPoints,
            questionCount: input.questionCount,
            stemsSnapshot: input.stemsSnapshot,
            questionScores: input.questionScores,
          }),
        }
      )
      if (!response.ok) {
        throw new Error('Failed to complete practice session')
      }
      return response.json() as Promise<PracticeSessionResponse>
    },
  })

  useEffect(() => {
    if (!isStudentEngine) return
    if (!exam) return

    if (mode === 'set') {
      if (!examSourceSetId) return
      const existingSetAttemptId = attemptStateRef.current.setAttemptIdsBySetId.get(examSourceSetId)
      if (existingSetAttemptId || createSetAttempt.isPending) return

      const wasTimed = getWasTimedForSetId(mode, exam, examSourceSetId)
      createSetAttempt.mutate(
        { questionSetId: examSourceSetId, mockAttemptId: null, wasTimed },
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

  const ensureSetAttemptForQuestion = useCallback(
    (question: QuestionItem | undefined): string | null => {
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
        const wasTimed = getWasTimedForSetId(mode, exam, setId)
        createSetAttempt.mutate(
          { questionSetId: setId, mockAttemptId, wasTimed },
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
          const wasTimed = getWasTimedForSetId(mode, exam, setId)
          createSetAttempt.mutate(
            { questionSetId: setId, mockAttemptId: null, wasTimed },
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
    },
    [exam, isStudentEngine, mode, createSetAttempt, createMockAttempt]
  )

  function recordAnswer(questionId: string, questionAnswerOptionId: string, isFlagged: boolean) {
    if (!isStudentEngine) return
    if (!exam) return

    const question = findQuestion(exam, questionId)
    const isSyllogism = question?.questionType === 'syllogism'

    const inputBase: UpsertQuestionAttemptInput = {
      studentQuestionSetAttemptId: practiceSessionId ? null : null,
      studentPracticeSessionId: practiceSessionId ?? undefined,
      questionId,
      questionAnswerOptionId: isSyllogism ? null : questionAnswerOptionId,
      answerSnapshot: undefined,
      isFlagged,
    }

    if (isSyllogism) {
      const snapshot = (state as QuestionEngineState & {
        syllogismSnapshots?: Record<string, Record<string, boolean>>
      }).syllogismSnapshots?.[questionId]

      if (snapshot) {
        inputBase.answerSnapshot = {
          type: 'syllogism_v1',
          answers: Object.entries(snapshot).map(([optionId, value]) => ({
            question_answer_option_id: optionId,
            answer: value,
          })),
        }
      }
    }

    if (mode === 'questionStem' || mode === 'questions') {
      upsertQuestionAttempt.mutate({
        ...inputBase,
        wasTimed: false,
        mode: toDbMode(mode),
      })
      return
    }

    if (!question) return

    const setAttemptIdExisting = attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId)
    const setAttemptId = setAttemptIdExisting ?? ensureSetAttemptForQuestion(question)
    if (!setAttemptId) return

    const wasTimed = getWasTimedForSet(mode, exam, question)
    upsertQuestionAttempt.mutate({
      ...inputBase,
      studentQuestionSetAttemptId: setAttemptId,
      wasTimed,
      mode: toDbMode(mode),
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

    if (state.phase !== 'question') {
      const t = questionTimingRef.current
      if (t.currentQuestionId && t.startedAt != null) {
        const elapsedSeconds = Math.max(0, Math.round((Date.now() - t.startedAt) / 1000))
        const prevTotal = t.accumulatedSecondsByQuestionId.get(t.currentQuestionId) ?? 0
        const newTotal = prevTotal + elapsedSeconds
        const prevAnswerOptionId = state.selectedAnswers[t.currentQuestionId]
        const question = findQuestion(exam, t.currentQuestionId)
        const syllogismSnapshot = (state as QuestionEngineState & {
          syllogismSnapshots?: Record<string, Record<string, boolean>>
        }).syllogismSnapshots?.[t.currentQuestionId]
        const hasSyllogismAnswer =
          question?.questionType === 'syllogism' &&
          syllogismSnapshot &&
          Object.keys(syllogismSnapshot).length > 0
        const setAttemptId = question
          ? attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId) ??
            ensureSetAttemptForQuestion(question)
          : null
        const canRecord =
          (prevAnswerOptionId || hasSyllogismAnswer) &&
          question &&
          (setAttemptId || practiceSessionId)

        if (canRecord) {
          const isFlagged = state.flaggedIds.includes(t.currentQuestionId)
          const isSyllogism = question.questionType === 'syllogism'
          const wasTimed = practiceSessionId
            ? false
            : getWasTimedForSet(mode, exam, question)
          const base: UpsertQuestionAttemptInput = {
            studentQuestionSetAttemptId: setAttemptId ?? null,
            studentPracticeSessionId: practiceSessionId ?? undefined,
            questionId: t.currentQuestionId,
            questionAnswerOptionId: isSyllogism ? null : (prevAnswerOptionId ?? null),
            timeSpentSeconds: newTotal,
            isFlagged,
            answerSnapshot: undefined,
            wasTimed,
            mode: toDbMode(mode),
          }
          if (isSyllogism && syllogismSnapshot) {
            base.answerSnapshot = {
              type: 'syllogism_v1',
              answers: Object.entries(syllogismSnapshot).map(([optionId, value]) => ({
                question_answer_option_id: optionId,
                answer: value,
              })),
            }
          }
          upsertQuestionAttempt.mutate(base)
        }
        t.currentQuestionId = null
        t.startedAt = null
      }
      return
    }

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
      const question = findQuestion(exam, timing.currentQuestionId)
      const syllogismSnapshot = (state as QuestionEngineState & {
        syllogismSnapshots?: Record<string, Record<string, boolean>>
      }).syllogismSnapshots?.[timing.currentQuestionId]
      const hasSyllogismAnswer = question?.questionType === 'syllogism' && syllogismSnapshot && Object.keys(syllogismSnapshot).length > 0
      const setAttemptIdExisting = question
        ? attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId)
        : undefined
      const setAttemptId = setAttemptIdExisting ?? (question ? ensureSetAttemptForQuestion(question) : null)
      const canRecord =
        (prevAnswerOptionId || hasSyllogismAnswer) &&
        question &&
        (setAttemptId || practiceSessionId)

      if (canRecord) {
        const isSyllogism = question.questionType === 'syllogism'
        const wasTimed = practiceSessionId
          ? false
          : getWasTimedForSet(mode, exam, question)
        const base: UpsertQuestionAttemptInput = {
          studentQuestionSetAttemptId: setAttemptId ?? null,
          studentPracticeSessionId: practiceSessionId ?? undefined,
            questionId: timing.currentQuestionId,
            questionAnswerOptionId: isSyllogism ? null : (prevAnswerOptionId ?? null),
            timeSpentSeconds: newTotal,
            isFlagged,
            answerSnapshot: undefined,
            wasTimed,
            mode: toDbMode(mode),
          }

          if (isSyllogism && syllogismSnapshot) {
            base.answerSnapshot = {
              type: 'syllogism_v1',
              answers: Object.entries(syllogismSnapshot).map(
                ([optionId, value]) => ({
                  question_answer_option_id: optionId,
                  answer: value,
                })
              ),
            }
          }

        upsertQuestionAttempt.mutate(base)
      }
    }

    if (timing.currentQuestionId !== currentQuestion.id) {
      timing.currentQuestionId = currentQuestion.id
      timing.startedAt = now
    } else if (timing.startedAt == null) {
      timing.startedAt = now
    }
  }, [
    state,
    exam,
    mode,
    isStudentEngine,
    practiceSessionId,
    ensureSetAttemptForQuestion,
    upsertQuestionAttempt,
  ])

  async function handleExamCompleted(): Promise<{
    earnedDiscount: boolean
    discountCents: number
  }> {
    if (!isStudentEngine) return { earnedDiscount: false, discountCents: 0 }
    if (!exam) return { earnedDiscount: false, discountCents: 0 }

    if (mode === 'questionStem' || mode === 'questions') {
      return { earnedDiscount: false, discountCents: 0 }
    }

    const t = questionTimingRef.current
    if (t.currentQuestionId && t.startedAt != null) {
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - t.startedAt) / 1000))
      const prevTotal = t.accumulatedSecondsByQuestionId.get(t.currentQuestionId) ?? 0
      const newTotal = prevTotal + elapsedSeconds
      const prevAnswerOptionId = state.selectedAnswers[t.currentQuestionId]
      const question = findQuestion(exam, t.currentQuestionId)
      const syllogismSnapshot = (state as QuestionEngineState & {
        syllogismSnapshots?: Record<string, Record<string, boolean>>
      }).syllogismSnapshots?.[t.currentQuestionId]
      const hasSyllogismAnswer =
        question?.questionType === 'syllogism' &&
        syllogismSnapshot &&
        Object.keys(syllogismSnapshot).length > 0
      const setAttemptId = question
        ? attemptStateRef.current.setAttemptIdsBySetId.get(question.questionSetId) ??
          ensureSetAttemptForQuestion(question)
        : null

      if ((prevAnswerOptionId || hasSyllogismAnswer) && question && setAttemptId) {
        const isFlagged = state.flaggedIds.includes(t.currentQuestionId)
        const isSyllogism = question.questionType === 'syllogism'
        const wasTimed = getWasTimedForSet(mode, exam, question)
        const base: UpsertQuestionAttemptInput = {
          studentQuestionSetAttemptId: setAttemptId,
          questionId: t.currentQuestionId,
          questionAnswerOptionId: isSyllogism ? null : (prevAnswerOptionId ?? null),
          timeSpentSeconds: newTotal,
          isFlagged,
          answerSnapshot: undefined,
          wasTimed,
          mode: toDbMode(mode),
        }
        if (isSyllogism && syllogismSnapshot) {
          base.answerSnapshot = {
            type: 'syllogism_v1',
            answers: Object.entries(syllogismSnapshot).map(([optionId, value]) => ({
              question_answer_option_id: optionId,
              answer: value,
            })),
          }
        }
        await upsertQuestionAttempt.mutateAsync(base)
      }
    }

    const setIds = new Set<string>()
    exam.questions.forEach((q) => setIds.add(q.questionSetId))

    for (const setId of setIds) {
      const existing = attemptStateRef.current.setAttemptIdsBySetId.get(setId)
      if (!existing) {
        const wasTimed = getWasTimedForSetId(mode, exam, setId)
        const data = await createSetAttempt.mutateAsync({
          questionSetId: setId,
          mockAttemptId: mode === 'mock' ? attemptStateRef.current.mockAttemptId : null,
          wasTimed,
        })
        attemptStateRef.current.setAttemptIdsBySetId.set(setId, data.id)
      }
    }

    const setAttemptIds = Array.from(setIds)
      .map((setId) => attemptStateRef.current.setAttemptIdsBySetId.get(setId))
      .filter((id): id is string => id != null)

    const setResults = await Promise.all(
      setAttemptIds.map((id) =>
        completeSetAttempt.mutateAsync({ studentQuestionSetAttemptId: id })
      )
    )

    if (mode === 'mock' && attemptStateRef.current.mockAttemptId) {
      await completeMockAttempt.mutateAsync({
        studentMockAttemptId: attemptStateRef.current.mockAttemptId,
      })
    }

    const earned = setResults.find((r) => r?.earnedDiscount)
    return {
      earnedDiscount: earned?.earnedDiscount ?? false,
      discountCents: earned?.discountCents ?? 0,
    }
  }

  function recordAnswersForUnit(startIndex: number, endIndex: number): void {
    if (!exam || !isStudentEngine) return
    const questions = exam.questions
    for (let i = startIndex; i <= endIndex; i++) {
      const q = questions[i]
      if (!q) continue
      const isFlagged = state.flaggedIds.includes(q.id)
      if (q.questionType === 'syllogism') {
        recordAnswer(q.id, '', isFlagged)
      } else {
        const optId = state.selectedAnswers[q.id] ?? ''
        recordAnswer(q.id, optId, isFlagged)
      }
    }
  }

  const attemptIds = useMemo(() => {
    if (!exam) return { setAttemptId: null as string | null, mockAttemptId: null as string | null }
    if (mode === 'set') {
      const id = attemptStateRef.current.setAttemptIdsBySetId.get(exam.sourceId) ?? null
      return { setAttemptId: id, mockAttemptId: null }
    }
    if (mode === 'mock') {
      return {
        setAttemptId: null,
        mockAttemptId: attemptStateRef.current.mockAttemptId,
      }
    }
    return { setAttemptId: null, mockAttemptId: null }
  }, [exam, mode])

  return {
    recordAnswer,
    recordAnswersForUnit,
    handleExamCompleted,
    completePracticeSession,
    attemptIds,
  }
}

