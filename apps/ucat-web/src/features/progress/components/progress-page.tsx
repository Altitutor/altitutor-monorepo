'use client'

import { useMemo } from 'react'
import { UcatPageHeader } from '@/features/layout'
import { useProgress } from '../hooks/use-progress'
import { useProgressMode } from '../hooks/use-progress-mode'
import { ProgressModeSelector } from './progress-mode-selector'
import { SectionProgressCards } from './section-progress-cards'
import { SetAttemptsCard } from './set-attempts-card'
import { MockAttemptsCard } from './mock-attempts-card'
import { PracticeAttemptsCard } from './practice-attempts-card'
import { QuestionAttemptsCard } from './question-attempts-card'
import {
  filterByTimeFrame,
  computeSectionProgressFromFiltered,
  getSharedDateRange,
  applyAttemptFilterToProgress,
} from '../lib/progress-data-utils'

export function ProgressPage() {
  const { data, isLoading, error } = useProgress()
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Progress" description="Loading your progress..." />
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
      <div className="space-y-6">
        <UcatPageHeader title="Progress" description="Could not load your progress." />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!data || !filteredData) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Progress" description="No progress data available." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Progress"
        description="Track your performance across sections, set attempts, and mock exams."
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
      />
      <PracticeAttemptsCard
        attempts={filteredData.practiceAttempts ?? []}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <MockAttemptsCard
        attempts={filteredData.mockAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
    </div>
  )
}
