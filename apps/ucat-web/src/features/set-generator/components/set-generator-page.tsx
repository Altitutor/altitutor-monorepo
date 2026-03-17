'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableSelect,
  SearchableSelectInline,
} from '@altitutor/ui'
import { ChevronDown } from 'lucide-react'
import { UcatPageHeader } from '@/features/layout'
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

type CategoryRow = {
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

/** Exam time in seconds for the selected section and question count. */
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
  customTimeMinutes: null,
  questionCount: DEFAULT_QUESTION_COUNT,
}

export function SetGeneratorPage() {
  const [input, setInput] = useState<SetGeneratorInput>(initialInput)
  const router = useRouter()

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
    queryKey: ['ucat', 'generated-sets', 'preview', input],
    queryFn: async () => {
      const response = await fetch('/api/ucat/generated-sets/preview', {
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

  useEffect(() => {
    if (maxQuestionsInSection < input.questionCount) {
      setInput((c) => ({ ...c, questionCount: Math.max(1, maxQuestionsInSection) }))
    }
  }, [maxQuestionsInSection, input.questionCount])

  const generateMutation = useMutation({
    mutationFn: async (payload: SetGeneratorInput) => {
      const response = await fetch('/api/ucat/generated-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  const selectedSectionLabel = sectionLabels[input.section]

  const handleSectionChange = (section: SectionKey) => {
    setInput((current) => ({ ...current, section, categoryIds: [] }))
  }

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

  type PerformanceFilter = 'any' | 'unanswered' | 'incorrect'

  const performanceFilter: PerformanceFilter = input.unansweredOnly
    ? 'unanswered'
    : input.incorrectOnly
      ? 'incorrect'
      : 'any'

  const handlePerformanceFilterChange = (mode: PerformanceFilter) => {
    setInput((current) => ({
      ...current,
      unansweredOnly: mode === 'unanswered',
      incorrectOnly: mode === 'incorrect',
    }))
  }

  const handleTimeModeChange = (mode: TimeMode) => {
    setInput((current) => {
      const defaultCustomMinutes =
        examTimeEstimateMinutes != null && examTimeEstimateMinutes > 0 ? examTimeEstimateMinutes : 60
      return {
        ...current,
        timeMode: mode,
        customTimeMinutes:
          mode === 'custom' ? (current.customTimeMinutes ?? defaultCustomMinutes) : null,
      }
    })
  }

  const handleQuestionCountChange = (value: number) => {
    const raw = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_QUESTION_COUNT
    const clamped = Math.min(raw, maxQuestionsInSection)
    setInput((current) => ({ ...current, questionCount: clamped }))
  }

  const handleGenerateClick = () => {
    if (generateMutation.isPending) return
    generateMutation.mutate(input)
  }

  const previewTimeLabel =
    input.timeMode === 'off'
      ? 'No time limit'
      : input.timeMode === 'exam'
        ? examTimeEstimateMinutes != null
          ? `${examTimeEstimateMinutes} min`
          : '—'
        : input.customTimeMinutes != null
          ? `${input.customTimeMinutes} min (custom)`
          : '—'

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Set Generator"
        description="Build a targeted practice set from section, timing, and performance filters."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filters</h2>

          {/* Section: dropdown, label + description left, control right */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5 min-w-0 flex-1">
              <Label className="text-sm font-medium">Section</Label>
              <p className="text-xs text-muted-foreground">
                UCAT section to include. The set will only contain questions from this section.
              </p>
            </div>
            <SearchableSelect<SectionKey>
              items={(Object.keys(sectionLabels) as SectionKey[])}
              value={input.section}
              onValueChange={(item) => item && handleSectionChange(item)}
              getItemLabel={(s) => sectionLabels[s]}
              getItemId={(s) => s}
              triggerClassName="w-full sm:w-48"
            />
          </div>

          {/* Category: multi-select, only enabled when section selected */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5 min-w-0 flex-1">
              <Label className="text-sm font-medium">Category</Label>
              <p className="text-xs text-muted-foreground">
                Filter by question categories. Only categories for the selected section are shown. All categories are selected by default.
              </p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-48 justify-between text-left font-normal"
                  disabled={!selectedSection}
                >
                  {!selectedSection ? (
                    'Select a section first'
                  ) : sectionCategories.length === 0 ? (
                    'No categories'
                  ) : input.categoryIds.length === 0 ? (
                    `All categories (${sectionCategories.length})`
                  ) : (
                    `${input.categoryIds.length} of ${sectionCategories.length} selected`
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <SearchableSelectInline<CategoryRow>
                  items={sectionCategories}
                  value={selectedCategories}
                  onValueChange={handleCategoryChange}
                  getItemId={(c) => c.id}
                  getItemLabel={(c) => c.name}
                  searchPlaceholder="Search categories..."
                  emptyMessage="No categories found"
                  multiSelect
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time: label + description left, toggle right */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5 min-w-0 flex-1">
              <Label className="text-sm font-medium">Time</Label>
              <p className="text-xs text-muted-foreground">
                Off: no time limit. Exam: time limit matches UCAT pacing. Custom: set your own limit (defaults to the exam estimate when you switch).
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
                {([
                  { mode: 'off', label: 'Off' },
                  { mode: 'exam', label: 'Exam' },
                  { mode: 'custom', label: 'Custom' },
                ] as const).map((item) => {
                  const isActive = input.timeMode === item.mode
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => handleTimeModeChange(item.mode)}
                      className={`px-3 py-1.5 rounded-md transition-colors ${
                        isActive
                          ? 'bg-sidebar text-sidebar-foreground'
                          : 'text-foreground hover:bg-muted/80'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
              {input.timeMode === 'custom' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={input.customTimeMinutes ?? ''}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        customTimeMinutes: event.target.value === '' ? null : Number(event.target.value),
                      }))
                    }
                    className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">minutes</span>
                </label>
              ) : null}
            </div>
          </div>

          {/* Performance: label left, control right */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5 min-w-0 flex-1">
              <Label className="text-sm font-medium">Performance</Label>
              <p className="text-xs text-muted-foreground">
                Any: include all questions. Unanswered: only questions you haven’t answered. Incorrect: only questions you’ve got wrong before.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
              {(
                [
                  { mode: 'any' as const, label: 'Any' },
                  { mode: 'unanswered' as const, label: 'Unanswered' },
                  { mode: 'incorrect' as const, label: 'Incorrect' },
                ] as const
              ).map((item) => {
                const isActive = performanceFilter === item.mode
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handlePerformanceFilterChange(item.mode)}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      isActive
                        ? 'bg-sidebar text-sidebar-foreground'
                        : 'text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Question count: label left, input right; max = section max */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5 min-w-0 flex-1">
              <Label htmlFor="question-count" className="text-sm font-medium">
                Question count
              </Label>
              <p className="text-xs text-muted-foreground">
                Number of questions in the set (max {maxQuestionsInSection} for this section). Actual total may be lower if there aren’t enough matching questions.
              </p>
            </div>
            <input
              id="question-count"
              type="number"
              min={1}
              max={maxQuestionsInSection}
              value={input.questionCount}
              onChange={(event) => handleQuestionCountChange(Number(event.target.value))}
              className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </section>

        {/* Preview + actions */}
        <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preview</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Section:</span> {selectedSectionLabel}
            </p>
            <p>
              <span className="font-medium">Categories:</span>{' '}
              {!selectedSection
                ? '—'
                : selectedCategories.length === 0
                  ? '—'
                  : selectedCategories.map((c) => c.name).join(', ')}
            </p>
            <p>
              <span className="font-medium">Questions:</span>{' '}
              {input.questionCount} / {matchingCount ?? '…'}
            </p>
            <p>
              <span className="font-medium">Time:</span> {previewTimeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={generateMutation.isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground disabled:opacity-60"
          >
            {generateMutation.isPending ? 'Generating…' : 'Generate set'}
          </button>
        </section>
      </div>
    </div>
  )
}
