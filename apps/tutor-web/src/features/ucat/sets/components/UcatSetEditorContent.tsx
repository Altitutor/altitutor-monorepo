'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  getUcatVisibilityColor,
  Input,
  ListToolbar,
  SearchableSelect,
  Slider,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { Info, Pencil, Plus } from 'lucide-react'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applySingleSelectFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { formatSecondsToDuration, minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
import { cn } from '@/shared/utils'
import { tutorBtnIconOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'

export type UcatSectionForTimeLimit = {
  id: string
  name: string | null
  time_limit_seconds: number | null
  time_per_question?: number | null
  number_of_questions?: number | null
}

type UcatSetEditorContentProps = {
  draftName: string
  draftDescription: string
  draftIsTimed: boolean
  draftTimeLimitMinutes: string
  draftTimeLimitSeconds: string
  draftTimeLimitSource: 'untimed' | 'section_full' | 'section_auto' | 'custom'
  draftTimeLimitSpeed: number
  draftPrivate: boolean
  draftStemIds: string[]
  setDraftStemIds: (ids: string[]) => void
  stemCatalog: UcatStemCatalogItem[]
  search: string
  setSearch: (value: string) => void
  filters: Record<string, unknown[]>
  setFilters: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  onEditStem: (id: string) => void
  onChangeName: (value: string) => void
  onChangeDescription: (value: string) => void
  onChangeIsTimed: (value: boolean) => void
  onChangeTimeLimitMinutes: (value: string) => void
  onChangeTimeLimitSeconds: (value: string) => void
  onChangeTimeLimitSource: (value: 'untimed' | 'section_full' | 'section_auto' | 'custom') => void
  onChangeTimeLimitSpeed: (value: number) => void
  onChangePrivate: (value: boolean) => void
  sections?: UcatSectionForTimeLimit[]
}

function AvailableStemRow({
  stem,
  onAdd,
  onEdit,
}: {
  stem: UcatStemCatalogItem
  onAdd: () => void
  onEdit: () => void
}) {
  return (
    <div className="flex w-full items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm hover:bg-muted">
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem.text || stem.id}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>
            {stem.sectionNumber}. {stem.sectionName}
          </span>
          <Badge
            variant="outline"
            className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.isPrivate))}
          >
            {stem.isPrivate ? 'Private' : 'Public'}
          </Badge>
          <span>
            · {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="default"
          size="icon"
          className={cn(tutorBtnPrimary, 'shrink-0')}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function StemListLabel({ stem, id, index }: { stem: UcatStemCatalogItem | undefined; id: string; index: number }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem?.text || id}</div>
        {stem ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>
              {stem.sectionNumber}. {stem.sectionName}
            </span>
            <Badge
              variant="outline"
              className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.isPrivate))}
            >
              {stem.isPrivate ? 'Private' : 'Public'}
            </Badge>
            <span>
              · {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function UcatSetEditorContent({
  draftName,
  draftDescription,
  draftIsTimed,
  draftTimeLimitMinutes,
  draftTimeLimitSeconds,
  draftTimeLimitSource,
  draftTimeLimitSpeed,
  draftPrivate,
  draftStemIds,
  setDraftStemIds,
  stemCatalog,
  search,
  setSearch,
  filters,
  setFilters,
  filterDefinitions,
  onEditStem,
  onChangeName,
  onChangeDescription,
  onChangeIsTimed,
  onChangeTimeLimitMinutes,
  onChangeTimeLimitSeconds,
  onChangeTimeLimitSource,
  onChangeTimeLimitSpeed,
  onChangePrivate,
  sections = [],
}: UcatSetEditorContentProps) {
  const [sideTab, setSideTab] = useState<'properties' | 'add-stems'>('properties')
  const [isEditingTimeLimit, setIsEditingTimeLimit] = useState(false)

  const setSectionsFromStems = useMemo(() => {
    const sectionMap = new Map<string, { sectionId: string; sectionNumber: number; questionCount: number }>()
    for (const stemId of draftStemIds) {
      const stem = stemCatalog.find((s) => s.id === stemId)
      if (!stem?.sectionId) continue
      const existing = sectionMap.get(stem.sectionId)
      if (existing) {
        existing.questionCount += stem.questionsCount
      } else {
        sectionMap.set(stem.sectionId, {
          sectionId: stem.sectionId,
          sectionNumber: stem.sectionNumber,
          questionCount: stem.questionsCount,
        })
      }
    }
    return Array.from(sectionMap.values())
  }, [draftStemIds, stemCatalog])

  const setSectionCount = setSectionsFromStems.length
  const firstSetSection = setSectionsFromStems[0]
  const firstUcatSection = firstSetSection ? sections.find((s) => s.id === firstSetSection.sectionId) : null

  const sectionFullTimeSeconds = firstUcatSection?.time_limit_seconds ?? null
  const sectionAutoTimeSeconds = useMemo(() => {
    let total = 0
    for (const ss of setSectionsFromStems) {
      const sec = sections.find((s) => s.id === ss.sectionId)
      const tpq = sec?.time_per_question
      if (tpq != null && tpq > 0) {
        total += ss.questionCount * tpq
      }
    }
    return total > 0 ? total : null
  }, [setSectionsFromStems, sections])

  const sectionFullTimeFormatted =
    sectionFullTimeSeconds != null && sectionFullTimeSeconds > 0
      ? formatSecondsToDuration(sectionFullTimeSeconds)
      : null
  const sectionAutoTimeFormatted =
    sectionAutoTimeSeconds != null && sectionAutoTimeSeconds > 0
      ? formatSecondsToDuration(sectionAutoTimeSeconds)
      : null

  const effectiveTimeSeconds = useMemo(() => {
    if (draftTimeLimitSource === 'untimed' || !draftIsTimed) return null
    if (
      draftTimeLimitSource === 'section_full' &&
      setSectionCount === 1 &&
      sectionFullTimeSeconds != null &&
      sectionFullTimeSeconds > 0
    ) {
      return sectionFullTimeSeconds
    }
    if (draftTimeLimitSource === 'section_auto' && setSectionCount === 1 && sectionAutoTimeSeconds != null) {
      const speed = Math.max(0.1, Math.min(2, draftTimeLimitSpeed))
      return Math.round(sectionAutoTimeSeconds / speed)
    }
    return minutesSecondsToTotal(draftTimeLimitMinutes, draftTimeLimitSeconds)
  }, [
    draftIsTimed,
    draftTimeLimitSource,
    draftTimeLimitSpeed,
    draftTimeLimitMinutes,
    draftTimeLimitSeconds,
    setSectionCount,
    sectionFullTimeSeconds,
    sectionAutoTimeSeconds,
  ])

  const timeLimitTooltips: Record<string, string> = {
    untimed: 'No time limit for this set.',
    section_full:
      "Uses the section's full exam time limit. Only available when the set contains questions from a single section.",
    section_auto:
      'Uses section time-per-question × number of questions for each section in the set. Speed: 1× = exam pace, higher = less time (faster), lower = more time (slower).',
    custom: 'Set a custom time limit in minutes and seconds.',
  }

  const timeLimitOptions = useMemo(
    () =>
      [
        { value: 'untimed' as const, label: 'Untimed', disabled: false },
        {
          value: 'section_full' as const,
          label: sectionFullTimeFormatted
            ? `Section full exam time (${sectionFullTimeFormatted})`
            : 'Section full exam time',
          disabled: setSectionCount !== 1,
        },
        {
          value: 'section_auto' as const,
          label: sectionAutoTimeFormatted
            ? `Section exam auto timing (${sectionAutoTimeFormatted})`
            : 'Section exam auto timing',
          disabled: setSectionCount !== 1,
        },
        { value: 'custom' as const, label: 'Custom', disabled: false },
      ],
    [sectionFullTimeFormatted, sectionAutoTimeFormatted, setSectionCount],
  )

  const stemsTableState = useMemo(
    () => ({
      search,
      filters,
      sortBy: null,
      sortDirection: 'desc' as const,
      groupBy: null,
      page: 1,
      pageSize: 100,
      visibleColumns: [] as string[],
    }),
    [search, filters],
  )

  const availableStems = useMemo(() => {
    const questionTypeFilter = filters.question_type?.[0] as string | undefined
    return stemCatalog
      .filter((stem) => {
        if (draftStemIds.includes(stem.id)) return false
        if (!applyCoreStringFilter(stem.text, search)) return false
        if (!applySingleSelectFilter(stemsTableState, 'section_id', stem.sectionNumber)) return false
        if (!applySingleSelectFilter(stemsTableState, 'question_stem_category_id', stem.categoryId)) return false
        if (!applyBooleanTextFilter(stemsTableState, 'visibility', stem.isPrivate)) return false
        if (questionTypeFilter && questionTypeFilter !== 'all') {
          if (!stem.questionTypes.includes(questionTypeFilter as 'multiple_choice' | 'syllogism')) {
            return false
          }
        }
        return true
      })
      .slice(0, 60)
  }, [stemCatalog, draftStemIds, search, stemsTableState, filters.question_type])

  const stemById = useMemo(() => {
    const map = new Map<string, UcatStemCatalogItem>()
    for (const stem of stemCatalog) {
      map.set(stem.id, stem)
    }
    return map
  }, [stemCatalog])

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 space-y-3 overflow-y-auto border-r p-6">
        <h2 className="font-semibold">Stems in set</h2>
        {draftStemIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stems in this set yet.</p>
        ) : (
          <UcatSortableList
            ids={draftStemIds}
            onChange={setDraftStemIds}
            onRemove={(id) => setDraftStemIds(draftStemIds.filter((stemId) => stemId !== id))}
            onEdit={onEditStem}
            renderLabel={(id, index) => (
              <StemListLabel stem={stemById.get(id)} id={id} index={index} />
            )}
          />
        )}
      </section>

      <aside className="flex h-full w-96 shrink-0 flex-col overflow-hidden border-l p-6">
        <SegmentedTabPanel
          value={sideTab}
          onValueChange={(value) => setSideTab(value)}
          className="min-h-0 flex-1"
          options={[
            { value: 'properties', label: 'Properties' },
            { value: 'add-stems', label: 'Add stems' },
          ]}
        >
          <SegmentedTabPanelContent
            when="properties"
            activeTab={sideTab}
            className="m-0 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pt-4"
          >
            <h2 className="font-semibold">Set properties</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <Input value={draftName} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Description</span>
              <Textarea
                className="min-h-24"
                value={draftDescription}
                onChange={(e) => onChangeDescription(e.target.value)}
              />
            </label>
            <div className="block text-sm">
              <span className="mb-1 block font-medium">Time limit</span>
              {!isEditingTimeLimit ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {effectiveTimeSeconds != null && effectiveTimeSeconds > 0
                      ? formatSecondsToDuration(effectiveTimeSeconds)
                      : 'Untimed'}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingTimeLimit(true)}>
                    Edit
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <SearchableSelect<(typeof timeLimitOptions)[number]>
                      items={timeLimitOptions}
                      value={timeLimitOptions.find((i) => i.value === draftTimeLimitSource) ?? null}
                      onValueChange={(item) => {
                        if (!item) return
                        onChangeTimeLimitSource(item.value)
                        onChangeIsTimed(item.value !== 'untimed')
                      }}
                      getItemLabel={(i) => i.label}
                      getItemId={(i) => i.value}
                      getItemDisabled={(i) => i.disabled}
                      triggerClassName="flex-1"
                    />
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 shrink-0 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          {timeLimitTooltips[draftTimeLimitSource]}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {setSectionCount > 1 && draftTimeLimitSource === 'section_auto' ? (
                    <p className="text-xs text-destructive">
                      Auto timing is not available for sets with multiple sections.
                    </p>
                  ) : null}
                  {draftTimeLimitSource === 'section_full' &&
                  firstUcatSection != null &&
                  firstSetSection != null &&
                  firstUcatSection.number_of_questions != null &&
                  firstSetSection.questionCount !== firstUcatSection.number_of_questions ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Warning: Section has {firstUcatSection.number_of_questions} questions; this set has{' '}
                      {firstSetSection.questionCount}.
                    </p>
                  ) : null}
                  {draftTimeLimitSource === 'section_auto' && setSectionCount === 1 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Speed</span>
                        <span className="text-muted-foreground">
                          {draftTimeLimitSpeed === 1 ? '1× exam pace' : `${draftTimeLimitSpeed.toFixed(1)}×`}
                        </span>
                      </div>
                      <Slider
                        min={0.1}
                        max={2}
                        step={0.1}
                        value={[Math.max(0.1, Math.min(2, draftTimeLimitSpeed))]}
                        onValueChange={([v]) => onChangeTimeLimitSpeed(v)}
                      />
                    </div>
                  ) : null}
                  {draftTimeLimitSource === 'custom' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        className="w-20"
                        value={draftTimeLimitMinutes}
                        onChange={(e) => onChangeTimeLimitMinutes(e.target.value)}
                      />
                      <span className="font-medium text-muted-foreground">:</span>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="0"
                        className="w-20"
                        value={draftTimeLimitSeconds}
                        onChange={(e) => onChangeTimeLimitSeconds(e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">min : sec</span>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Time limit:{' '}
                    {effectiveTimeSeconds != null && effectiveTimeSeconds > 0
                      ? formatSecondsToDuration(effectiveTimeSeconds)
                      : 'Untimed'}
                  </p>
                  <Button type="button" size="sm" onClick={() => setIsEditingTimeLimit(false)}>
                    Done
                  </Button>
                </div>
              )}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Visibility</span>
              <SearchableSelect<{ value: string; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={
                  draftPrivate
                    ? { value: 'private', label: 'Private' }
                    : { value: 'public', label: 'Public' }
                }
                onValueChange={(item) => item && onChangePrivate(item.value === 'private')}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
              />
            </label>
          </SegmentedTabPanelContent>
          <SegmentedTabPanelContent
            when="add-stems"
            activeTab={sideTab}
            className="m-0 mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-4"
          >
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search stems"
              filterDefinitions={filterDefinitions}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {availableStems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stems to add, or all matching stems are already in the set.
                </p>
              ) : (
                availableStems.map((stem) => (
                  <AvailableStemRow
                    key={stem.id}
                    stem={stem}
                    onAdd={() => setDraftStemIds([...draftStemIds, stem.id])}
                    onEdit={() => onEditStem(stem.id)}
                  />
                ))
              )}
            </div>
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      </aside>
    </div>
  )
}
