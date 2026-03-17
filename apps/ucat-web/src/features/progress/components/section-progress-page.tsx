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
  getBestAttemptPerQuestion,
  applyAttemptFilterToProgress,
  getSharedDateRange,
} from '../lib/progress-data-utils'
import type {
  SectionCategoryProgress,
  QuestionAttemptRow,
  SetAttemptRow,
} from '@/app/api/ucat/progress/route'

function CircularProgress({
  percentage,
  size = 120,
  strokeWidth,
  className,
  showLabel = true,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
  className?: string
  showLabel?: boolean
}) {
  const sw = strokeWidth ?? (size <= 56 ? 4 : 10)
  const radius = (size - sw) / 2
  const circumference = 2 * Math.PI * radius
  const capped = Math.min(100, Math.max(0, percentage))
  const offset = circumference - (capped / 100) * circumference

  return (
    <div
      className={cn(
        'relative inline-flex flex-col items-center justify-center shrink-0',
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
          strokeWidth={sw}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-semibold tabular-nums',
              size <= 56 ? 'text-xs' : 'text-lg'
            )}
          >
            {capped}%
          </span>
        </div>
      )}
    </div>
  )
}

type SectionProgressPageProps = {
  sectionId: string
}

export function SectionProgressPage({ sectionId }: SectionProgressPageProps) {
  const { data, isLoading, error } = useProgress()
  const progressMode = useProgressMode()

  const filteredData = useMemo(() => {
    if (!data) return null
    return applyAttemptFilterToProgress(data, progressMode.attemptFilter)
  }, [data, progressMode.attemptFilter])

  const { section, categoryProgress, filteredQuestionAttempts, filteredSetAttempts, sharedDateRange } =
    useMemo(() => {
      if (!filteredData) {
        return {
          section: null,
          categoryProgress: [] as SectionCategoryProgress[],
          filteredQuestionAttempts: [] as QuestionAttemptRow[],
          filteredSetAttempts: [] as SetAttemptRow[],
          sharedDateRange: undefined,
        }
      }
      const { mode, timeFrameDays } = progressMode
      const filteredQA = filteredData.questionAttempts.filter(
        (a) => a.ucatSectionId === sectionId
      )
      const filteredSA = filteredData.setAttempts.filter(
        (a) => a.sectionId === sectionId
      )
      const timeFilteredQA = filterByTimeFrame(filteredQA, mode, timeFrameDays)
      const timeFilteredSA = filterByTimeFrame(filteredSA, mode, timeFrameDays)

      const baseSection = filteredData.sectionProgress.find((s) => s.sectionId === sectionId)
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
          sharedDateRange: getSharedDateRange(
            filteredData.questionAttempts,
            filteredData.setAttempts,
            filteredData.mockAttempts,
            mode,
            timeFrameDays
          ),
        }
      }

      const categoryProgress =
        mode === 'time_frame'
          ? computeCategoryProgressFromFiltered(
              timeFilteredQA,
              filteredData.sectionCategoryProgress ?? {}
            )[sectionId] ?? []
          : filteredData.sectionCategoryProgress?.[sectionId] ?? []

      return {
        section,
        categoryProgress,
        filteredQuestionAttempts: filteredQA,
        filteredSetAttempts: filteredSA,
        sharedDateRange: getSharedDateRange(
          filteredData.questionAttempts,
          filteredData.setAttempts,
          filteredData.mockAttempts,
          mode,
          timeFrameDays
        ),
      }
    }, [filteredData, sectionId, progressMode])

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
      totalPublicSets={filteredData?.totalPublicSetsBySection?.[sectionId]}
      totalPublicUntimedSets={
        filteredData?.totalPublicUntimedSetsBySection?.[sectionId]
      }
      totalPublicTimedSets={
        filteredData?.totalPublicTimedSetsBySection?.[sectionId]
      }
      filteredQuestionAttempts={filteredQuestionAttempts}
      filteredSetAttempts={filteredSetAttempts}
      categoryProgress={categoryProgress}
      progressMode={progressMode}
      sharedDateRange={sharedDateRange}
    />
  )
}

function SectionProgressContent({
  section,
  score,
  percentage,
  totalPublicQuestions,
  totalPublicSets,
  totalPublicUntimedSets,
  totalPublicTimedSets,
  filteredQuestionAttempts,
  filteredSetAttempts,
  categoryProgress,
  progressMode,
  sharedDateRange,
}: {
  section: { sectionId: string; sectionName: string }
  score: number | null
  percentage: number
  totalPublicQuestions?: number
  totalPublicSets?: number
  totalPublicUntimedSets?: number
  totalPublicTimedSets?: number
  filteredQuestionAttempts: QuestionAttemptRow[]
  filteredSetAttempts: SetAttemptRow[]
  categoryProgress: SectionCategoryProgress[]
  progressMode: ReturnType<typeof useProgressMode>
  sharedDateRange?: ReturnType<typeof getSharedDateRange>
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
    const unique = getBestAttemptPerQuestion(timeFiltered)
    let completed = 0
    let correct = 0
    for (const a of unique) {
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

  const setsStats = useMemo(() => {
    const timeFiltered =
      progressMode.mode === 'time_frame'
        ? filterByTimeFrame(
            filteredSetAttempts,
            progressMode.mode,
            progressMode.timeFrameDays
          )
        : filteredSetAttempts
    const nonStudentGenerated = timeFiltered.filter((a) => !a.isStudentGenerated)
    const uniqueSetIds = new Set(nonStudentGenerated.map((a) => a.questionSetId))
    const untimedCompleted = new Set(
      nonStudentGenerated.filter((a) => !a.wasTimed).map((a) => a.questionSetId)
    )
    const timedCompleted = new Set(
      nonStudentGenerated.filter((a) => a.wasTimed).map((a) => a.questionSetId)
    )
    return {
      totalCompleted: uniqueSetIds.size,
      untimedCompleted: untimedCompleted.size,
      timedCompleted: timedCompleted.size,
    }
  }, [
    filteredSetAttempts,
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
        breadcrumbOverrides={{ 2: section.sectionName }}
      />

      <ProgressModeSelector
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
        attemptFilter={progressMode.attemptFilter}
        onAttemptFilterChange={progressMode.onAttemptFilterChange}
      />

      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <Card className="w-full max-w-xs rounded-xl border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-center">
                Scaled score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-4xl font-bold tabular-nums text-center',
                  score == null && 'text-muted-foreground'
                )}
              >
                {score != null ? Math.round(score) : '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-border">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-base font-medium text-muted-foreground">
                    Questions correct
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {stats.correct} / {stats.completed}
                  </span>
                </div>
                <CircularProgress
                  percentage={stats.completed > 0 ? percentage : 0}
                  size={48}
                  className="text-accent shrink-0"
                />
              </div>
              {categoryProgress.length > 0 ? (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Category breakdown
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(() => {
                      const catsWithAttempts = categoryProgress.filter(
                        (c) => c.maxScore > 0
                      )
                      const pct = (c: SectionCategoryProgress) =>
                        progressMode.mode === 'weighted' &&
                        c.weightedAveragePercentage != null
                          ? c.weightedAveragePercentage
                          : c.percentage
                      const best =
                        catsWithAttempts.length > 0
                          ? catsWithAttempts.reduce((a, b) =>
                              pct(a) >= pct(b) ? a : b
                            )
                          : null
                      const worst =
                        catsWithAttempts.length > 1
                          ? catsWithAttempts.reduce((a, b) =>
                              pct(a) <= pct(b) ? a : b
                            )
                          : null
                      return categoryProgress.map((cat) => (
                        <div
                          key={cat.categoryId}
                          className="flex justify-between items-center text-sm tabular-nums gap-2"
                        >
                          <span className="text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
                            {cat === best && (
                              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                Best
                              </span>
                            )}
                            {cat === worst && cat !== best && (
                              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                Worst
                              </span>
                            )}
                            {cat.categoryName}
                          </span>
                          <span className="shrink-0">
                            {cat.maxScore > 0
                              ? `${cat.correctScore} / ${cat.maxScore}`
                              : '—'}
                          </span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-base font-medium text-muted-foreground">
                    Total questions completed
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {stats.completed}
                    {progressMode.mode !== 'time_frame' &&
                    totalPublicQuestions != null
                      ? ` / ${totalPublicQuestions}`
                      : ''}
                  </span>
                </div>
                <CircularProgress
                  percentage={
                    totalPublicQuestions != null && totalPublicQuestions > 0
                      ? Math.round(
                          (stats.completed / totalPublicQuestions) * 100
                        )
                      : stats.completed > 0
                        ? 100
                        : 0
                  }
                  size={48}
                  className="text-accent shrink-0"
                />
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

          <Card className="rounded-xl border-border">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-base font-medium text-muted-foreground">
                    Total sets completed
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {setsStats.totalCompleted}
                    {progressMode.mode !== 'time_frame' &&
                    totalPublicSets != null
                      ? ` / ${totalPublicSets}`
                      : ''}
                  </span>
                </div>
                <CircularProgress
                  percentage={
                    totalPublicSets != null && totalPublicSets > 0
                      ? Math.round(
                          (setsStats.totalCompleted / totalPublicSets) * 100
                        )
                      : setsStats.totalCompleted > 0
                        ? 100
                        : 0
                  }
                  size={48}
                  className="text-accent shrink-0"
                />
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Breakdown
                </div>
                <div className="flex flex-col gap-1.5 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Untimed sets completed
                    </span>
                    <span className="shrink-0">
                      {setsStats.untimedCompleted}
                      {progressMode.mode !== 'time_frame' &&
                      totalPublicUntimedSets != null
                        ? ` / ${totalPublicUntimedSets}`
                        : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Timed sets completed
                    </span>
                    <span className="shrink-0">
                      {setsStats.timedCompleted}
                      {progressMode.mode !== 'time_frame' &&
                      totalPublicTimedSets != null
                        ? ` / ${totalPublicTimedSets}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <QuestionAttemptsCard
        attempts={filteredQuestionAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
      <SetAttemptsCard
        attempts={filteredSetAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
    </div>
  )
}
