'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { sectionLabels, SECTION_KEY_TO_NUMBER } from '@/features/set-generator/model/mock-data'
import type { SectionKey, SetGeneratorInput, TimeMode } from '@/features/set-generator/model/types'

const DEFAULT_QUESTION_COUNT = 20

type SectionRow = {
  id: string
  section_number: number
  time_per_question: number | null
  number_of_questions: number | null
}

export type CategoryRow = {
  id: string
  name: string
  ucat_section_id: string
}

async function fetchSection(sectionNumber: number): Promise<SectionRow | null> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_sections')
    .select('id,section_number,time_per_question,number_of_questions')
    .eq('section_number', sectionNumber)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data ?? null) as SectionRow | null
}

async function fetchCategoriesBySection(sectionId: string): Promise<CategoryRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_question_stem_categories')
    .select('id,name,ucat_section_id')
    .eq('ucat_section_id', sectionId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryRow[]
}

function estimateExamTimeSeconds(
  section: SectionRow | null,
  questionCount: number
): number | null {
  if (!section?.time_per_question) return null
  const seconds = questionCount * section.time_per_question
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null
}

const initialInput: SetGeneratorInput = {
  section: 'verbal_reasoning',
  unansweredOnly: true,
  incorrectOnly: false,
  categoryIds: [],
  timeMode: 'exam',
  timeSpeedMultiplier: 1,
  customTimeMinutes: null,
  questionCount: DEFAULT_QUESTION_COUNT,
}

export type PerformanceFilter = 'any' | 'unanswered' | 'incorrect'

export type UseStemFiltersOptions = {
  /** API path for preview (matching count). Default: /api/ucat/generated-sets/preview */
  previewApiPath?: string
}

export function useStemFilters(options: UseStemFiltersOptions = {}) {
  const { previewApiPath = '/api/ucat/generated-sets/preview' } = options

  const [input, setInput] = useState<SetGeneratorInput>(initialInput)
  const sectionNumber = SECTION_KEY_TO_NUMBER[input.section]

  const { data: selectedSection = null } = useQuery({
    queryKey: ['ucat', 'sections', sectionNumber],
    queryFn: () => fetchSection(sectionNumber),
    enabled: Number.isFinite(sectionNumber),
  })

  const { data: sectionCategories = [] } = useQuery({
    queryKey: ['ucat', 'categories', selectedSection?.id],
    queryFn: () => fetchCategoriesBySection(selectedSection!.id),
    enabled: Boolean(selectedSection?.id),
  })

  const { data: matchingCount } = useQuery({
    queryKey: ['ucat', 'stem-filters-preview', input],
    queryFn: async () => {
      const response = await fetch(previewApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to fetch preview')
      }
      const data = (await response.json()) as { totalMatchingQuestions: number }
      return data.totalMatchingQuestions
    },
    enabled: Boolean(selectedSection?.id),
  })

  const examTimeEstimateSeconds = useMemo(
    () => estimateExamTimeSeconds(selectedSection, input.questionCount),
    [selectedSection, input.questionCount]
  )

  const examTimeEstimateMinutes =
    examTimeEstimateSeconds != null ? Math.round(examTimeEstimateSeconds / 60) : null

  const maxQuestionsInSection = selectedSection?.number_of_questions ?? 200

  const lastSyncedSectionRef = useRef<number | null>(null)

  useEffect(() => {
    const count = selectedSection?.number_of_questions
    if (
      selectedSection &&
      count != null &&
      count > 0 &&
      selectedSection.section_number === sectionNumber &&
      lastSyncedSectionRef.current !== sectionNumber
    ) {
      lastSyncedSectionRef.current = sectionNumber
      setInput((c) => ({ ...c, questionCount: Math.max(1, count) }))
    }
  }, [sectionNumber, selectedSection])

  useEffect(() => {
    if (maxQuestionsInSection < input.questionCount) {
      setInput((c) => ({ ...c, questionCount: Math.max(1, maxQuestionsInSection) }))
    }
  }, [maxQuestionsInSection, input.questionCount])

  const selectedSectionLabel = sectionLabels[input.section]

  const handleSectionChange = useCallback((section: SectionKey) => {
    setInput((current) => ({ ...current, section, categoryIds: [] }))
  }, [])

  const selectedCategories = useMemo(() => {
    if (input.categoryIds.length === 0) return sectionCategories
    return sectionCategories.filter((c) => input.categoryIds.includes(c.id))
  }, [sectionCategories, input.categoryIds])

  const handleCategoryChange = useCallback(
    (next: CategoryRow[]) => {
      setInput((current) => ({
        ...current,
        categoryIds:
          next.length === sectionCategories.length ? [] : next.map((c) => c.id),
      }))
    },
    [sectionCategories]
  )

  const performanceFilter: PerformanceFilter = input.unansweredOnly
    ? 'unanswered'
    : input.incorrectOnly
      ? 'incorrect'
      : 'any'

  const handlePerformanceFilterChange = useCallback((mode: PerformanceFilter) => {
    setInput((current) => ({
      ...current,
      unansweredOnly: mode === 'unanswered',
      incorrectOnly: mode === 'incorrect',
    }))
  }, [])

  const handleTimeModeChange = useCallback(
    (mode: TimeMode) => {
      setInput((current) => {
        const defaultCustomMinutes =
          examTimeEstimateMinutes != null && examTimeEstimateMinutes > 0
            ? examTimeEstimateMinutes
            : 60
        return {
          ...current,
          timeMode: mode,
          timeSpeedMultiplier:
            mode === 'speed'
              ? Math.min(1, Math.max(0.1, current.timeSpeedMultiplier ?? 1))
              : current.timeSpeedMultiplier ?? 1,
          customTimeMinutes:
            mode === 'custom' ? (current.customTimeMinutes ?? defaultCustomMinutes) : null,
        }
      })
    },
    [examTimeEstimateMinutes]
  )

  const handleTimeSpeedChange = useCallback((value: number) => {
    setInput((current) => ({
      ...current,
      timeSpeedMultiplier: Math.min(1, Math.max(0.1, value)),
    }))
  }, [])

  const handleQuestionCountChange = useCallback(
    (value: number) => {
      const raw =
        Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_QUESTION_COUNT
      const clamped = Math.min(raw, maxQuestionsInSection)
      setInput((current) => ({ ...current, questionCount: clamped }))
    },
    [maxQuestionsInSection]
  )

  const handleCustomTimeMinutesChange = useCallback((value: number | null) => {
    setInput((current) => ({ ...current, customTimeMinutes: value }))
  }, [])

  const speedTimeMinutes =
    examTimeEstimateMinutes != null && input.timeSpeedMultiplier > 0
      ? Math.round(examTimeEstimateMinutes / input.timeSpeedMultiplier)
      : null

  const previewTimeLabel =
    input.timeMode === 'off'
      ? 'No time limit'
      : input.timeMode === 'exam'
        ? examTimeEstimateMinutes != null
          ? `${examTimeEstimateMinutes} min`
          : '—'
        : input.timeMode === 'speed'
          ? speedTimeMinutes != null
            ? `${speedTimeMinutes} min (${(1 / input.timeSpeedMultiplier).toFixed(1)}×)`
            : '—'
          : input.customTimeMinutes != null
            ? `${input.customTimeMinutes} min (custom)`
            : '—'

  return {
    input,
    setInput,
    selectedSection,
    sectionCategories,
    selectedCategories,
    matchingCount,
    maxQuestionsInSection,
    examTimeEstimateMinutes,
    selectedSectionLabel,
    performanceFilter,
    previewTimeLabel,
    handleSectionChange,
    handleCategoryChange,
    handlePerformanceFilterChange,
    handleTimeModeChange,
    handleTimeSpeedChange,
    handleQuestionCountChange,
    handleCustomTimeMinutesChange,
    sectionLabels,
  }
}
