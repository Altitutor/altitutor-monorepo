'use client'

import { useMemo } from 'react'
import { UcatPageHeader } from '@/features/layout'
import { useProgress } from '../hooks/use-progress'
import { useProgressMode } from '../hooks/use-progress-mode'
import { ProgressModeSelector } from './progress-mode-selector'
import { SectionProgressCards } from './section-progress-cards'
import { SetAttemptsCard } from './set-attempts-card'
import { MockAttemptsCard } from './mock-attempts-card'
import { QuestionAttemptsCard } from './question-attempts-card'
import {
  filterByTimeFrame,
  computeSectionProgressFromFiltered,
} from '../lib/progress-data-utils'

export function ProgressPage() {
  const { data, isLoading, error } = useProgress()
  const progressMode = useProgressMode()

  const sectionProgress = useMemo(() => {
    if (!data) return []
    const { mode, timeFrameDays } = progressMode
    if (mode !== 'time_frame') return data.sectionProgress
    const filteredQA = filterByTimeFrame(
      data.questionAttempts,
      mode,
      timeFrameDays
    )
    const filteredSA = filterByTimeFrame(data.setAttempts, mode, timeFrameDays)
    return computeSectionProgressFromFiltered(
      filteredQA,
      filteredSA,
      data.sectionProgress
    )
  }, [data, progressMode])

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

  if (!data) {
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
      />

      <SectionProgressCards
        sections={sectionProgress}
        linkToSection
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <QuestionAttemptsCard
        attempts={data.questionAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <SetAttemptsCard
        attempts={data.setAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
      <MockAttemptsCard
        attempts={data.mockAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />
    </div>
  )
}
