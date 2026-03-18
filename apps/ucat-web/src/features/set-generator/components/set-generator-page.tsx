'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { UcatPageHeader } from '@/features/layout'
import { useStemFilters } from '@/features/set-generator/hooks/use-stem-filters'
import { StemFiltersPanel } from '@/features/set-generator/components/stem-filters-panel'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'

export function SetGeneratorPage() {
  const router = useRouter()
  const filters = useStemFilters()

  const generateMutation = useMutation({
    mutationFn: async (payload: SetGeneratorInput) => {
      const response = await fetch('/api/ucat/generated-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = body.error ?? 'Failed to generate practice set'
        throw new Error(message)
      }

      return (await response.json()) as {
        setId: string
        questionCount: number
        totalMatchingQuestions: number
        examTimeSeconds: number | null
      }
    },
    onSuccess: (data) => {
      router.push(`/sets/${encodeURIComponent(data.setId)}`)
    },
  })

  const actionButton = (
    <button
      type="button"
      onClick={() => !generateMutation.isPending && generateMutation.mutate(filters.input)}
      disabled={generateMutation.isPending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground disabled:opacity-60"
    >
      {generateMutation.isPending ? 'Generating…' : 'Generate set'}
    </button>
  )

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Set Generator"
        description="Build a targeted practice set from section, timing, and performance filters."
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
        actionButton={actionButton}
      />
    </div>
  )
}
