'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import { Badge, Button, getUcatVisibilityColor } from '@altitutor/ui'
import { Pencil, Plus } from 'lucide-react'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatCatalogListPanel } from '@/features/ucat/shared/components/ucat-catalog-list-panel'
import { mergeVisibleOrderIntoFull, UcatSortableList } from '@/features/ucat/shared/drag-list'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { useUcatCatalogListState } from '@/features/ucat/shared/hooks/useUcatCatalogListState'
import { getSetSectionStatus } from '@/features/ucat/shared/lib/set-section-status'
import {
  defaultSetCatalogSearchScopes,
  filterSetCatalogItems,
  getDefaultSetCatalogVisibleColumns,
  setCatalogColumnDefinitions,
  setCatalogSearchScopeOptions,
  setCatalogSortOptions,
  sortSetCatalogItems,
  type SetCatalogSearchScope,
} from '@/features/ucat/shared/lib/set-catalog-filters'
import { formatSetTimeLimit } from '@/features/ucat/shared/lib/time-utils'
import { paginateCatalogItems } from '@/features/ucat/shared/lib/ucat-catalog-pagination'
import { hasCatalogToolbarRefinements } from '@/features/ucat/shared/lib/ucat-catalog-toolbar'
import { cn } from '@/shared/utils'
import { tutorBtnIconOutline, tutorBtnPrimary, tutorTransition } from '@/shared/lib/tutor-visual'

function setShowsColumn(visibleColumns: string[], key: string) {
  return visibleColumns.length === 0 || visibleColumns.includes(key)
}

function SetCatalogMetadata({
  set,
  sections,
  visibleColumns,
}: {
  set: SetOption
  sections: UcatSetCatalogListPanelProps['sections']
  visibleColumns: string[]
}) {
  const status = getSetSectionStatus(
    {
      sectionCount: set.sectionCount,
      firstSectionNumber: set.firstSectionNumber,
      question_count: set.question_count,
      time_limit_seconds: set.time_limit_seconds,
    },
    sections ?? [],
  )

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {setShowsColumn(visibleColumns, 'sections') && set.sectionDisplay ? (
        <SetStatusSpan status={status.sectionsStatus} tooltip={status.sectionsTooltip}>
          {set.sectionDisplay}
        </SetStatusSpan>
      ) : null}
      {setShowsColumn(visibleColumns, 'visibility') ? (
        <Badge
          variant="outline"
          className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(!!set.is_private))}
        >
          {set.is_private ? 'Private' : 'Public'}
        </Badge>
      ) : null}
      {setShowsColumn(visibleColumns, 'question_count') ? (
        <SetStatusSpan status={status.questionCountStatus} tooltip={status.questionCountTooltip}>
          · {set.question_count != null ? `${set.question_count} Q` : '—'}
        </SetStatusSpan>
      ) : null}
      {setShowsColumn(visibleColumns, 'stem_count') ? (
        <span>· {set.stem_count != null ? `${set.stem_count} stems` : '—'}</span>
      ) : null}
      {setShowsColumn(visibleColumns, 'time_limit_seconds') ? (
        <SetStatusSpan status={status.timeLimitStatus} tooltip={status.timeLimitTooltip}>
          · {formatSetTimeLimit(set.time_limit_seconds)}
        </SetStatusSpan>
      ) : null}
    </div>
  )
}

export function SetListLabel({
  set,
  id,
  index,
  sections,
  visibleColumns = getDefaultSetCatalogVisibleColumns(),
}: {
  set: SetOption | undefined
  id: string
  index: number
  sections: UcatSetCatalogListPanelProps['sections']
  visibleColumns?: string[]
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
        <SetCatalogMetadata set={set} sections={sections} visibleColumns={visibleColumns} />
      </div>
    </div>
  )
}

function SetCatalogRow({
  set,
  sections,
  visibleColumns,
  onAdd,
  onEdit,
}: {
  set: SetOption
  sections: UcatSetCatalogListPanelProps['sections']
  visibleColumns: string[]
  onAdd: () => void
  onEdit?: () => void
}) {
  return (
    <div
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-xl bg-card px-2 py-2 text-left text-sm shadow-sm ring-1 ring-black/[0.06] hover:bg-muted/40 dark:ring-white/[0.08]',
        tutorTransition,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-xs font-medium sm:text-sm">{set.name}</div>
        <SetCatalogMetadata set={set} sections={sections} visibleColumns={visibleColumns} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
            onClick={onEdit}
            aria-label={`Edit ${set.name}`}
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
          aria-label={`Add ${set.name}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

type UcatSetCatalogListPanelProps = {
  sets: SetOption[]
  excludedIds: string[]
  search: string
  onSearchChange: (value: string) => void
  filters: Record<string, unknown[]>
  onFiltersChange: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  columnDefinitions?: DataTableColumnDefinition[]
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  sections?: Array<{
    id: string | null
    section_number: number | null
    name: string | null
    number_of_questions: number | null
    time_limit_seconds: number | null
  }>
  isLoading?: boolean
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  onAddSet: (setId: string) => void
  onEditSet?: (setId: string) => void
}

export function UcatSetCatalogListPanel({
  sets,
  excludedIds,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  filterDefinitions,
  columnDefinitions = setCatalogColumnDefinitions,
  filterSearchValues,
  onFilterSearchChange,
  sections = [],
  isLoading = false,
  emptyMessage = 'No sets to add, or all matching sets are already in the mock.',
  searchPlaceholder = 'Search sets',
  className,
  onAddSet,
  onEditSet,
}: UcatSetCatalogListPanelProps) {
  const listState = useUcatCatalogListState(getDefaultSetCatalogVisibleColumns())
  const { setState } = listState
  const [searchScopes, setSearchScopes] = useState<SetCatalogSearchScope[]>(defaultSetCatalogSearchScopes)

  useEffect(() => {
    setState((prev) => ({ ...prev, page: 1 }))
  }, [search, filters, excludedIds, searchScopes, setState])

  const filteredSets = useMemo(
    () => filterSetCatalogItems({ sets, excludedIds, search, filters, searchScopes }),
    [sets, excludedIds, search, filters, searchScopes],
  )

  const sortedSets = useMemo(
    () => sortSetCatalogItems(filteredSets, listState.state.sortBy, listState.state.sortDirection),
    [filteredSets, listState.state.sortBy, listState.state.sortDirection],
  )

  const { items: paginatedSets, total, effectivePage } = useMemo(
    () => paginateCatalogItems(sortedSets, listState.state.page, listState.state.pageSize),
    [sortedSets, listState.state.page, listState.state.pageSize],
  )

  useEffect(() => {
    if (effectivePage !== listState.state.page) {
      setState((prev) => ({ ...prev, page: effectivePage }))
    }
  }, [effectivePage, listState.state.page, setState])

  return (
    <UcatCatalogListPanel
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchFromOptions={setCatalogSearchScopeOptions}
      searchFromValue={searchScopes}
      onSearchFromChange={(values) => setSearchScopes(values as SetCatalogSearchScope[])}
      filterDefinitions={filterDefinitions}
      filters={filters}
      onFiltersChange={onFiltersChange}
      filterSearchValues={filterSearchValues}
      onFilterSearchChange={onFilterSearchChange}
      sortOptions={setCatalogSortOptions}
      sortBy={listState.state.sortBy}
      sortDirection={listState.state.sortDirection}
      onSortChange={listState.actions.onSortChange}
      columnDefinitions={columnDefinitions}
      visibleColumns={listState.state.visibleColumns}
      onVisibleColumnsChange={listState.actions.onVisibleColumnsChange}
      page={listState.state.page}
      pageSize={listState.state.pageSize}
      total={total}
      onPageChange={listState.actions.onPageChange}
      onPageSizeChange={listState.actions.onPageSizeChange}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      hasItems={paginatedSets.length > 0}
      className={className}
    >
      {paginatedSets.map((set) => (
        <SetCatalogRow
          key={set.id}
          set={set}
          sections={sections}
          visibleColumns={listState.state.visibleColumns}
          onAdd={() => onAddSet(set.id)}
          onEdit={onEditSet ? () => onEditSet(set.id) : undefined}
        />
      ))}
    </UcatCatalogListPanel>
  )
}

type UcatSetMembershipListPanelProps = {
  setIds: string[]
  onSetIdsChange: (ids: string[]) => void
  sets: SetOption[]
  filterDefinitions: DataTableFilterDefinition[]
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  sections?: UcatSetCatalogListPanelProps['sections']
  onEditSet?: (setId: string) => void
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
}

export function UcatSetMembershipListPanel({
  setIds,
  onSetIdsChange,
  sets,
  filterDefinitions,
  filterSearchValues,
  onFilterSearchChange,
  sections = [],
  onEditSet,
  emptyMessage = 'No sets match the current filters.',
  searchPlaceholder = 'Search sets',
  className,
}: UcatSetMembershipListPanelProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [searchScopes, setSearchScopes] = useState<SetCatalogSearchScope[]>(defaultSetCatalogSearchScopes)
  const listState = useUcatCatalogListState(getDefaultSetCatalogVisibleColumns())

  const setById = useMemo(() => new Map(sets.map((set) => [set.id, set])), [sets])

  const membershipSets = useMemo(
    () =>
      setIds
        .map((id) => setById.get(id))
        .filter((set): set is SetOption => set != null),
    [setIds, setById],
  )

  const filteredSets = useMemo(
    () => filterSetCatalogItems({ sets: membershipSets, search, filters, searchScopes }),
    [membershipSets, search, filters, searchScopes],
  )

  const filteredIdSet = useMemo(() => new Set(filteredSets.map((set) => set.id)), [filteredSets])

  const displayIds = useMemo(
    () => setIds.filter((id) => filteredIdSet.has(id)),
    [setIds, filteredIdSet],
  )

  const reorderDisabled = useMemo(
    () =>
      hasCatalogToolbarRefinements({
        search,
        searchScopes,
        defaultSearchScopes: defaultSetCatalogSearchScopes,
        filters,
      }),
    [search, searchScopes, filters],
  )

  if (setIds.length === 0) {
    return <p className="text-sm text-muted-foreground">No sets in this mock yet.</p>
  }

  return (
    <UcatCatalogListPanel
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={searchPlaceholder}
      searchFromOptions={setCatalogSearchScopeOptions}
      searchFromValue={searchScopes}
      onSearchFromChange={(values) => setSearchScopes(values as SetCatalogSearchScope[])}
      filterDefinitions={filterDefinitions}
      filters={filters}
      onFiltersChange={setFilters}
      filterSearchValues={filterSearchValues}
      onFilterSearchChange={onFilterSearchChange}
      columnDefinitions={setCatalogColumnDefinitions}
      visibleColumns={listState.state.visibleColumns}
      onVisibleColumnsChange={listState.actions.onVisibleColumnsChange}
      emptyMessage={emptyMessage}
      hasItems={displayIds.length > 0}
      hidePagination
      compact={false}
      className={className}
    >
      <UcatSortableList
        ids={displayIds}
        disableReorder={reorderDisabled}
        flatCard
        onChange={(reorderedVisibleIds) => {
          onSetIdsChange(mergeVisibleOrderIntoFull(setIds, displayIds, reorderedVisibleIds))
        }}
        onRemove={(id) => onSetIdsChange(setIds.filter((setId) => setId !== id))}
        onEdit={onEditSet}
        renderLabel={(id) => (
          <SetListLabel
            set={setById.get(id)}
            id={id}
            index={setIds.indexOf(id)}
            sections={sections}
            visibleColumns={listState.state.visibleColumns}
          />
        )}
      />
    </UcatCatalogListPanel>
  )
}
