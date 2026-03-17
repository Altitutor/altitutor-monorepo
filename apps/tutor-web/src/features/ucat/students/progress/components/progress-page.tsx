'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatStudentSummary } from '@/features/ucat/students/hooks/useUcatStudents'
import { useProgress } from '../hooks/useProgress'
import { useProgressMode } from '../hooks/useProgressMode'
import { ProgressModeSelector } from './progress-mode-selector'
import { SectionProgressCards } from './section-progress-cards'
import { SetAttemptsCard } from './set-attempts-card'
import { MockAttemptsCard } from './mock-attempts-card'
import { QuestionAttemptsCard } from './question-attempts-card'
import {
  filterByTimeFrame,
  computeSectionProgressFromFiltered,
  getSharedDateRange,
  applyAttemptFilterToProgress,
} from '../lib/progress-data-utils'

type ProgressPageProps = {
  studentId: string
  basePath: string
  studentName?: string
}

export function ProgressPage({
  studentId,
  basePath,
  studentName: studentNameProp,
}: ProgressPageProps) {
  const { data, isLoading, error } = useProgress(studentId)
  const { data: summary } = useUcatStudentSummary(studentId)
  const studentName = studentNameProp ?? (summary as { student_name?: string } | undefined)?.student_name
  const progressMode = useProgressMode()

  const filteredData = useMemo(() => {
    if (!data) return null
    return applyAttemptFilterToProgress(data, progressMode.attemptFilter)
  }, [data, progressMode.attemptFilter])

  const sectionProgress = useMemo(() => {
    if (!filteredData) return []
    const { mode, timeFrameDays } = progressMode
    if (mode !== 'time_frame') return filteredData.sectionProgress
    const filteredQA = filterByTimeFrame(
      filteredData.questionAttempts,
      mode,
      timeFrameDays
    )
    const filteredSA = filterByTimeFrame(
      filteredData.setAttempts,
      mode,
      timeFrameDays
    )
    return computeSectionProgressFromFiltered(
      filteredQA,
      filteredSA,
      filteredData.sectionProgress
    )
  }, [filteredData, progressMode])

  const sharedDateRange = useMemo(() => {
    if (!filteredData) return undefined
    return getSharedDateRange(
      filteredData.questionAttempts,
      filteredData.setAttempts,
      filteredData.mockAttempts,
      progressMode.mode,
      progressMode.timeFrameDays
    )
  }, [filteredData, progressMode.mode, progressMode.timeFrameDays])

  const title = studentName ? `Progress – ${studentName}` : 'Progress'
  const description = studentName
    ? `Track ${studentName}'s performance across sections, set attempts, and mock exams.`
    : 'Track performance across sections, set attempts, and mock exams.'

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <UcatPageHeader
          title={title}
          description="Loading progress..."
          backHref={basePath.split('/').slice(0, -1).join('/') || '/ucat/students'}
          backLabel="Back"
        />
        <div className="animate-pulse space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
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
          description="Could not load progress."
          backHref={basePath.split('/').slice(0, -1).join('/') || '/ucat/students'}
          backLabel="Back"
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data || !filteredData) {
    return (
      <div className="p-6 space-y-6">
        <UcatPageHeader
          title={title}
          description="No progress data available."
          backHref={basePath.split('/').slice(0, -1).join('/') || '/ucat/students'}
          backLabel="Back"
        />
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'UCAT', href: '/ucat' },
    { label: 'Students', href: '/ucat/students' },
    { label: studentName ?? 'Student', href: basePath },
    { label: 'Progress' },
  ]

  return (
    <div className="p-6 space-y-6">
      <UcatPageHeader
        title={title}
        description={description}
        backHref={basePath.split('/').slice(0, -1).join('/') || '/ucat/students'}
        backLabel="Back"
        breadcrumbs={breadcrumbs}
      />

      <ProgressModeSelector
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
        attemptFilter={progressMode.attemptFilter}
        onAttemptFilterChange={progressMode.onAttemptFilterChange}
      />

      <SectionProgressCards
        sections={sectionProgress}
        linkToSection
        basePath={basePath}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <QuestionAttemptsCard
        attempts={filteredData.questionAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
      <SetAttemptsCard
        attempts={filteredData.setAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
        basePath={basePath}
      />
      <div className="space-y-2">
        <div className="flex justify-end">
          <Link
            href={`${basePath}/mocks`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View mock progress →
          </Link>
        </div>
        <MockAttemptsCard
          attempts={filteredData.mockAttempts}
          mode={progressMode.mode}
          timeFrameDays={progressMode.timeFrameDays}
          sharedDateRange={sharedDateRange}
          basePath={basePath}
        />
      </div>
    </div>
  )
}
