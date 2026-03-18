'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { UcatPageHeader } from '@/features/layout'
import { QuestionEnginePage } from '@/features/question-engine'
import type { QuestionStemWithQuestions } from '@/features/question-engine/model/types'
import { useStemFilters } from '@/features/set-generator/hooks/use-stem-filters'
import { StemFiltersPanel } from '@/features/set-generator/components/stem-filters-panel'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'

export function PracticePage() {
  const [stems, setStems] = useState<QuestionStemWithQuestions[] | null>(null)
  const filters = useStemFilters()

  const startMutation = useMutation({
    mutationFn: async (payload: SetGeneratorInput) => {
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
    onSuccess: (data) => {
      setStems(data.stems)
    },
  })

  const actionButton = (
    <button
      type="button"
      onClick={() => !startMutation.isPending && startMutation.mutate(filters.input)}
      disabled={startMutation.isPending}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground disabled:opacity-60"
    >
      {startMutation.isPending ? 'Loading…' : 'Start practice'}
    </button>
  )

  if (stems != null && stems.length > 0) {
    return (
      <QuestionEnginePage
        mode="questionStem"
        sourceId="practice"
        questionStems={stems}
        practice
      />
    )
  }

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
        onQuestionCountChange={filters.handleQuestionCountChange}
        onCustomTimeMinutesChange={filters.handleCustomTimeMinutesChange}
        actionButton={actionButton}
      />
    </div>
  )
}
