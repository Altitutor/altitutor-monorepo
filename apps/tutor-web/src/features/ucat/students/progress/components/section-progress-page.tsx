'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@altitutor/ui'
import {
  sumCorrectScoreFromAttempts,
  sumProgressPointsFromAttempts,
  type SectionCategoryProgress,
} from '@altitutor/shared'
import { UcatPageHeader } from '@/features/ucat/shared/components'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { useProgress } from '../hooks/useProgress'
import { getBestAttemptPerQuestion } from '../lib/progress-data-utils'
import { StudentSectionProgressHero } from './student-section-progress-hero'
import { StudentAttemptHistoryExplorer } from './student-attempt-history-explorer'

type SectionProgressPageProps = {
  studentId: string
  sectionId: string
  basePath: string
  studentName?: string
}

function ProgressCircular({ percentage }: { percentage: number }) {
  const capped = Math.max(0, Math.min(100, percentage))
  const radius = 20
  const circumference = 2 * Math.PI * radius
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-12 shrink-0 -rotate-90 text-accent"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(capped)}
    >
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth="5"
      />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - capped / 100)}
      />
    </svg>
  )
}

export function SectionProgressPage({
  studentId,
  sectionId,
  basePath,
  studentName: _studentName,
}: SectionProgressPageProps) {
  const { data, isLoading, error } = useProgress(studentId)

  const section = data?.sectionProgress.find(
    (item) => item.sectionId === sectionId
  )
  const questionAttempts = useMemo(
    () =>
      data?.questionAttempts.filter(
        (attempt) => attempt.ucatSectionId === sectionId
      ) ?? [],
    [data?.questionAttempts, sectionId]
  )
  const setAttempts = useMemo(
    () =>
      data?.setAttempts.filter(
        (attempt) =>
          attempt.sectionId === sectionId && !attempt.studentUcatMockAttemptId
      ) ?? [],
    [data?.setAttempts, sectionId]
  )
  const categoryProgress = data?.sectionCategoryProgress?.[sectionId] ?? []

  const backHref = basePath

  if (isLoading) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title="Loading..."
          backHref={backHref}
          backLabel="Back to progress"
        />
        <div className="animate-pulse space-y-6">
          <div className="h-[520px] rounded-2xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-48 rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title="Progress"
          backHref={backHref}
          backLabel="Back to progress"
        />
        <p className="text-sm text-destructive">
          {error?.message ?? 'No progress data available.'}
        </p>
      </div>
    )
  }

  if (!section) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title="Section not found"
          backHref={backHref}
          backLabel="Back to progress"
        />
      </div>
    )
  }

  const uniqueQuestionAttempts = getBestAttemptPerQuestion(questionAttempts)
  const completedQuestions = sumProgressPointsFromAttempts(
    uniqueQuestionAttempts
  )
  const correctQuestions = sumCorrectScoreFromAttempts(uniqueQuestionAttempts)
  const projectionHistory = (data.scoreProjectionSnapshots ?? []).flatMap(
    (snapshot) => {
      const value = snapshot.sectionEstimates[sectionId]
      return value == null ? [] : [{ date: snapshot.date, value }]
    }
  )
  const latestProjection = data.scoreProjectionSnapshots?.at(-1)
  const score = latestProjection?.sectionEstimates[sectionId] ?? null
  const percentage = Math.round(section.percentage)
  const totalPublicQuestions = section.totalPublicQuestions
  const totalPublicSets = data.totalPublicSetsBySection?.[sectionId]
  const uniqueSets = new Set(
    setAttempts
      .filter((attempt) => !attempt.studentUcatMockAttemptId)
      .map((attempt) => attempt.questionSetId)
  )
  const untimedSets = new Set(
    setAttempts
      .filter(
        (attempt) => !attempt.studentUcatMockAttemptId && !attempt.wasTimed
      )
      .map((attempt) => attempt.questionSetId)
  )
  const timedSets = new Set(
    setAttempts
      .filter(
        (attempt) => !attempt.studentUcatMockAttemptId && attempt.wasTimed
      )
      .map((attempt) => attempt.questionSetId)
  )
  const questionCompletion =
    totalPublicQuestions && totalPublicQuestions > 0
      ? (completedQuestions / totalPublicQuestions) * 100
      : completedQuestions > 0
        ? 100
        : 0
  const setCompletion =
    totalPublicSets && totalPublicSets > 0
      ? (uniqueSets.size / totalPublicSets) * 100
      : uniqueSets.size > 0
        ? 100
        : 0
  const attemptedCategories = categoryProgress.filter(
    (category) => category.maxScore > 0
  )
  const bestCategory = attemptedCategories.reduce<
    SectionCategoryProgress | undefined
  >(
    (best, category) =>
      !best || category.percentage > best.percentage ? category : best,
    undefined
  )
  const weakestCategory = attemptedCategories.reduce<
    SectionCategoryProgress | undefined
  >(
    (weakest, category) =>
      !weakest || category.percentage < weakest.percentage ? category : weakest,
    undefined
  )

  return (
    <div className="space-y-6 pb-8">
      <StudentSectionProgressHero
        sectionName={section.sectionName}
        score={score}
        confidence={latestProjection?.confidence ?? null}
        projectionHistory={projectionHistory}
        percentage={percentage}
        attempts={setAttempts}
        categories={categoryProgress}
      />

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={tutorCardCn()}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-medium text-muted-foreground">
                    Questions correct
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {correctQuestions} / {completedQuestions}
                  </p>
                </div>
                <ProgressCircular
                  percentage={completedQuestions > 0 ? percentage : 0}
                />
              </div>
              {categoryProgress.length ? (
                <div className="space-y-1.5 border-t border-border/50 pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Category breakdown
                  </p>
                  {categoryProgress.map((category) => (
                    <div
                      key={category.categoryId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                        {category === bestCategory ? (
                          <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            Best
                          </span>
                        ) : null}
                        {category === weakestCategory &&
                        category !== bestCategory ? (
                          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            Worst
                          </span>
                        ) : null}
                        <span className="truncate">
                          {category.categoryName}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {category.maxScore > 0
                          ? `${category.correctScore} / ${category.maxScore}`
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className={tutorCardCn()}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-medium text-muted-foreground">
                    Total questions completed
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {completedQuestions}
                    {totalPublicQuestions != null
                      ? ` / ${totalPublicQuestions}`
                      : ''}
                  </p>
                </div>
                <ProgressCircular percentage={questionCompletion} />
              </div>
              {categoryProgress.length ? (
                <div className="space-y-1.5 border-t border-border/50 pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Category breakdown
                  </p>
                  {categoryProgress.map((category) => (
                    <div
                      key={category.categoryId}
                      className="flex justify-between gap-3 text-sm tabular-nums"
                    >
                      <span className="truncate text-muted-foreground">
                        {category.categoryName}
                      </span>
                      <span className="shrink-0">
                        {category.maxScore}
                        {category.totalPublicQuestions != null
                          ? ` / ${category.totalPublicQuestions}`
                          : ' questions'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className={tutorCardCn()}>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-medium text-muted-foreground">
                    Total sets completed
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {uniqueSets.size}
                    {totalPublicSets != null ? ` / ${totalPublicSets}` : ''}
                  </p>
                </div>
                <ProgressCircular percentage={setCompletion} />
              </div>
              <div className="space-y-1.5 border-t border-border/50 pt-3 text-sm tabular-nums">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Breakdown
                </p>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Untimed sets completed
                  </span>
                  <span>
                    {untimedSets.size}
                    {data.totalPublicUntimedSetsBySection?.[sectionId] != null
                      ? ` / ${data.totalPublicUntimedSetsBySection[sectionId]}`
                      : ''}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Timed sets completed
                  </span>
                  <span>
                    {timedSets.size}
                    {data.totalPublicTimedSetsBySection?.[sectionId] != null
                      ? ` / ${data.totalPublicTimedSetsBySection[sectionId]}`
                      : ''}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <StudentAttemptHistoryExplorer
        source="practice"
        title="Practice sessions"
        description="Accuracy and activity by day. Inspect the student's completed sessions."
        attempts={data.practiceAttempts.filter(
          (attempt) => attempt.ucatSectionId === sectionId
        )}
        basePath={basePath}
      />
      <StudentAttemptHistoryExplorer
        source="set"
        title="Set attempts"
        description="Scaled score, accuracy and timing across completed sets."
        attempts={setAttempts}
        basePath={basePath}
      />
    </div>
  )
}
