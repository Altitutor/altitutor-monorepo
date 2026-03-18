'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { UcatPageHeader } from '@/features/layout'
import { useStemFilters } from '@/features/set-generator/hooks/use-stem-filters'
import { StemFiltersPanel } from '@/features/set-generator/components/stem-filters-panel'
import { MyGeneratedSetsList } from '@/features/set-generator/components/my-generated-sets-list'
import { SECTION_KEY_TO_NUMBER } from '@/features/set-generator/model/mock-data'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'
import type { StudentSetRow } from '@/features/sets/api/sets-api'
import { useAttemptedSetIds, useSets } from '@/features/sets/hooks/use-sets'

function getSectionNumberFromSet(
  set: { sections?: Array<{ section_number?: number }> | null }
): number | null {
  const sections = Array.isArray(set.sections) ? set.sections : []
  const num = sections[0]?.section_number
  return typeof num === 'number' && num >= 1 && num <= 4 ? num : null
}

function isSetTimed(set: { time_limit_seconds: number | null }): boolean {
  return set.time_limit_seconds != null && set.time_limit_seconds > 0
}

export function SetGeneratorPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const filters = useStemFilters()
  const { data: sets } = useSets()
  const { data: attemptedSetIds = new Set<string>() } = useAttemptedSetIds()

  const [blockedState, setBlockedState] = useState<{
    setId: string
    sectionNumber: number
  } | null>(null)

  useEffect(() => {
    setBlockedState(null)
  }, [filters.input.section, filters.input.timeMode])

  const myGeneratedSets = useMemo(() => {
    if (!sets) return []
    return sets.filter((s) => s.is_student_generated === true)
  }, [sets])

  const canGenerate = useMemo(() => {
    const sectionNum = SECTION_KEY_TO_NUMBER[filters.input.section]
    const inputIsTimed = filters.input.timeMode !== 'off'
    const matchingUnattempted = myGeneratedSets.find((set: StudentSetRow) => {
      const setSection = getSectionNumberFromSet(set)
      const setTimed = isSetTimed(set)
      const unattempted = !attemptedSetIds.has(set.id)
      return (
        setSection === sectionNum &&
        setTimed === inputIsTimed &&
        unattempted
      )
    })
    return matchingUnattempted == null
  }, [filters.input.section, filters.input.timeMode, myGeneratedSets, attemptedSetIds])

  const blockingSet = useMemo(() => {
    if (canGenerate) return null
    const sectionNum = SECTION_KEY_TO_NUMBER[filters.input.section]
    const inputIsTimed = filters.input.timeMode !== 'off'
    return myGeneratedSets.find((set: StudentSetRow) => {
      const setSection = getSectionNumberFromSet(set)
      const setTimed = isSetTimed(set)
      const unattempted = !attemptedSetIds.has(set.id)
      return (
        setSection === sectionNum &&
        setTimed === inputIsTimed &&
        unattempted
      )
    }) ?? null
  }, [canGenerate, filters.input.section, filters.input.timeMode, myGeneratedSets, attemptedSetIds])

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
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['ucat', 'student-sets'] })
      await queryClient.refetchQueries({ queryKey: ['ucat', 'student-sets'] })
      router.push(`/sets/set-generator/${encodeURIComponent(data.setId)}`)
    },
  })

  const handleGenerateClick = () => {
    if (!canGenerate && blockingSet) {
      setBlockedState({
        setId: blockingSet.id,
        sectionNumber: SECTION_KEY_TO_NUMBER[filters.input.section],
      })
      return
    }
    setBlockedState(null)
    generateMutation.mutate(filters.input)
  }

  const actionButton = (
    <button
      type="button"
      onClick={() => !generateMutation.isPending && handleGenerateClick()}
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
      {blockedState && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          You have an unattempted {filters.selectedSectionLabel} set with the same timing. Complete it before generating another.
        </div>
      )}
      <MyGeneratedSetsList
        initialFilters={
          blockedState
            ? {
                sectionNumber: blockedState.sectionNumber,
                attempted: 'unattempted',
              }
            : undefined
        }
        scrollToSetId={blockedState?.setId ?? null}
      />
    </div>
  )
}
