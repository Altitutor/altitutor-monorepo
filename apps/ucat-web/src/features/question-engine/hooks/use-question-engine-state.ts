'use client'

import { useMemo, useState } from 'react'
import type { QuestionEngineExam, QuestionEngineState } from '@/features/question-engine/model/types'

const initialState: QuestionEngineState = {
  phase: 'intro',
  currentIndex: 0,
  flaggedIds: [],
  selectedAnswers: {},
  showNavigator: false,
  showCalculator: false,
  showEndExamDialog: false,
}

export function useQuestionEngineState(exam: QuestionEngineExam | undefined) {
  const [state, setState] = useState<QuestionEngineState>(initialState)

  const questions = exam?.questions ?? []
  const currentQuestion = questions[state.currentIndex]
  const isLastQuestion = state.currentIndex >= Math.max(questions.length - 1, 0)

  const submittedCount = useMemo(
    () => Object.keys(state.selectedAnswers).length,
    [state.selectedAnswers]
  )

  function goPrevious() {
    if (state.phase === 'intro') {
      return
    }
    setState((current) => ({ ...current, currentIndex: Math.max(0, current.currentIndex - 1) }))
  }

  function goNext() {
    if (state.phase === 'intro') {
      setState((current) => ({ ...current, phase: 'question' }))
      return
    }

    if (isLastQuestion) {
      setState((current) => ({ ...current, showNavigator: true }))
      return
    }

    setState((current) => ({ ...current, currentIndex: current.currentIndex + 1 }))
  }

  function setQuestionByIndex(index: number) {
    setState((current) => ({ ...current, currentIndex: index, showNavigator: false, phase: 'question' }))
  }

  function toggleFlagCurrent() {
    if (!currentQuestion) {
      return
    }

    setState((current) => ({
      ...current,
      flaggedIds: current.flaggedIds.includes(currentQuestion.id)
        ? current.flaggedIds.filter((id) => id !== currentQuestion.id)
        : [...current.flaggedIds, currentQuestion.id],
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
    setState,
    goPrevious,
    goNext,
    setQuestionByIndex,
    toggleFlagCurrent,
    setAnswer,
  }
}
