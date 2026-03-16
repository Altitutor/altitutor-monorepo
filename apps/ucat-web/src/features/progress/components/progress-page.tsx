'use client'

import { useProgress } from '../hooks/use-progress'
import { SectionProgressCards } from './section-progress-cards'
import { SetAttemptsCard } from './set-attempts-card'
import { MockAttemptsCard } from './mock-attempts-card'
import { QuestionAttemptsCard } from './question-attempts-card'
import { UcatPagePlaceholder } from '@altitutor/ui'

export function ProgressPage() {
  const { data, isLoading, error } = useProgress()

  if (isLoading) {
    return (
      <UcatPagePlaceholder title="Progress" description="Loading your progress...">
        <div className="animate-pulse space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-lg bg-muted"
              />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </UcatPagePlaceholder>
    )
  }

  if (error) {
    return (
      <UcatPagePlaceholder title="Progress" description="Could not load your progress.">
        <p className="text-sm text-destructive">{error.message}</p>
      </UcatPagePlaceholder>
    )
  }

  if (!data) {
    return (
      <UcatPagePlaceholder title="Progress" description="No progress data available." />
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">
          Track your performance across sections, set attempts, and mock exams.
        </p>
      </div>

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
