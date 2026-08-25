'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  ResponsiveResizablePanels,
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
import { useUcatQuestionCatalogByStemIds } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  UcatStemCatalogListPanel,
  UcatStemMembershipListPanel,
} from '@/features/ucat/shared/components/ucat-stem-catalog-panel'
import { UcatVisibilityFieldLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { formatSecondsToDuration, formatSetTimeLimit, minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
import { getSetSectionStatus } from '@/features/ucat/shared/lib/set-section-status'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { bindRichTextToolbarFocus } from '@/features/ucat/shared/lib/rich-text-toolbar-focus'
import type { RichTextJson } from '@/features/ucat/shared/types'
import { SegmentedControl } from '@/shared/components/segmented-control'
import {
  UcatAuthoringWorkspaceTabs,
  type UcatAuthoringWorkspaceTab,
} from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type { LinkedMockBlueprintCompliance } from '@/features/ucat/mocks/lib/blueprint-compliance'
import { UcatSetMockMembershipCard } from '@/features/ucat/sets/components/UcatSetMockMembershipCard'
import { UcatSetDistributionList } from '@/features/ucat/sets/components/UcatSetDistributionCard'
import { useUcatSetQuestionDistributions } from '@/features/ucat/sets/hooks/useUcatSetQuestionDistributions'
import type { SetDetailMembershipStem } from '@/features/ucat/sets/lib/set-membership-rows'

export type UcatSectionForTimeLimit = {
  id: string
  name: string | null
  section_number?: number | null
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

function PropertiesCard({
  value,
  title,
  children,
}: {
  value: string
  title: string
  children: ReactNode
}) {
  return (
    <AccordionItem value={value} className="border-0">
      <div className={tutorCardCn('overflow-hidden')}>
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
          <span className="text-sm font-semibold">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-1 border-t border-black/[0.06] px-3 pb-4 pt-2 dark:border-white/10">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
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
  setDetailStems?: SetDetailMembershipStem[]
  search: string
  setSearch: (value: string) => void
  filters: Record<string, unknown[]>
  setFilters: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  categoryPathLookup?: Map<string, string>
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  publishedSetIds?: ReadonlySet<string>
  currentSetId?: string | null
  draftSectionId: string
  onChangeSectionId: (sectionId: string) => void
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
  linkedBlueprintReports?: LinkedMockBlueprintCompliance[]
  onViewMock?: (mockId: string) => void
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
  setDetailStems = [],
  search,
  setSearch,
  filters,
  setFilters,
  filterDefinitions,
  categoryPathLookup,
  filterSearchValues,
  onFilterSearchChange,
  publishedSetIds,
  currentSetId = null,
  draftSectionId,
  onChangeSectionId,
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
  linkedBlueprintReports = [],
  onViewMock,
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

  const authoredSection = sections.find((section) => section.id === draftSectionId) ?? null
  const membershipCatalogQuery = useUcatQuestionCatalogByStemIds(draftStemIds, draftStemIds.length > 0)
  const memberQuestionCount = useMemo(() => {
    const catalogById = new Map(
      (membershipCatalogQuery.data ?? []).map((row) => [row.id ?? '', row.question_count ?? 0]),
    )
    const fallbackById = new Map(
      setDetailStems.map((stem) => [stem.stem_id, Array.isArray(stem.questions_meta) ? stem.questions_meta.length : 0]),
    )
    return draftStemIds.reduce((sum, stemId) => {
      const catalogCount = catalogById.get(stemId)
      if (catalogCount != null) return sum + catalogCount
      const stem = stemCatalog.find((item) => item.id === stemId)
      return sum + (stem?.questionsCount ?? fallbackById.get(stemId) ?? 0)
    }, 0)
  }, [draftStemIds, membershipCatalogQuery.data, setDetailStems, stemCatalog])
  const { isLoading: distributionLoading, distributions } = useUcatSetQuestionDistributions(
    draftStemIds,
    draftStemIds.length > 0,
  )
  const setSectionCount = authoredSection ? 1 : 0
  const firstSetSection = authoredSection
    ? { sectionId: authoredSection.id, questionCount: memberQuestionCount }
    : null
  const firstUcatSection = authoredSection

  const sectionFullTimeSeconds = firstUcatSection?.time_limit_seconds ?? null
  const sectionAutoTimeSeconds = useMemo(() => {
    const tpq = authoredSection?.time_per_question
    if (tpq == null || tpq <= 0 || memberQuestionCount <= 0) return null
    return memberQuestionCount * tpq
  }, [authoredSection, memberQuestionCount])

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

  const setExamStatus = useMemo(
    () =>
      getSetSectionStatus(
        {
          sectionCount: authoredSection ? 1 : 0,
          firstSectionNumber: authoredSection?.section_number ?? null,
          question_count: memberQuestionCount,
          time_limit_seconds: effectiveTimeSeconds,
        },
        sections.map((section) => ({
          id: section.id,
          section_number: section.section_number ?? null,
          name: section.name,
          number_of_questions: section.number_of_questions ?? null,
          time_limit_seconds: section.time_limit_seconds,
        })),
      ),
    [authoredSection, effectiveTimeSeconds, memberQuestionCount, sections],
  )

  const timeLimitTooltips: Record<string, string> = {
    untimed: 'No time limit for this set.',
    section_full:
      "Uses the set's UCAT section full exam time limit.",
    section_auto:
      "Uses the set's section time-per-question × number of questions. Speed: 1× = exam pace, higher = less time (faster), lower = more time (slower).",
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
      <div className="min-h-0 flex-1 overflow-hidden">
        <ResponsiveResizablePanels
          id="ucat-set-editor-panels"
          breakpoint="lg"
          primaryDefaultSize="70%"
          primaryMinSize={480}
          secondaryDefaultSize={320}
          secondaryMinSize={280}
          secondaryMaxSize={520}
          handleLabel="Resize set properties sidebar"
          mobilePanel={activeWorkspace === 'editor' ? 'primary' : 'secondary'}
          primary={(
        <section className="flex h-full min-h-0 min-w-0 flex-col p-3 sm:p-4 lg:p-6">
          <h2 className="mb-3 shrink-0 font-semibold">Stems in set</h2>
          <UcatStemMembershipListPanel
            stemIds={draftStemIds}
            onStemIdsChange={setDraftStemIds}
            stems={stemCatalog}
            setDetailStems={setDetailStems}
            filterDefinitions={filterDefinitions}
            filterSearchValues={filterSearchValues}
            onFilterSearchChange={onFilterSearchChange}
            publishedSetIds={publishedSetIds}
            currentSetId={currentSetId}
            categoryPathLookup={categoryPathLookup}
            onEditStem={onEditStem}
            className="min-h-0 flex-1"
          />
        </section>
          )}
          secondary={(
      <aside className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background p-3 sm:p-4">
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
            <Accordion type="multiple" defaultValue={['validation', 'category-distribution', 'set', 'mocks']} className="space-y-4">
              <PropertiesCard value="validation" title="Set validation">
                <SetPropertyRow label="Questions">
                  <SetStatusSpan status={setExamStatus.questionCountStatus} tooltip={setExamStatus.questionCountTooltip}>
                    {String(memberQuestionCount)}
                  </SetStatusSpan>
                </SetPropertyRow>
                <SetPropertyRow label="Time limit">
                  <SetStatusSpan status={setExamStatus.timeLimitStatus} tooltip={setExamStatus.timeLimitTooltip}>
                    {formatSetTimeLimit(effectiveTimeSeconds)}
                  </SetStatusSpan>
                </SetPropertyRow>
              </PropertiesCard>

              <PropertiesCard value="category-distribution" title="Category distribution">
                {distributionLoading ? (
                  <div className="h-24 animate-pulse rounded-xl bg-muted" aria-label="Loading category distribution" />
                ) : (
                  <UcatSetDistributionList rows={distributions.categories} />
                )}
              </PropertiesCard>

              <PropertiesCard value="tag-distribution" title="Tag distribution">
                {distributionLoading ? (
                  <div className="h-24 animate-pulse rounded-xl bg-muted" aria-label="Loading tag distribution" />
                ) : (
                  <UcatSetDistributionList rows={distributions.tags} />
                )}
              </PropertiesCard>

              <PropertiesCard value="set" title="Set properties">
                <SetPropertyRow label="Name">
                  <Input value={draftName} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
                </SetPropertyRow>
                <SetPropertyRow label="Section">
                  <div className="space-y-1">
                    <SearchableSelect<(typeof sections)[number]>
                      items={sections}
                      value={authoredSection}
                      onValueChange={(section) => {
                        if (section?.id) onChangeSectionId(section.id)
                      }}
                      getItemLabel={(section) => section.name ?? 'Untitled'}
                      getItemId={(section) => section.id}
                      placeholder="Select section"
                      disabled={draftStemIds.length > 0}
                    />
                    {draftStemIds.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Remove every stem before changing this set’s section.
                      </p>
                    ) : null}
                  </div>
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
              </PropertiesCard>

              <PropertiesCard value="mocks" title="Mock membership">
                <UcatSetMockMembershipCard
                  setId={currentSetId}
                  linkedBlueprintReports={linkedBlueprintReports}
                  onViewMock={onViewMock}
                />
              </PropertiesCard>
            </Accordion>
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
              publishedSetIds={publishedSetIds}
              currentSetId={currentSetId}
              lockedSectionId={draftSectionId || null}
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
          )}
        />
      </div>
    </div>
  )
}
