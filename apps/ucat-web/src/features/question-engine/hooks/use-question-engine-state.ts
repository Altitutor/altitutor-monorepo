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
import {
  getStemBoundaries,
  isLastQuestionOfUnit,
} from '@/features/question-engine/lib/practice'

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
  syllogismSnapshots: {},
  showNavigator: false,
  showCalculator: false,
  showEndExamDialog: false,
  reviewFilter: null,
  reviewFilterIndex: 0,
  showReviewInstructionsDialog: false,
  showEndReviewDialog: false,
  viewingQuestionIndex: null,
  showExitResultsDialog: false,
}

export function useQuestionEngineState(
  exam: QuestionEngineExam | undefined,
  options?: { practice?: boolean }
) {
  const practice = options?.practice ?? false
  const mode = exam?.sourceType
  const isPracticeMode =
    practice && (mode === 'questions' || mode === 'questionStem')

  const [state, setState] = useState<QuestionEngineState>(initialState)

  const questions = useMemo(() => exam?.questions ?? [], [exam?.questions])

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
      state.flaggedIds,
      state.syllogismSnapshots
    )
  }, [
    state.phase,
    state.reviewFilter,
    state.visitedQuestionIds,
    state.selectedAnswers,
    state.flaggedIds,
    state.syllogismSnapshots,
    questions,
  ])

  const effectiveCurrentIndex =
    state.phase === 'practiceAnswer' && state.viewingQuestionIndex != null
      ? state.viewingQuestionIndex
      : state.phase === 'review' && state.reviewFilter && reviewFilterIndices.length > 0
        ? reviewFilterIndices[
            Math.min(state.reviewFilterIndex, reviewFilterIndices.length - 1)
          ] ?? state.currentIndex
        : state.currentIndex

  const currentQuestion = questions[effectiveCurrentIndex]
  const isLastQuestion =
    state.phase === 'practiceAnswer'
      ? (state.viewingQuestionIndex ?? 0) >= (state.practiceAnswerUnitEndIndex ?? 0)
      : state.phase === 'review' && state.reviewFilter
        ? state.reviewFilterIndex >= Math.max(reviewFilterIndices.length - 1, 0)
        : state.currentIndex >= Math.max(questions.length - 1, 0)

  const isLastQuestionOfCurrentUnit =
    isPracticeMode &&
    currentQuestion &&
    isLastQuestionOfUnit(questions, state.currentIndex, mode as 'questions' | 'questionStem')

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
          question,
          state.visitedQuestionIds,
          state.selectedAnswers,
          state.syllogismSnapshots
        ) as ReviewQuestionStatus,
        flagged: state.flaggedIds.includes(question.id),
      })),
    [questions, state.visitedQuestionIds, state.selectedAnswers, state.flaggedIds, state.syllogismSnapshots]
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
    if (state.phase === 'practiceAnswer') {
      const unitStart = state.practiceAnswerUnitStartIndex ?? 0
      const viewing = state.viewingQuestionIndex ?? 0
      if (viewing > unitStart) {
        setState((current) => ({
          ...current,
          viewingQuestionIndex: viewing - 1,
        }))
      }
      return
    }
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

    if (
      state.phase === 'question' &&
      state.currentIndex >= Math.max(questions.length - 1, 0) &&
      !isPracticeMode
    ) {
      setState((current) => ({
        ...current,
        phase: 'review',
        reviewFilter: null,
        reviewFilterIndex: 0,
        showNavigator: false,
      }))
      return
    }

    if (state.phase === 'practiceAnswer') {
      const unitEnd = state.practiceAnswerUnitEndIndex ?? 0
      const viewing = state.viewingQuestionIndex ?? 0
      if (viewing < unitEnd) {
        setState((current) => ({
          ...current,
          viewingQuestionIndex: viewing + 1,
        }))
      } else {
        const nextQuestionIndex = unitEnd + 1
        if (nextQuestionIndex >= questions.length) {
          setState((current) => ({
            ...current,
            phase: 'practiceComplete',
            currentIndex: nextQuestionIndex,
            viewingQuestionIndex: null,
            practiceAnswerUnitStartIndex: undefined,
            practiceAnswerUnitEndIndex: undefined,
          }))
        } else {
          setState((current) => ({
            ...current,
            phase: 'question',
            currentIndex: nextQuestionIndex,
            viewingQuestionIndex: null,
            practiceAnswerUnitStartIndex: undefined,
            practiceAnswerUnitEndIndex: undefined,
          }))
        }
      }
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

  function handlePracticeSubmit() {
    if (!isPracticeMode || !currentQuestion) return
    const { startIndex, endIndex } = getStemBoundaries(
      questions,
      state.currentIndex,
      mode as 'questions' | 'questionStem'
    )
    setState((current) => ({
      ...current,
      phase: 'practiceAnswer',
      practiceAnswerUnitStartIndex: startIndex,
      practiceAnswerUnitEndIndex: endIndex,
      viewingQuestionIndex: startIndex,
      showNavigator: false,
    }))
  }

  function startReviewFilter(filter: ReviewFilter) {
    const indices = getReviewFilterIndices(
      questions,
      filter,
      state.visitedQuestionIds,
      state.selectedAnswers,
      state.flaggedIds,
      state.syllogismSnapshots
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
      state.flaggedIds,
      state.syllogismSnapshots
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

  function setSyllogismSnapshot(
    questionId: string,
    snapshot: Record<string, boolean>
  ) {
    setState((current) => ({
      ...current,
      syllogismSnapshots: {
        ...(current.syllogismSnapshots ?? {}),
        [questionId]: snapshot,
      },
    }))
  }

  return {
    state,
    currentQuestion,
    questions,
    isLastQuestion,
    isLastQuestionOfCurrentUnit,
    isPracticeMode,
    submittedCount,
    effectiveCurrentIndex,
    reviewFilterIndices,
    reviewListRows,
    setState,
    goPrevious,
    goNext,
    handlePracticeSubmit,
    setQuestionByIndex,
    toggleFlagCurrent,
    toggleFlagById,
    setAnswer,
    setSyllogismSnapshot,
    goToReviewScreen,
    startReviewFilter,
    goToReviewQuestionByGlobalIndex,
  }
}
