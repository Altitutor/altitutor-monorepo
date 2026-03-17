'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { useQuestionEngineData } from '@/features/question-engine/hooks/use-question-engine-data'
import { useRefreshedContentCache } from '@/features/question-engine/hooks/use-refreshed-content-cache'
import { ResultsQuestionViewer } from '@/features/question-engine/components/results-question-viewer'
import { computeMarkingResult } from '@/features/question-engine/components/marking-body'
import type { SetAttemptDetailResponse } from '@/app/api/ucat/progress/sets/[id]/route'

type SetAnswersCardProps = {
  questionSetId: string
  questionAttempts: SetAttemptDetailResponse['questionAttempts']
  initialQuestionIndex?: number
  onQuestionIndexChange?: (index: number) => void
}

export function SetAnswersCard({
  questionSetId,
  questionAttempts,
  initialQuestionIndex = 0,
  onQuestionIndexChange,
}: SetAnswersCardProps) {
  const { data: exam, isLoading, error } = useQuestionEngineData({
    mode: 'set',
    setId: questionSetId,
  })

  const { selectedAnswers, syllogismSnapshots } = useMemo(() => {
    const selected: Record<string, string> = {}
    const syllogism: Record<string, Record<string, boolean>> = {}
    for (const a of questionAttempts) {
      if (a.questionAnswerOptionId) {
        selected[a.questionId] = a.questionAnswerOptionId
      }
      if (a.answerSnapshot && Object.keys(a.answerSnapshot).length > 0) {
        syllogism[a.questionId] = a.answerSnapshot
      }
    }
    return { selectedAnswers: selected, syllogismSnapshots: syllogism }
  }, [questionAttempts])

  const [viewingIndex, setViewingIndex] = useState(initialQuestionIndex)

  const questions = useMemo(
    () => exam?.questions ?? [],
    [exam?.questions]
  )

  useEffect(() => {
    const clamped = Math.max(
      0,
      Math.min(initialQuestionIndex, Math.max(0, questions.length - 1))
    )
    setViewingIndex(clamped)
  }, [initialQuestionIndex, questions.length])

  const currentQuestion = questions[viewingIndex]
  const markingResult = useMemo(
    () =>
      questions.length > 0
        ? computeMarkingResult(questions, selectedAnswers, syllogismSnapshots)
        : null,
    [questions, selectedAnswers, syllogismSnapshots]
  )

  const points =
    markingResult && currentQuestion
      ? markingResult.rows[viewingIndex]?.points
      : undefined

  const getCachedContent = useRefreshedContentCache(questions, viewingIndex)

  const handlePrev = () => {
    const next = Math.max(0, viewingIndex - 1)
    setViewingIndex(next)
    onQuestionIndexChange?.(next)
  }

  const handleNext = () => {
    const next = Math.min(questions.length - 1, viewingIndex + 1)
    setViewingIndex(next)
    onQuestionIndexChange?.(next)
  }

  if (isLoading) {
    return (
      <Card className="overflow-hidden rounded-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading questions…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="overflow-hidden rounded-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load questions'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (questions.length === 0) {
    return (
      <Card className="overflow-hidden rounded-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No questions in this set.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Questions</CardTitle>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={viewingIndex <= 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label="Previous question"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[80px] text-center text-sm tabular-nums text-muted-foreground">
            {viewingIndex + 1} / {questions.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={viewingIndex >= questions.length - 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label="Next question"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="flex h-[480px] min-h-[200px] flex-col overflow-hidden rounded-lg border border-border bg-[#f8f9fa] p-4"
          onCopy={(e) => e.preventDefault()}
        >
          {currentQuestion && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ResultsQuestionViewer
                question={currentQuestion}
                selectedOptionId={selectedAnswers[currentQuestion.id]}
                correctOptionId={currentQuestion.correctOptionId}
                points={points}
                syllogismSnapshot={syllogismSnapshots[currentQuestion.id]}
                preloadedContent={getCachedContent(currentQuestion.id)}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
