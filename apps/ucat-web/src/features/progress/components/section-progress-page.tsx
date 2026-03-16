'use client'

import { useMemo } from 'react'
import { UcatPageHeader } from '@/features/layout'
import { useProgress } from '../hooks/use-progress'
import { useProgressMode } from '../hooks/use-progress-mode'
import { ProgressModeSelector } from './progress-mode-selector'
import { SetAttemptsCard } from './set-attempts-card'
import { QuestionAttemptsCard } from './question-attempts-card'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { cn } from '@/lib/utils'
import {
  filterByTimeFrame,
  computeSingleSectionFromFiltered,
  computeCategoryProgressFromFiltered,
} from '../lib/progress-data-utils'
import type {
  SectionCategoryProgress,
  QuestionAttemptRow,
  SetAttemptRow,
} from '@/app/api/ucat/progress/route'

function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 10,
  className,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div
      className={cn(
        'relative inline-flex flex-col items-center justify-center',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-label={`${percentage}% progress`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums">{percentage}%</span>
      </div>
    </div>
  )
}

type SectionProgressPageProps = {
  sectionId: string
}

export function SectionProgressPage({ sectionId }: SectionProgressPageProps) {
  const { data, isLoading, error } = useProgress()
  const progressMode = useProgressMode()

  const { section, categoryProgress, filteredQuestionAttempts, filteredSetAttempts } =
    useMemo(() => {
      if (!data) {
        return {
          section: null,
          categoryProgress: [] as SectionCategoryProgress[],
          filteredQuestionAttempts: [] as QuestionAttemptRow[],
          filteredSetAttempts: [] as SetAttemptRow[],
        }
      }
      const { mode, timeFrameDays } = progressMode
      const filteredQA = data.questionAttempts.filter(
        (a) => a.ucatSectionId === sectionId
      )
      const filteredSA = data.setAttempts.filter(
        (a) => a.sectionId === sectionId
      )
      const timeFilteredQA = filterByTimeFrame(filteredQA, mode, timeFrameDays)
      const timeFilteredSA = filterByTimeFrame(filteredSA, mode, timeFrameDays)

      const baseSection = data.sectionProgress.find((s) => s.sectionId === sectionId)
      const section =
        mode === 'time_frame' && baseSection
          ? computeSingleSectionFromFiltered(
              timeFilteredQA,
              timeFilteredSA,
              baseSection
            )
          : baseSection ?? null
      if (!section) {
        return {
          section: null,
          categoryProgress: [] as SectionCategoryProgress[],
          filteredQuestionAttempts: filteredQA,
          filteredSetAttempts: filteredSA,
        }
      }

      const categoryProgress =
        mode === 'time_frame'
          ? computeCategoryProgressFromFiltered(
              timeFilteredQA,
              data.sectionCategoryProgress ?? {}
            )[sectionId] ?? []
          : data.sectionCategoryProgress?.[sectionId] ?? []

      return {
        section,
        categoryProgress,
        filteredQuestionAttempts: filteredQA,
        filteredSetAttempts: filteredSA,
      }
    }, [data, sectionId, progressMode])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Loading..."
          backHref="/progress"
          backLabel="Back to progress"
        />
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="Could not load your progress."
          backHref="/progress"
          backLabel="Back to progress"
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="No progress data available."
          backHref="/progress"
          backLabel="Back to progress"
        />
      </div>
    )
  }

  if (!section) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Section not found"
          description="This section could not be found."
          backHref="/progress"
          backLabel="Back to progress"
        />
      </div>
    )
  }

  const score =
    progressMode.mode === 'weighted'
      ? section.weightedAverageScaledScore
      : section.averageScaledScore
  const percentage =
    progressMode.mode === 'weighted' &&
    section.weightedAveragePercentage != null
      ? Math.round(section.weightedAveragePercentage)
      : section.percentage

  return (
    <SectionProgressContent
      section={section}
      score={score}
      percentage={percentage}
      totalPublicQuestions={section.totalPublicQuestions}
      filteredQuestionAttempts={filteredQuestionAttempts}
      filteredSetAttempts={filteredSetAttempts}
      categoryProgress={categoryProgress}
      progressMode={progressMode}
    />
  )
}

function SectionProgressContent({
  section,
  score,
  percentage,
  totalPublicQuestions,
  filteredQuestionAttempts,
  filteredSetAttempts,
  categoryProgress,
  progressMode,
}: {
  section: { sectionId: string; sectionName: string }
  score: number | null
  percentage: number
  totalPublicQuestions?: number
  filteredQuestionAttempts: QuestionAttemptRow[]
  filteredSetAttempts: SetAttemptRow[]
  categoryProgress: SectionCategoryProgress[]
  progressMode: ReturnType<typeof useProgressMode>
}) {
  const stats = useMemo(() => {
    const timeFiltered =
      progressMode.mode === 'time_frame'
        ? filterByTimeFrame(
            filteredQuestionAttempts,
            progressMode.mode,
            progressMode.timeFrameDays
          )
        : filteredQuestionAttempts
    let completed = 0
    let correct = 0
    for (const a of timeFiltered) {
      const maxPerQuestion = a.questionType === 'syllogism' ? 2 : 1
      completed += maxPerQuestion
      correct += a.score ?? 0
    }
    return {
      completed,
      correct,
      incorrect: completed - correct,
    }
  }, [
    filteredQuestionAttempts,
    progressMode.mode,
    progressMode.timeFrameDays,
  ])

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={section.sectionName}
        description={`Progress for ${section.sectionName}`}
        backHref="/progress"
        backLabel="Back to progress"
      />

      <ProgressModeSelector
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Scaled score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  score == null && 'text-muted-foreground'
                )}
              >
                {score != null ? Math.round(score) : '—'}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Percentage correct
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2">
                <CircularProgress
                  percentage={percentage}
                  className="text-accent"
                />
                <span className="text-sm text-muted-foreground tabular-nums">
                  {stats.correct} / {stats.completed} correct
                </span>
              </div>
              {categoryProgress.length > 0 ? (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Category breakdown
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {categoryProgress.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className="flex justify-between text-sm tabular-nums"
                      >
                        <span className="text-muted-foreground truncate mr-2">
                          {cat.categoryName}
                        </span>
                        <span className="shrink-0">
                          {cat.maxScore > 0
                            ? `${cat.correctScore} / ${cat.maxScore}`
                            : '—'}
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
                Total questions completed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="text-2xl font-bold tabular-nums">
                  {stats.completed}
                  {totalPublicQuestions != null
                    ? ` / ${totalPublicQuestions}`
                    : ''}
                </span>
                <span className="text-muted-foreground text-sm ml-1">
                  {totalPublicQuestions != null
                    ? 'of public questions'
                    : 'question attempts'}
                </span>
              </div>
              {categoryProgress.length > 0 ? (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Category breakdown
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {categoryProgress.map((cat) => (
                      <div
                        key={cat.categoryId}
                        className="flex justify-between text-sm tabular-nums"
                      >
                        <span className="text-muted-foreground truncate mr-2">
                          {cat.categoryName}
                        </span>
                        <span className="shrink-0">
                          {cat.totalPublicQuestions != null
                            ? `${cat.maxScore} / ${cat.totalPublicQuestions}`
                            : `${cat.maxScore} questions`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <QuestionAttemptsCard
        attempts={filteredQuestionAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <SetAttemptsCard
        attempts={filteredSetAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
    </div>
  )
}
