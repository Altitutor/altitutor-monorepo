'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Button,
  Input,
  SearchableSelect,
  Slider,
  Tabs,
  TabsContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { Info } from 'lucide-react'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  UcatStemCatalogListPanel,
  UcatStemMembershipListPanel,
} from '@/features/ucat/shared/components/ucat-stem-catalog-panel'
import { UcatVisibilityFieldLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { formatSecondsToDuration, minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { bindRichTextToolbarFocus } from '@/features/ucat/shared/lib/rich-text-toolbar-focus'
import type { RichTextJson } from '@/features/ucat/shared/types'
import { SegmentedControl } from '@/shared/components/segmented-control'
import {
  UcatAuthoringWorkspaceTabs,
  type UcatAuthoringWorkspaceTab,
} from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import { cn } from '@/shared/utils'

export type UcatSectionForTimeLimit = {
  id: string
  name: string | null
  time_limit_seconds: number | null
  time_per_question?: number | null
  number_of_questions?: number | null
}

function SetPropertyRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="w-[34%] shrink-0 pt-2 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

type UcatSetEditorContentProps = {
  draftName: string
  draftDescription: RichTextJson | null
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
  categoryPathLookup?: Map<string, string>
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  stemCatalogLoading?: boolean
  onEditStem: (id: string) => void
  onChangeName: (value: string) => void
  onChangeDescription: (value: RichTextJson | null) => void
  onChangeIsTimed: (value: boolean) => void
  onChangeTimeLimitMinutes: (value: string) => void
  onChangeTimeLimitSeconds: (value: string) => void
  onChangeTimeLimitSource: (value: 'untimed' | 'section_full' | 'section_auto' | 'custom') => void
  onChangeTimeLimitSpeed: (value: number) => void
  onChangePrivate: (value: boolean) => void
  sections?: UcatSectionForTimeLimit[]
  onActiveTextEditorChange?: (editor: Editor | null) => void
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
  categoryPathLookup,
  filterSearchValues,
  onFilterSearchChange,
  stemCatalogLoading = false,
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
  onActiveTextEditorChange,
}: UcatSetEditorContentProps) {
  const [sideTab, setSideTab] = useState<'properties' | 'add-stems'>('properties')
  const [activeWorkspace, setActiveWorkspace] = useState<UcatAuthoringWorkspaceTab>('editor')
  const [isEditingTimeLimit, setIsEditingTimeLimit] = useState(false)

  const handleTextEditorActive = useCallback(
    (textEditor: Editor | null) => {
      onActiveTextEditorChange?.(textEditor)
    },
    [onActiveTextEditorChange],
  )

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

  function handleWorkspaceChange(value: UcatAuthoringWorkspaceTab) {
    setActiveWorkspace(value)
    if (value === 'properties') setSideTab('properties')
    if (value === 'ai') setSideTab('add-stems')
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <UcatAuthoringWorkspaceTabs
        value={activeWorkspace}
        onValueChange={handleWorkspaceChange}
        editorLabel="Stems"
        aiLabel="Add stems"
        className="shrink-0 border-b bg-background p-2 lg:hidden"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4 lg:flex lg:border-r lg:p-6',
          activeWorkspace !== 'editor' && 'hidden',
        )}>
          <h2 className="mb-3 shrink-0 font-semibold">Stems in set</h2>
          <UcatStemMembershipListPanel
            stemIds={draftStemIds}
            onStemIdsChange={setDraftStemIds}
            stems={stemCatalog}
            filterDefinitions={filterDefinitions}
            filterSearchValues={filterSearchValues}
            onFilterSearchChange={onFilterSearchChange}
            onEditStem={onEditStem}
            className="min-h-0 flex-1"
          />
        </section>

      <aside className={cn(
        'h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background p-3 sm:p-4 lg:flex lg:w-80 lg:border-l',
        activeWorkspace === 'editor' && 'hidden',
        activeWorkspace !== 'editor' && 'flex',
      )}>
        <Tabs
          value={sideTab}
          onValueChange={(value) => setSideTab(value as 'properties' | 'add-stems')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="hidden lg:block">
            <SegmentedControl
              fullWidth
              value={sideTab}
              onValueChange={setSideTab}
              options={[
                { value: 'properties', label: 'Properties' },
                { value: 'add-stems', label: 'Add stems' },
              ]}
            />
          </div>
          <TabsContent value="properties" className="m-0 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-1">
            <h2 className="font-semibold">Set properties</h2>
            <SetPropertyRow label="Name">
              <Input value={draftName} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
            </SetPropertyRow>
            <SetPropertyRow label="Description">
              <div className="overflow-hidden rounded-md border border-input bg-background px-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <UcatRichTextEditor
                  value={draftDescription}
                  onChange={(value) => onChangeDescription(value)}
                  placeholder="Optional set description..."
                  minHeight="120px"
                  onEditorReady={(editor) => bindRichTextToolbarFocus(editor, handleTextEditorActive)}
                />
              </div>
            </SetPropertyRow>
            <SetPropertyRow label="Time limit">
              <div className="text-sm">
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
            </SetPropertyRow>
            <SetPropertyRow label={<UcatVisibilityFieldLabel />}>
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
            </SetPropertyRow>
          </TabsContent>
          <TabsContent value="add-stems" className="m-0 mt-3 min-h-0 flex-1 flex-col data-[state=active]:flex">
            <UcatStemCatalogListPanel
              stems={stemCatalog}
              excludedIds={draftStemIds}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
              filterDefinitions={filterDefinitions}
              categoryPathLookup={categoryPathLookup}
              filterSearchValues={filterSearchValues}
              onFilterSearchChange={onFilterSearchChange}
              isLoading={stemCatalogLoading}
              onAddStem={(stemId) => setDraftStemIds([...draftStemIds, stemId])}
              onEditStem={onEditStem}
              searchPlaceholder="Search stems..."
              compact
              emptyMessage="No stems to add, or all matching stems are already in the set."
            />
          </TabsContent>
        </Tabs>
      </aside>
      </div>
    </div>
  )
}
