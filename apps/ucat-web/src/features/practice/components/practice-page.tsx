'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { UcatPageHeader } from '@/features/layout'
import type { QuestionStemWithQuestions } from '@/features/question-engine/model/types'
import { useStemFilters } from '@/features/set-generator/hooks/use-stem-filters'
import { StemFiltersPanel } from '@/features/set-generator/components/stem-filters-panel'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'
import { setPracticeSession } from '@/features/practice/lib/session-storage'

export function PracticePage() {
  const router = useRouter()
  const filters = useStemFilters({
    timeControlType: 'perQuestion',
    showUnlimitedOption: true,
  })

  const startMutation = useMutation({
    mutationFn: async (payload: SetGeneratorInput & { unlimited?: boolean }) => {
      if (payload.unlimited) {
        return { unlimited: true as const, stems: [] }
      }
      const response = await fetch('/api/ucat/practice-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = body.error ?? 'Failed to load practice stems'
        throw new Error(message)
      }

      return (await response.json()) as {
        stems: QuestionStemWithQuestions[]
        questionCount: number
        totalMatchingQuestions: number
      }
    },
    onSuccess: (data, variables) => {
      const timePerQuestionSeconds =
        variables.timePerQuestionSeconds != null && variables.timePerQuestionSeconds > 0
          ? variables.timePerQuestionSeconds
          : null

      if ('unlimited' in data && data.unlimited) {
        setPracticeSession({
          mode: 'unlimited',
          filters: variables,
          timePerQuestionSeconds,
        })
      } else {
        setPracticeSession({
          mode: 'set',
          stems: data.stems,
          timePerQuestionSeconds,
        })
      }
      router.push('/practice/session')
    },
  })

  function handleStart() {
    const unlimited = filters.questionCountMode === 'unlimited'
    const payload = {
      ...filters.input,
      unlimited: unlimited || undefined,
    }
    startMutation.mutate(payload)
  }

  const actionButton = (
    <button
      type="button"
      onClick={() => !startMutation.isPending && handleStart()}
      disabled={startMutation.isPending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground disabled:opacity-60"
    >
      {startMutation.isPending ? 'Loading…' : 'Start practice'}
    </button>
  )

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Practice"
        description="Pick stems and practice in question stem mode. Answer each stem, see feedback immediately."
      />
      <StemFiltersPanel
        input={filters.input}
        selectedSection={filters.selectedSection}
        sectionCategories={filters.sectionCategories}
        selectedCategories={filters.selectedCategories}
        matchingCount={filters.matchingCount}
        maxQuestionsInSection={filters.maxQuestionsInSection}
        selectedSectionLabel={filters.selectedSectionLabel}
        performanceFilter={filters.performanceFilter}
        previewTimeLabel={filters.previewTimeLabel}
        sectionLabels={filters.sectionLabels}
        onSectionChange={filters.handleSectionChange}
        onCategoryChange={filters.handleCategoryChange}
        onPerformanceFilterChange={filters.handlePerformanceFilterChange}
        onTimeModeChange={filters.handleTimeModeChange}
        onTimeSpeedChange={filters.handleTimeSpeedChange}
        onQuestionCountChange={filters.handleQuestionCountChange}
        onCustomTimeMinutesChange={filters.handleCustomTimeMinutesChange}
        onTimePerQuestionChange={filters.handleTimePerQuestionChange}
        timeControlType="perQuestion"
        sectionTimePerQuestionSeconds={filters.sectionTimePerQuestionSeconds}
        showUnlimitedOption={filters.showUnlimitedOption}
        questionCountMode={filters.questionCountMode}
        onQuestionCountModeChange={filters.handleQuestionCountModeChange}
        actionButton={actionButton}
      />
    </div>
  )
}
