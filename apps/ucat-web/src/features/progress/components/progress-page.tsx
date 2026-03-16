'use client'

import { UcatPageHeader } from '@/features/layout'
import { useProgress } from '../hooks/use-progress'
import { SectionProgressCards } from './section-progress-cards'
import { SetAttemptsCard } from './set-attempts-card'
import { MockAttemptsCard } from './mock-attempts-card'
import { QuestionAttemptsCard } from './question-attempts-card'

export function ProgressPage() {
  const { data, isLoading, error } = useProgress()

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

      <SectionProgressCards sections={data.sectionProgress} />
      <QuestionAttemptsCard
        attempts={data.questionAttempts}
        sections={data.sectionProgress.map((s) => ({
          id: s.sectionId,
          name: s.sectionName,
          sectionNumber: s.sectionNumber,
        }))}
      />
      <SetAttemptsCard attempts={data.setAttempts} />
      <MockAttemptsCard attempts={data.mockAttempts} />
    </div>
  )
}
