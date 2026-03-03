'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  QuestionEngineExam,
  QuestionEngineState,
  ReviewFilter,
} from '@/features/question-engine/model/types'
import { getCurrentSegmentTimeLimitSeconds } from '@/features/question-engine/lib/timing'
import {
  getReviewFilterIndices,
  getReviewQuestionStatus,
  type ReviewQuestionStatus,
} from '@/features/question-engine/lib/review'

const initialState: QuestionEngineState = {
  phase: 'intro',
  instructionsIndex: 0,
  showReadyDialog: false,
  timerStartedAt: null,
  showTimeExpiredDialog: false,
  nextSegmentTimerStartedAt: null,
  currentIndex: 0,
  visitedQuestionIds: [],
  flaggedIds: [],
  selectedAnswers: {},
  showNavigator: false,
  showCalculator: false,
  showEndExamDialog: false,
  reviewFilter: null,
  reviewFilterIndex: 0,
  showReviewInstructionsDialog: false,
  showEndReviewDialog: false,
}

export function useQuestionEngineState(exam: QuestionEngineExam | undefined) {
  const [state, setState] = useState<QuestionEngineState>(initialState)

  const questions = exam?.questions ?? []

  // When exam loads with instructions, start in instructions phase (set/mock mode)
  useEffect(() => {
    if (
      !exam ||
      !('instructionsScreens' in exam) ||
      exam.instructionsScreens.length === 0
    ) {
      return
    }
    setState((prev) => {
      if (prev.phase !== 'intro' || prev.instructionsIndex !== 0 || prev.currentIndex !== 0) {
        return prev
      }
      const next: QuestionEngineState = { ...prev, phase: 'instructions', instructionsIndex: 0 }
      const timeLimit = getCurrentSegmentTimeLimitSeconds(exam, next)
      if (timeLimit != null && timeLimit > 0) {
        next.timerStartedAt = Date.now()
      }
      return next
    })
  }, [exam])

  const reviewFilterIndices = useMemo(() => {
    if (state.phase !== 'review' || !state.reviewFilter) return []
    return getReviewFilterIndices(
      questions,
      state.reviewFilter,
      state.visitedQuestionIds,
      state.selectedAnswers,
      state.flaggedIds
    )
  }, [
    state.phase,
    state.reviewFilter,
    state.visitedQuestionIds,
    state.selectedAnswers,
    state.flaggedIds,
    questions,
  ])

  const effectiveCurrentIndex =
    state.phase === 'review' && state.reviewFilter && reviewFilterIndices.length > 0
      ? reviewFilterIndices[
          Math.min(state.reviewFilterIndex, reviewFilterIndices.length - 1)
        ] ?? state.currentIndex
      : state.currentIndex

  const currentQuestion = questions[effectiveCurrentIndex]
  const isLastQuestion =
    state.phase === 'review' && state.reviewFilter
      ? state.reviewFilterIndex >= Math.max(reviewFilterIndices.length - 1, 0)
      : state.currentIndex >= Math.max(questions.length - 1, 0)

  const submittedCount = useMemo(
    () => Object.keys(state.selectedAnswers).length,
    [state.selectedAnswers]
  )

  const reviewListRows = useMemo(
    () =>
      questions.map((question, index) => ({
        question,
        index,
        status: getReviewQuestionStatus(
          question.id,
          state.visitedQuestionIds,
          state.selectedAnswers
        ) as ReviewQuestionStatus,
        flagged: state.flaggedIds.includes(question.id),
      })),
    [questions, state.visitedQuestionIds, state.selectedAnswers, state.flaggedIds]
  )

  useEffect(() => {
    if (state.phase !== 'question' && !(state.phase === 'review' && state.reviewFilter)) return
    const q = questions[effectiveCurrentIndex]
    if (!q || state.visitedQuestionIds.includes(q.id)) return
    setState((current) => ({
      ...current,
      visitedQuestionIds: [...current.visitedQuestionIds, q.id],
    }))
  }, [state.phase, state.reviewFilter, effectiveCurrentIndex, questions, state.visitedQuestionIds])

  function goPrevious() {
    if (state.phase === 'instructions') {
      if (state.instructionsIndex > 0) {
        setState((current) => ({ ...current, instructionsIndex: current.instructionsIndex - 1 }))
      }
      return
    }
    if (state.phase === 'intro') return
    if (state.phase === 'review' && state.reviewFilter) {
      if (state.reviewFilterIndex > 0) {
        const prevIndex = reviewFilterIndices[state.reviewFilterIndex - 1]
        setState((current) => ({
          ...current,
          reviewFilterIndex: current.reviewFilterIndex - 1,
          currentIndex: prevIndex ?? current.currentIndex,
        }))
      }
      return
    }
    setState((current) => ({ ...current, currentIndex: Math.max(0, current.currentIndex - 1) }))
  }

  function goNext() {
    if (state.phase === 'instructions' && exam) {
      const screens = ('instructionsScreens' in exam && exam.instructionsScreens) || []
      if (state.instructionsIndex < screens.length - 1) {
        setState((current) => ({ ...current, instructionsIndex: current.instructionsIndex + 1 }))
        return
      }
      setState((current) => ({ ...current, showReadyDialog: true }))
      return
    }

    if (state.phase === 'intro') {
      setState((current) => ({ ...current, phase: 'question' }))
      return
    }

    if (state.phase === 'question' && state.currentIndex >= Math.max(questions.length - 1, 0)) {
      setState((current) => ({
        ...current,
        phase: 'review',
        reviewFilter: null,
        reviewFilterIndex: 0,
        showNavigator: false,
      }))
      return
    }

    if (state.phase === 'review' && state.reviewFilter) {
      if (state.reviewFilterIndex < reviewFilterIndices.length - 1) {
        const nextIndex = reviewFilterIndices[state.reviewFilterIndex + 1]
        setState((current) => ({
          ...current,
          reviewFilterIndex: current.reviewFilterIndex + 1,
          currentIndex: nextIndex ?? current.currentIndex,
        }))
      } else {
        goToReviewScreen()
      }
      return
    }

    if (state.phase === 'question') {
      setState((current) => ({ ...current, currentIndex: current.currentIndex + 1 }))
    }
  }

  function setQuestionByIndex(index: number) {
    setState((current) => ({
      ...current,
      currentIndex: index,
      showNavigator: false,
      phase: current.phase === 'review' ? 'review' : 'question',
    }))
  }

  function goToReviewScreen() {
    setState((current) => ({
      ...current,
      reviewFilter: null,
      reviewFilterIndex: 0,
    }))
  }

  function startReviewFilter(filter: ReviewFilter) {
    const indices = getReviewFilterIndices(
      questions,
      filter,
      state.visitedQuestionIds,
      state.selectedAnswers,
      state.flaggedIds
    )
    const firstIndex = indices[0] ?? 0
    setState((current) => ({
      ...current,
      reviewFilter: filter,
      reviewFilterIndex: 0,
      currentIndex: firstIndex,
    }))
  }

  function goToReviewQuestionByGlobalIndex(globalIndex: number) {
    const indices = getReviewFilterIndices(
      questions,
      'all',
      state.visitedQuestionIds,
      state.selectedAnswers,
      state.flaggedIds
    )
    const pos = indices.indexOf(globalIndex)
    const reviewFilterIndex = pos >= 0 ? pos : 0
    const index = indices[reviewFilterIndex] ?? globalIndex
    setState((current) => ({
      ...current,
      reviewFilter: 'all',
      reviewFilterIndex,
      currentIndex: index,
    }))
  }

  function toggleFlagCurrent() {
    if (!currentQuestion) return
    toggleFlagById(currentQuestion.id)
  }

  function toggleFlagById(questionId: string) {
    setState((current) => ({
      ...current,
      flaggedIds: current.flaggedIds.includes(questionId)
        ? current.flaggedIds.filter((id) => id !== questionId)
        : [...current.flaggedIds, questionId],
    }))
  }

  function setAnswer(optionId: string) {
    if (!currentQuestion) {
      return
    }

    setState((current) => ({
      ...current,
      selectedAnswers: {
        ...current.selectedAnswers,
        [currentQuestion.id]: optionId,
      },
    }))
  }

  return {
    state,
    currentQuestion,
    questions,
    isLastQuestion,
    submittedCount,
    effectiveCurrentIndex,
    reviewFilterIndices,
    reviewListRows,
    setState,
    goPrevious,
    goNext,
    setQuestionByIndex,
    toggleFlagCurrent,
    toggleFlagById,
    setAnswer,
    goToReviewScreen,
    startReviewFilter,
    goToReviewQuestionByGlobalIndex,
  }
}
