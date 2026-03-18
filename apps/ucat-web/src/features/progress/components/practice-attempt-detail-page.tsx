'use client'

import { useMemo, useState } from 'react'
import { UcatPageHeader } from '@/features/layout'
import { usePracticeAttemptDetail } from '../hooks/use-practice-attempt-detail'
import { SetAttemptAnalysisChart } from './set-attempt-analysis-chart'
import { SetAnswersCard } from './set-answers-card'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import {
  mapQuestionStemsToItems,
  type QuestionEngineExam,
  type QuestionStemWithQuestions,
} from '@/features/question-engine/model/types'

type PracticeAttemptDetailPageProps = {
  attemptId: string
  backHref?: string
  backLabel?: string
}

export function PracticeAttemptDetailPage({
  attemptId,
  backHref = '/progress',
  backLabel = 'Back to progress',
}: PracticeAttemptDetailPageProps) {
  const { data, isLoading, error } = usePracticeAttemptDetail(attemptId)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)

  const categoryBreakdown = useMemo(() => {
    const attempts = data?.questionAttempts ?? []
    const byCategory = new Map<
      string,
      { name: string; score: number; total: number }
    >()
    for (const q of attempts) {
      const catKey = q.questionStemCategoryId ?? '__uncategorized__'
      const catName = q.categoryName ?? 'Uncategorized'
      const maxScore = q.questionType === 'syllogism' ? 2 : 1
      const score = q.score ?? 0
      const entry = byCategory.get(catKey)
      if (entry) {
        entry.score += score
        entry.total += maxScore
      } else {
        byCategory.set(catKey, { name: catName, score, total: maxScore })
      }
    }
    return [...byCategory.entries()]
      .map(([, v]) => v)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data?.questionAttempts])

  const examFromStems = useMemo((): QuestionEngineExam | null => {
    const stems = data?.stemsSnapshot as QuestionStemWithQuestions[] | undefined
    if (!stems || !Array.isArray(stems) || stems.length === 0) return null
    return {
      sourceType: 'questionStem',
      sourceId: 'practice',
      title: data?.sectionName ?? 'Practice',
      questions: mapQuestionStemsToItems(stems),
      instructionsScreens: [],
    }
  }, [data?.stemsSnapshot, data?.sectionName])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Loading..."
          backHref={backHref}
          backLabel={backLabel}
        />
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Practice session"
          description="Could not load practice session."
          backHref={backHref}
          backLabel={backLabel}
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Practice session"
          description="No data available."
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    )
  }

  const total = data.totalPoints ?? 0
  const points = data.scorePoints ?? 0

  const questionAttemptsForChart = data.questionAttempts.map((q) => ({
    ...q,
    timeSpentSeconds: q.timeSpentSeconds,
  }))

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <UcatPageHeader
        title={data.sectionName ?? 'Practice session'}
        description={`Attempt from ${new Date(data.attemptedAt).toLocaleDateString()}`}
        backHref={backHref}
        backLabel={backLabel}
      />

      <Card className="rounded-xl border-border max-w-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Points
            </div>
            <div className="text-xl font-semibold tabular-nums">
              {total > 0 ? `${points} / ${total}` : '—'}
            </div>
          </div>
          {categoryBreakdown.length > 0 ? (
            <div className="mt-3 border-t border-border pt-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Category breakdown
              </div>
              <div className="flex flex-col gap-1.5">
                {categoryBreakdown.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex justify-between text-sm tabular-nums"
                  >
                    <span className="text-muted-foreground truncate mr-2">
                      {cat.name}
                    </span>
                    <span className="shrink-0">
                      {cat.total > 0 ? `${cat.score} / ${cat.total}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Question attempts
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          <SetAttemptAnalysisChart
            data={questionAttemptsForChart}
            selectedQuestionIndex={selectedQuestionIndex}
            onBarClick={(index) => setSelectedQuestionIndex(index)}
          />
        </CardContent>
      </Card>

      <SetAnswersCard
        questionAttempts={data.questionAttempts}
        exam={examFromStems}
        initialQuestionIndex={selectedQuestionIndex}
        onQuestionIndexChange={setSelectedQuestionIndex}
      />
    </div>
  )
}
