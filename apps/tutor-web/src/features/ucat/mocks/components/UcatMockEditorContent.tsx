'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  getUcatVisibilityColor,
  Input,
  ListToolbar,
  SearchableSelect,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { Pencil, Plus } from 'lucide-react'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { formatSetTimeLimit } from '@/features/ucat/shared/lib/time-utils'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applyRangeFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import type { RichTextJson } from '@/features/ucat/shared/types'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { getSetSectionStatus } from '@/features/ucat/shared/lib/set-section-status'
import { cn } from '@/shared/utils'
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel'
import { tutorBtnIconOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'

type UcatMockEditorContentProps = {
  name: string
  isPrivate: boolean
  instructionsText: RichTextJson | null
  setInstructionsText: (value: RichTextJson | null) => void
  setName: (value: string) => void
  setIsPrivate: (value: boolean) => void
  draftSetIds: string[]
  setDraftSetIds: (ids: string[]) => void
  search: string
  setSearch: (value: string) => void
  filters?: Record<string, unknown[]>
  setFilters?: (value: Record<string, unknown[]>) => void
  filterDefinitions?: DataTableFilterDefinition[]
  setCatalog: SetOption[]
  sections?: Array<{
    id: string | null
    section_number: number | null
    name: string | null
    number_of_questions: number | null
    time_limit_seconds: number | null
  }>
  onEditSet?: (setId: string) => void
}

function SetSubtitleParts({
  set,
  sections,
}: {
  set: SetOption
  sections: Array<{
    id: string | null
    section_number: number | null
    name: string | null
    number_of_questions: number | null
    time_limit_seconds: number | null
  }>
}) {
  const status = getSetSectionStatus(
    {
      sectionCount: set.sectionCount,
      firstSectionNumber: set.firstSectionNumber,
      question_count: set.question_count,
      time_limit_seconds: set.time_limit_seconds,
    },
    sections,
  )
  return (
    <>
      {set.sectionDisplay ? (
        <SetStatusSpan status={status.sectionsStatus} tooltip={status.sectionsTooltip}>
          {set.sectionDisplay}
        </SetStatusSpan>
      ) : null}
      <Badge
        variant="outline"
        className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(!!set.is_private))}
      >
        {set.is_private ? 'Private' : 'Public'}
      </Badge>
      <SetStatusSpan status={status.questionCountStatus} tooltip={status.questionCountTooltip}>
        · {set.question_count != null ? `${set.question_count} Q` : '—'}
      </SetStatusSpan>
      <SetStatusSpan status={status.timeLimitStatus} tooltip={status.timeLimitTooltip}>
        · {formatSetTimeLimit(set.time_limit_seconds)}
      </SetStatusSpan>
    </>
  )
}

function AvailableSetRow({
  set,
  sections,
  onAdd,
  onEdit,
}: {
  set: SetOption
  sections: UcatMockEditorContentProps['sections']
  onAdd: () => void
  onEdit?: () => void
}) {
  return (
    <div className="flex w-full items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm hover:bg-muted">
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-xs font-medium sm:text-sm">{set.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <SetSubtitleParts set={set} sections={sections ?? []} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
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

function SetListLabel({
  set,
  id,
  index,
  sections,
}: {
  set: SetOption | undefined
  id: string
  index: number
  sections: UcatMockEditorContentProps['sections']
}) {
  if (!set) {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
        <span className="text-xs sm:text-sm">{id.slice(0, 8)}</span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-xs font-medium sm:text-sm">{set.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <SetSubtitleParts set={set} sections={sections ?? []} />
        </div>
      </div>
    </div>
  )
}

export function UcatMockEditorContent({
  name,
  isPrivate,
  instructionsText,
  setInstructionsText,
  setName,
  setIsPrivate,
  draftSetIds,
  setDraftSetIds,
  search,
  setSearch,
  filters = {},
  setFilters = () => {},
  filterDefinitions = [],
  setCatalog,
  sections = [],
  onEditSet,
}: UcatMockEditorContentProps) {
  const [sideTab, setSideTab] = useState<'properties' | 'add-sets'>('properties')

  const setsTableState = useMemo(
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

  const availableSets = useMemo(() => {
    return setCatalog
      .filter((set) => {
        if (draftSetIds.includes(set.id)) return false
        const searchHit =
          !search.trim() ||
          applyCoreStringFilter(set.name, search) ||
          applyCoreStringFilter(set.sectionDisplay, search)
        const visibilityHit = applyBooleanTextFilter(setsTableState, 'visibility', !!set.is_private)
        const timeLimitHit = applyRangeFilter(
          setsTableState,
          'time_limit_min',
          'time_limit_max',
          set.time_limit_seconds ?? null,
        )
        const stemCountHit = applyRangeFilter(
          setsTableState,
          'stem_count_min',
          'stem_count_max',
          set.stem_count ?? null,
        )
        const questionCountHit = applyRangeFilter(
          setsTableState,
          'question_count_min',
          'question_count_max',
          set.question_count ?? null,
        )
        return searchHit && visibilityHit && timeLimitHit && stemCountHit && questionCountHit
      })
      .slice(0, 50)
  }, [draftSetIds, search, setCatalog, setsTableState])

  const setById = useMemo(() => {
    const map = new Map<string, SetOption>()
    for (const set of setCatalog) {
      map.set(set.id, set)
    }
    return map
  }, [setCatalog])

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 space-y-3 overflow-y-auto border-r p-6">
        <h2 className="font-semibold">Sets in mock</h2>
        {draftSetIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sets in this mock yet.</p>
        ) : (
          <UcatSortableList
            ids={draftSetIds}
            onChange={setDraftSetIds}
            onRemove={(id) => setDraftSetIds(draftSetIds.filter((setId) => setId !== id))}
            onEdit={onEditSet}
            renderLabel={(id, index) => (
              <SetListLabel set={setById.get(id)} id={id} index={index} sections={sections} />
            )}
          />
        )}
      </section>

      <aside className="flex h-full w-96 shrink-0 flex-col overflow-hidden border-l p-6">
        <SegmentedTabPanel
          value={sideTab}
          onValueChange={setSideTab}
          className="min-h-0 flex-1"
          options={[
            { value: 'properties', label: 'Properties' },
            { value: 'add-sets', label: 'Add sets' },
          ]}
        >
          <SegmentedTabPanelContent
            when="properties"
            activeTab={sideTab}
            className="m-0 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pt-4"
          >
            <h2 className="font-semibold">Mock properties</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Visibility</span>
              <SearchableSelect<{ value: string; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={
                  isPrivate
                    ? { value: 'private', label: 'Private' }
                    : { value: 'public', label: 'Public' }
                }
                onValueChange={(item) => item && setIsPrivate(item.value === 'private')}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Instructions</span>
              <p className="mb-1 text-xs text-muted-foreground">
                Shown to students at the start of the mock before set instructions.
              </p>
              <div className="overflow-hidden rounded-md border border-input bg-background px-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <UcatRichTextEditor
                  value={instructionsText}
                  onChange={(value) => setInstructionsText(value)}
                  placeholder="Optional mock instructions..."
                  minHeight="120px"
                />
              </div>
            </label>
          </SegmentedTabPanelContent>
          <SegmentedTabPanelContent
            when="add-sets"
            activeTab={sideTab}
            className="m-0 mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-4"
          >
            {filterDefinitions.length > 0 ? (
              <ListToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search sets"
                filterDefinitions={filterDefinitions}
                filters={filters}
                onFiltersChange={setFilters}
              />
            ) : (
              <Input
                placeholder="Search sets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="shrink-0"
              />
            )}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {availableSets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sets to add, or all matching sets are already in the mock.
                </p>
              ) : (
                availableSets.map((set) => (
                  <AvailableSetRow
                    key={set.id}
                    set={set}
                    sections={sections}
                    onAdd={() => setDraftSetIds([...draftSetIds, set.id])}
                    onEdit={onEditSet ? () => onEditSet(set.id) : undefined}
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
