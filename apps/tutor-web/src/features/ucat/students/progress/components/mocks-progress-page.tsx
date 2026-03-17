'use client'

import { useMemo } from 'react'
import { UcatPageHeader } from '@/features/ucat/shared/components'
import { useProgress } from '../hooks/useProgress'
import { useProgressMode } from '../hooks/useProgressMode'
import { ProgressModeSelector } from './progress-mode-selector'
import { SectionProgressCards } from './section-progress-cards'
import { MockAttemptsCard } from './mock-attempts-card'
import {
  filterByTimeFrame,
  getSharedDateRange,
  computeSectionProgressFromMockAttempts,
} from '../lib/progress-data-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'

type MocksProgressPageProps = {
  studentId: string
  basePath: string
  studentName?: string
}

export function MocksProgressPage({
  studentId,
  basePath,
  studentName,
}: MocksProgressPageProps) {
  const { data, isLoading, error } = useProgress(studentId)
  const progressMode = useProgressMode()

  const filteredMockAttempts = useMemo(() => {
    if (!data?.mockAttempts) return []
    return filterByTimeFrame(
      data.mockAttempts,
      progressMode.mode,
      progressMode.timeFrameDays
    )
  }, [data, progressMode.mode, progressMode.timeFrameDays])

  const sectionProgress = useMemo(() => {
    if (!data) return []
    return computeSectionProgressFromMockAttempts(
      data.mockAttempts,
      data.setAttempts,
      data.sectionProgress,
      progressMode.mode,
      progressMode.timeFrameDays
    )
  }, [data, progressMode.mode, progressMode.timeFrameDays])

  const sharedDateRange = useMemo(() => {
    return getSharedDateRange(
      [],
      [],
      filteredMockAttempts,
      progressMode.mode,
      progressMode.timeFrameDays
    )
  }, [filteredMockAttempts, progressMode.mode, progressMode.timeFrameDays])

  const averageMockScore = useMemo(() => {
    const withScore = filteredMockAttempts.filter(
      (a) => a.scaledScore != null && a.scaledScore > 0
    )
    if (withScore.length === 0) return null
    const sum = withScore.reduce((s, a) => s + (a.scaledScore ?? 0), 0)
    return Math.round(sum / withScore.length)
  }, [filteredMockAttempts])

  const mocksCompleted = useMemo(() => {
    const uniqueMockIds = new Set(filteredMockAttempts.map((a) => a.ucatMockId))
    return uniqueMockIds.size
  }, [filteredMockAttempts])

  const title = studentName ? `Mock progress – ${studentName}` : 'Mock progress'
  const backHref = basePath
  const breadcrumbs = [
    { label: 'UCAT', href: '/ucat' },
    { label: 'Students', href: '/ucat/students' },
    { label: studentName ?? 'Student', href: basePath },
    { label: 'Progress', href: basePath },
    { label: 'Mocks' },
  ]

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <UcatPageHeader
          title={title}
          description="Loading mock progress..."
          backHref={backHref}
          backLabel="Back"
        />
        <div className="animate-pulse space-y-6">
          <div className="h-32 w-64 mx-auto rounded-xl bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <UcatPageHeader
          title={title}
          description="Could not load mock progress."
          backHref={backHref}
          backLabel="Back"
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 space-y-6">
        <UcatPageHeader
          title={title}
          description="No progress data available."
          backHref={backHref}
          backLabel="Back"
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <UcatPageHeader
        title={title}
        description={studentName ? `Track ${studentName}'s performance across mock exams.` : 'Track performance across mock exams.'}
        backHref={backHref}
        backLabel="Back"
        breadcrumbs={breadcrumbs}
      />

      <ProgressModeSelector
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
        showAttemptFilter={false}
      />

      <div className="flex flex-wrap justify-center gap-4">
        <Card className="w-full max-w-xs rounded-xl border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-center">
              Average mock score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-4xl font-bold tabular-nums text-center ${
                averageMockScore == null ? 'text-muted-foreground' : ''
              }`}
            >
              {averageMockScore != null ? averageMockScore : '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="w-full max-w-xs rounded-xl border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-center">
              Mocks completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tabular-nums text-center">
              {mocksCompleted}
              {data.totalPublicMocks != null
                ? ` / ${data.totalPublicMocks}`
                : ''}
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionProgressCards
        sections={sectionProgress}
        linkToSection
        basePath={basePath.replace(/\/mocks\/?$/, '')}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />

      <MockAttemptsCard
        attempts={data.mockAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
        basePath={basePath.replace(/\/mocks\/?$/, '')}
      />
    </div>
  )
}
