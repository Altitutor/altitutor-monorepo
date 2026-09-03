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
  Tabs,
  TabsContent,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatQuestionCatalogByStemIds } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  UcatStemCatalogListPanel,
  UcatStemMembershipListPanel,
} from '@/features/ucat/shared/components/ucat-stem-catalog-panel'
import { UcatVisibilityFieldLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { formatSetTimeLimit } from '@/features/ucat/shared/lib/time-utils'
import { resolveSetTimeLimitSeconds, type SetTimeLimitSource } from '@/features/ucat/sets/lib/set-time-limit'
import { UcatSetPropertyRow } from '@/features/ucat/sets/components/UcatSetPropertyRow'
import { UcatSetTimeLimitFields } from '@/features/ucat/sets/components/UcatSetTimeLimitFields'
import { getSetSectionStatus } from '@/features/ucat/shared/lib/set-section-status'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { bindRichTextToolbarFocus } from '@/features/ucat/shared/lib/rich-text-toolbar-focus'
import type { RichTextJson, UcatQuestionSetFormat } from '@/features/ucat/shared/types'
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
  draftTimeLimitMinutes: string
  draftTimeLimitSeconds: string
  draftTimeLimitSource: SetTimeLimitSource
  draftTimeLimitSpeed: number
  draftPrivate: boolean
  draftSetFormat: UcatQuestionSetFormat
  draftReferenceBlueprintId: string
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
  onChangeTimeLimitMinutes: (value: string) => void
  onChangeTimeLimitSeconds: (value: string) => void
  onChangeTimeLimitSource: (value: SetTimeLimitSource) => void
  onChangeTimeLimitSpeed: (value: number) => void
  onChangePrivate: (value: boolean) => void
  onChangeSetFormat: (value: UcatQuestionSetFormat) => void
  onChangeReferenceBlueprintId: (value: string) => void
  blueprintOptions?: Array<{ id: string; label: string }>
  isMockSet?: boolean
  sections?: UcatSectionForTimeLimit[]
  onActiveTextEditorChange?: (editor: Editor | null) => void
  linkedBlueprintReports?: LinkedMockBlueprintCompliance[]
  onViewMock?: (mockId: string) => void
}

export function UcatSetEditorContent({
  draftName,
  draftDescription,
  draftTimeLimitMinutes,
  draftTimeLimitSeconds,
  draftTimeLimitSource,
  draftTimeLimitSpeed,
  draftPrivate,
  draftSetFormat,
  draftReferenceBlueprintId,
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
  onChangeTimeLimitMinutes,
  onChangeTimeLimitSeconds,
  onChangeTimeLimitSource,
  onChangeTimeLimitSpeed,
  onChangePrivate,
  onChangeSetFormat,
  onChangeReferenceBlueprintId,
  blueprintOptions = [],
  isMockSet = false,
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

  const effectiveTimeSeconds = useMemo(
    () =>
      resolveSetTimeLimitSeconds({
        source: draftTimeLimitSource,
        timePerQuestion: authoredSection?.time_per_question,
        questionCount: memberQuestionCount,
        speed: draftTimeLimitSpeed,
        customMinutes: draftTimeLimitMinutes,
        customSeconds: draftTimeLimitSeconds,
      }),
    [
      authoredSection?.time_per_question,
      draftTimeLimitMinutes,
      draftTimeLimitSeconds,
      draftTimeLimitSource,
      draftTimeLimitSpeed,
      memberQuestionCount,
    ],
  )

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
                <UcatSetPropertyRow label="Questions">
                  <SetStatusSpan status={setExamStatus.questionCountStatus} tooltip={setExamStatus.questionCountTooltip}>
                    {String(memberQuestionCount)}
                  </SetStatusSpan>
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Time limit">
                  <SetStatusSpan status={setExamStatus.timeLimitStatus} tooltip={setExamStatus.timeLimitTooltip}>
                    {formatSetTimeLimit(effectiveTimeSeconds)}
                  </SetStatusSpan>
                </UcatSetPropertyRow>
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
                <UcatSetPropertyRow label="Tutor note">
                  <Input value={draftName} onChange={(e) => onChangeName(e.target.value)} placeholder="Optional internal note" />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Section">
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
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Format">
                  <SearchableSelect<{ value: UcatQuestionSetFormat; label: string }>
                    items={[
                      { value: 'full_section', label: 'Full section' },
                      { value: 'partial_section', label: 'Partial section' },
                    ]}
                    value={draftSetFormat === 'full_section'
                      ? { value: 'full_section', label: 'Full section' }
                      : { value: 'partial_section', label: 'Partial section' }}
                    onValueChange={(item) => item && onChangeSetFormat(item.value)}
                    getItemLabel={(item) => item.label}
                    getItemId={(item) => item.value}
                    disabled={isMockSet}
                  />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Reference blueprint">
                  <div className="space-y-1">
                    <SearchableSelect<(typeof blueprintOptions)[number]>
                      items={blueprintOptions}
                      value={blueprintOptions.find((item) => item.id === draftReferenceBlueprintId) ?? null}
                      onValueChange={(item) => item && onChangeReferenceBlueprintId(item.id)}
                      getItemLabel={(item) => item.label}
                      getItemId={(item) => item.id}
                      placeholder="Select blueprint"
                      disabled={isMockSet}
                    />
                    {isMockSet ? (
                      <p className="text-xs text-muted-foreground">
                        Mock sets use their mock’s blueprint and full-section format.
                      </p>
                    ) : null}
                  </div>
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Description">
                  <div className="overflow-hidden rounded-md border border-input bg-background px-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <UcatRichTextEditor
                      value={draftDescription}
                      onChange={(value) => onChangeDescription(value)}
                      placeholder="Optional set description..."
                      minHeight="120px"
                      onEditorReady={(editor) => bindRichTextToolbarFocus(editor, handleTextEditorActive)}
                    />
                  </div>
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Time limit">
                  <div className="text-sm">
                  {!isEditingTimeLimit ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatSetTimeLimit(effectiveTimeSeconds)}
                      </span>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingTimeLimit(true)}>
                        Edit
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <UcatSetTimeLimitFields
                        source={draftTimeLimitSource}
                        speed={draftTimeLimitSpeed}
                        minutes={draftTimeLimitMinutes}
                        seconds={draftTimeLimitSeconds}
                        questionCount={memberQuestionCount}
                        timePerQuestion={authoredSection?.time_per_question}
                        onChangeSource={onChangeTimeLimitSource}
                        onChangeSpeed={onChangeTimeLimitSpeed}
                        onChangeMinutes={onChangeTimeLimitMinutes}
                        onChangeSeconds={onChangeTimeLimitSeconds}
                      />
                      <Button type="button" size="sm" onClick={() => setIsEditingTimeLimit(false)}>
                        Done
                      </Button>
                    </div>
                  )}
                  </div>
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label={<UcatVisibilityFieldLabel />}>
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
                </UcatSetPropertyRow>
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
