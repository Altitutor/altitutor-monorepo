'use client'

import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableSelect,
  SearchableSelectInline,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import { ChevronDown, Info } from 'lucide-react'
import type { SectionKey, TimeMode } from '@/features/set-generator/model/types'
import type { CategoryRow, PerformanceFilter } from '@/features/set-generator/hooks/use-stem-filters'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'

export type StemFiltersPanelProps = {
  input: SetGeneratorInput
  selectedSection: { id: string; number_of_questions: number | null } | null
  sectionCategories: CategoryRow[]
  selectedCategories: CategoryRow[]
  matchingCount: number | undefined
  maxQuestionsInSection: number
  selectedSectionLabel: string
  performanceFilter: PerformanceFilter
  previewTimeLabel: string
  sectionLabels: Record<SectionKey, string>
  onSectionChange: (section: SectionKey) => void
  onCategoryChange: (categories: CategoryRow[]) => void
  onPerformanceFilterChange: (mode: PerformanceFilter) => void
  onTimeModeChange: (mode: TimeMode) => void
  onTimeSpeedChange: (value: number) => void
  onQuestionCountChange: (value: number) => void
  onCustomTimeMinutesChange: (value: number | null) => void
  /** Action button (e.g. "Generate set" or "Start practice") */
  actionButton: React.ReactNode
}

export function StemFiltersPanel({
  input,
  selectedSection,
  sectionCategories,
  selectedCategories,
  matchingCount,
  maxQuestionsInSection,
  selectedSectionLabel,
  performanceFilter,
  previewTimeLabel,
  sectionLabels,
  onSectionChange,
  onCategoryChange,
  onPerformanceFilterChange,
  onTimeModeChange,
  onTimeSpeedChange,
  onQuestionCountChange,
  onCustomTimeMinutesChange,
  actionButton,
}: StemFiltersPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Section</Label>
            <p className="text-xs text-muted-foreground">
              UCAT section to include. The set will only contain questions from this section.
            </p>
          </div>
          <SearchableSelect<SectionKey>
            items={Object.keys(sectionLabels) as SectionKey[]}
            value={input.section}
            onValueChange={(item) => item && onSectionChange(item)}
            getItemLabel={(s) => sectionLabels[s]}
            getItemId={(s) => s}
            triggerClassName="w-full sm:w-48"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Category</Label>
            <p className="text-xs text-muted-foreground">
              Filter by question categories. Only categories for the selected section are shown. All
              categories are selected by default.
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
                onValueChange={onCategoryChange}
                getItemId={(c) => c.id}
                getItemLabel={(c) => c.name}
                searchPlaceholder="Search categories..."
                emptyMessage="No categories found"
                multiSelect
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Time</Label>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-0.5 text-xs">
              {(
                [
                  {
                    mode: 'off' as const,
                    label: 'Off',
                    tooltip: 'No time limit. Take as long as you need.',
                  },
                  {
                    mode: 'exam' as const,
                    label: 'Exam',
                    tooltip: 'Time limit matches UCAT pacing for this section.',
                  },
                  {
                    mode: 'speed' as const,
                    label: 'Speed',
                    tooltip:
                      'Scale exam timing. 1 = exam pace, 0.5 = 2× time, 0.1 = 10× time. Drag the slider to adjust.',
                  },
                  {
                    mode: 'custom' as const,
                    label: 'Custom',
                    tooltip:
                      'Set your own time limit. Defaults to the exam estimate when you switch.',
                  },
                ] as const
              ).map((item) => {
                const isActive = input.timeMode === item.mode
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => onTimeModeChange(item.mode)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                      isActive
                        ? 'bg-sidebar text-sidebar-foreground'
                        : 'text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex opacity-80 hover:opacity-100 cursor-help"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Info className="h-3 w-3" aria-hidden />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[240px]">
                            {item.tooltip}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </button>
                )
              })}
            </div>
            {input.timeMode === 'speed' ? (
              <div className="flex flex-col gap-1.5 w-full sm:w-48">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {(1 / (input.timeSpeedMultiplier ?? 1)).toFixed(1)}× time
                  </span>
                </div>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[input.timeSpeedMultiplier ?? 1]}
                  onValueChange={([v]) => onTimeSpeedChange(v)}
                />
              </div>
            ) : input.timeMode === 'custom' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={input.customTimeMinutes ?? ''}
                  onChange={(event) =>
                    onCustomTimeMinutesChange(
                      event.target.value === '' ? null : Number(event.target.value)
                    )
                  }
                  className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-right text-sm"
                />
                <span className="text-xs text-muted-foreground">minutes</span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label className="text-sm font-medium">Performance</Label>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-0.5 text-xs">
            {(
              [
                {
                  mode: 'any' as const,
                  label: 'Any',
                  tooltip: 'Include all questions regardless of your past attempts.',
                },
                {
                  mode: 'unanswered' as const,
                  label: 'Unanswered',
                  tooltip: "Only questions you haven't answered before.",
                },
                {
                  mode: 'incorrect' as const,
                  label: 'Incorrect',
                  tooltip: "Only questions you've got wrong before.",
                },
              ] as const
            ).map((item) => {
              const isActive = performanceFilter === item.mode
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => onPerformanceFilterChange(item.mode)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                    isActive
                      ? 'bg-sidebar text-sidebar-foreground'
                      : 'text-foreground hover:bg-muted/80'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex opacity-80 hover:opacity-100 cursor-help"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="h-3 w-3" aria-hidden />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[240px]">
                          {item.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <Label htmlFor="question-count" className="text-sm font-medium">
              Question count
            </Label>
            <p className="text-xs text-muted-foreground">
              Number of questions in the set (max {maxQuestionsInSection} for this section). Actual
              total may be lower if there aren&apos;t enough matching questions.
            </p>
          </div>
          <input
            id="question-count"
            type="number"
            min={1}
            max={maxQuestionsInSection}
            value={input.questionCount}
            onChange={(event) => onQuestionCountChange(Number(event.target.value))}
            className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-card text-card-foreground p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Preview
        </h2>
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
            <span className="font-medium">Questions:</span> {input.questionCount} / {matchingCount ?? '…'}
          </p>
          <p>
            <span className="font-medium">Time:</span> {previewTimeLabel}
          </p>
        </div>
        {actionButton}
      </section>
    </div>
  )
}
