'use client'

import { UcatPageHeader } from '@/features/ucat/shared/components'
import { useProgress } from '../hooks/useProgress'
import { computeSectionProgressFromMockAttempts } from '../lib/progress-data-utils'
import { MockAttemptsCard } from './mock-attempts-card'

type MocksProgressPageProps = {
  studentId: string
  basePath: string
  studentName?: string
}

export function MocksProgressPage({
  studentId,
  basePath,
}: MocksProgressPageProps) {
  const { data, isLoading, error } = useProgress(studentId)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 py-8">
        <div className="h-[520px] bg-muted" />
        <div className="mx-auto grid max-w-[1400px] gap-4 px-5 sm:grid-cols-3 sm:px-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title="Mock progress"
          backHref={basePath}
          backLabel="Back to progress"
        />
        <p className="text-sm text-destructive">
          {error?.message ?? 'No progress data available.'}
        </p>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <MockAttemptsCard
        attempts={data.mockAttempts}
        sections={computeSectionProgressFromMockAttempts(
          data.mockAttempts,
          data.setAttempts,
          data.sectionProgress,
          'all_time',
          '30'
        )}
        basePath={basePath.replace(/\/mocks\/?$/, '')}
      />
    </div>
  )
}
