'use client'

import { useMemo } from 'react'
import { UcatPageHeader } from '@/features/layout'
import { useSetAttemptDetail } from '../hooks/use-set-attempt-detail'
import { SetAttemptAnalysisChart } from './set-attempt-analysis-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { cn } from '@/lib/utils'

type SetAttemptDetailPageProps = {
  attemptId: string
  backHref?: string
  backLabel?: string
}

export function SetAttemptDetailPage({
  attemptId,
  backHref = '/progress',
  backLabel = 'Back to progress',
}: SetAttemptDetailPageProps) {
  const { data, isLoading, error } = useSetAttemptDetail(attemptId)

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
          title="Set attempt"
          description="Could not load set attempt."
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
          title="Set attempt"
          description="No data available."
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    )
  }

  const total = data.totalPoints ?? 0
  const points = data.scorePoints ?? 0

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={data.questionSetName ?? 'Set attempt'}
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
              Scaled score
            </div>
            <div
              className={cn(
                'text-3xl font-bold tabular-nums',
                data.scaledScore == null && 'text-muted-foreground'
              )}
            >
              {data.scaledScore != null ? Math.round(data.scaledScore) : '—'}
            </div>
          </div>
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

      <Card className="rounded-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Question attempts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SetAttemptAnalysisChart data={data.questionAttempts} />
        </CardContent>
      </Card>
    </div>
  )
}
