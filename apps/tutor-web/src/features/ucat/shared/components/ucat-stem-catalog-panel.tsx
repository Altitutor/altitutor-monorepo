'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import { Badge, Button, getUcatVisibilityColor } from '@altitutor/ui'
import { Eye, Pencil, Plus } from 'lucide-react'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatCatalogListPanel } from '@/features/ucat/shared/components/ucat-catalog-list-panel'
import { mergeVisibleOrderIntoFull, UcatSortableList } from '@/features/ucat/shared/drag-list'
import { useUcatCatalogListState } from '@/features/ucat/shared/hooks/useUcatCatalogListState'
import {
  resolveCategoryPathLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import { paginateCatalogItems } from '@/features/ucat/shared/lib/ucat-catalog-pagination'
import { hasCatalogToolbarRefinements } from '@/features/ucat/shared/lib/ucat-catalog-toolbar'
import {
  defaultStemCatalogSearchScopes,
  filterStemCatalogItems,
  getDefaultStemCatalogVisibleColumns,
  sortStemCatalogItems,
  stemCatalogColumnDefinitions,
  stemCatalogSearchScopeOptions,
  stemCatalogSortOptions,
  type StemCatalogSearchScope,
} from '@/features/ucat/shared/lib/stem-catalog-filters'
import { cn, formatDateTime } from '@/shared/utils'
import { tutorBtnIconOutline, tutorBtnPrimary, tutorTransition } from '@/shared/lib/tutor-visual'
import { EXPANDABLE_DIALOG_TRANSITION } from '@/shared/components/expandable-dialog'

function stemShowsColumn(visibleColumns: string[], key: string) {
  return visibleColumns.length === 0 || visibleColumns.includes(key)
}

export function UcatStemCatalogMetadata({
  stem,
  visibleColumns,
  categoryPathLookup,
}: {
  stem: UcatStemCatalogItem
  visibleColumns: string[]
  categoryPathLookup?: Map<string, string>
}) {
  const categoryLabel = resolveCategoryPathLabel(
    categoryPathLookup ?? new Map(),
    stem.categoryId,
    stem.categoryName,
  )

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {stemShowsColumn(visibleColumns, 'section_name') ? (
        <span>
          {stem.sectionNumber}. {stem.sectionName}
        </span>
      ) : null}
      {stemShowsColumn(visibleColumns, 'category_name') && categoryLabel ? (
        <span>{categoryLabel}</span>
      ) : null}
      {stemShowsColumn(visibleColumns, 'visibility') ? (
        <Badge
          variant="outline"
          className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.isPrivate))}
        >
          {stem.isPrivate ? 'Private' : 'Public'}
        </Badge>
      ) : null}
      {stemShowsColumn(visibleColumns, 'question_count') ? (
        <span>
          · {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
        </span>
      ) : null}
      {stemShowsColumn(visibleColumns, 'sets') && stem.setNames !== '—' ? <span>· {stem.setNames}</span> : null}
      {stemShowsColumn(visibleColumns, 'type_summary') && stem.typeSummary !== '-' ? (
        <span>· {stem.typeSummary}</span>
      ) : null}
      {stemShowsColumn(visibleColumns, 'created_at') ? (
        <span>· Created {formatDateTime(stem.createdAt ?? '') || '—'}</span>
      ) : null}
    </div>
  )
}

export function UcatStemCatalogRow({
  stem,
  onAdd,
  onView,
  onEdit,
  onOpen,
  visibleColumns = getDefaultStemCatalogVisibleColumns(),
  categoryPathLookup,
}: {
  stem: UcatStemCatalogItem
  onAdd?: () => void
  onView?: () => void
  onEdit?: () => void
  onOpen?: () => void
  visibleColumns?: string[]
  categoryPathLookup?: Map<string, string>
}) {
  const title = stem.text || stem.id
  const titleContent = (
    <div className="line-clamp-2 break-words text-xs sm:text-sm">{title}</div>
  )

  return (
    <div
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-xl bg-card px-2 py-2 text-left text-sm shadow-sm ring-1 ring-black/[0.06] hover:bg-muted/40 dark:ring-white/[0.08]',
        tutorTransition,
      )}
    >
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="w-full text-left">
            {titleContent}
          </button>
        ) : (
          titleContent
        )}
        <UcatStemCatalogMetadata
          stem={stem}
          visibleColumns={visibleColumns}
          categoryPathLookup={categoryPathLookup}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onView ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
            onClick={onView}
            aria-label={`View ${title}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ) : null}
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
            onClick={onEdit}
            aria-label={`Edit ${title}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {onAdd ? (
          <Button
            type="button"
            variant="default"
            size="icon"
            className={cn(tutorBtnPrimary, 'shrink-0')}
            onClick={onAdd}
            aria-label={`Add ${title}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function UcatStemCatalogLabel({
  stem,
  id,
  index,
  visibleColumns = getDefaultStemCatalogVisibleColumns(),
}: {
  stem: UcatStemCatalogItem | undefined
  id: string
  index: number
  visibleColumns?: string[]
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-xs sm:text-sm">{stem?.text || id}</div>
        {stem ? (
          <UcatStemCatalogMetadata stem={stem} visibleColumns={visibleColumns} />
        ) : null}
      </div>
    </div>
  )
}

type UcatStemCatalogListPanelProps = {
  stems: UcatStemCatalogItem[]
  excludedIds?: string[]
  includedIds?: Set<string>
  search: string
  onSearchChange: (value: string) => void
  filters: Record<string, unknown[]>
  onFiltersChange: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  columnDefinitions?: DataTableColumnDefinition[]
  categoryPathLookup?: Map<string, string>
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  isLoading?: boolean
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  onAddStem?: (stemId: string) => void
  onViewStem?: (stemId: string) => void
  onEditStem?: (stemId: string) => void
  onOpenStem?: (stemId: string) => void
}

export function UcatStemCatalogListPanel({
  stems,
  excludedIds = [],
  includedIds,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  filterDefinitions,
  columnDefinitions = stemCatalogColumnDefinitions,
  categoryPathLookup = new Map(),
  filterSearchValues,
  onFilterSearchChange,
  isLoading = false,
  emptyMessage = 'No stems match the current filters.',
  searchPlaceholder = 'Search stems or questions',
  className,
  onAddStem,
  onViewStem,
  onEditStem,
  onOpenStem,
}: UcatStemCatalogListPanelProps) {
  const listState = useUcatCatalogListState(getDefaultStemCatalogVisibleColumns())
  const { setState } = listState
  const [searchScopes, setSearchScopes] = useState<StemCatalogSearchScope[]>(defaultStemCatalogSearchScopes)

  useEffect(() => {
    setState((prev) => ({ ...prev, page: 1 }))
  }, [search, filters, excludedIds, includedIds, searchScopes, setState])

  const filteredStems = useMemo(
    () =>
      filterStemCatalogItems({
        stems,
        excludedIds,
        includedIds,
        search,
        filters,
        searchScopes,
      }),
    [stems, excludedIds, includedIds, search, filters, searchScopes],
  )

  const sortedStems = useMemo(
    () =>
      sortStemCatalogItems(
        filteredStems,
        listState.state.sortBy,
        listState.state.sortDirection,
        categoryPathLookup,
      ),
    [filteredStems, listState.state.sortBy, listState.state.sortDirection, categoryPathLookup],
  )

  const { items: paginatedStems, total, effectivePage } = useMemo(
    () =>
      paginateCatalogItems(sortedStems, listState.state.page, listState.state.pageSize),
    [sortedStems, listState.state.page, listState.state.pageSize],
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
      searchFromOptions={stemCatalogSearchScopeOptions}
      searchFromValue={searchScopes}
      onSearchFromChange={(values) => setSearchScopes(values as StemCatalogSearchScope[])}
      filterDefinitions={filterDefinitions}
      filters={filters}
      onFiltersChange={onFiltersChange}
      filterSearchValues={filterSearchValues}
      onFilterSearchChange={onFilterSearchChange}
      sortOptions={stemCatalogSortOptions}
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
      hasItems={paginatedStems.length > 0}
      className={className}
    >
      {paginatedStems.map((stem) => (
        <UcatStemCatalogRow
          key={stem.id}
          stem={stem}
          visibleColumns={listState.state.visibleColumns}
          categoryPathLookup={categoryPathLookup}
          onAdd={onAddStem ? () => onAddStem(stem.id) : undefined}
          onView={onViewStem ? () => onViewStem(stem.id) : undefined}
          onEdit={onEditStem ? () => onEditStem(stem.id) : undefined}
          onOpen={onOpenStem ? () => onOpenStem(stem.id) : undefined}
        />
      ))}
    </UcatCatalogListPanel>
  )
}

/** @deprecated Use `UcatStemCatalogListPanel` */
export function UcatStemCatalogAddPanel(props: UcatStemCatalogListPanelProps) {
  return <UcatStemCatalogListPanel {...props} />
}

type UcatStemMembershipListPanelProps = {
  stemIds: string[]
  onStemIdsChange: (ids: string[]) => void
  stems: UcatStemCatalogItem[]
  filterDefinitions: DataTableFilterDefinition[]
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  onEditStem?: (stemId: string) => void
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
}

export function UcatStemMembershipListPanel({
  stemIds,
  onStemIdsChange,
  stems,
  filterDefinitions,
  filterSearchValues,
  onFilterSearchChange,
  onEditStem,
  emptyMessage = 'No stems match the current filters.',
  searchPlaceholder = 'Search stems or questions',
  className,
}: UcatStemMembershipListPanelProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [searchScopes, setSearchScopes] = useState<StemCatalogSearchScope[]>(defaultStemCatalogSearchScopes)
  const listState = useUcatCatalogListState(getDefaultStemCatalogVisibleColumns())

  const stemById = useMemo(() => new Map(stems.map((stem) => [stem.id, stem])), [stems])

  const membershipStems = useMemo(
    () =>
      stemIds
        .map((id) => stemById.get(id))
        .filter((stem): stem is UcatStemCatalogItem => stem != null),
    [stemIds, stemById],
  )

  const filteredStems = useMemo(
    () => filterStemCatalogItems({ stems: membershipStems, search, filters, searchScopes }),
    [membershipStems, search, filters, searchScopes],
  )

  const filteredIdSet = useMemo(() => new Set(filteredStems.map((stem) => stem.id)), [filteredStems])

  const displayIds = useMemo(
    () => stemIds.filter((id) => filteredIdSet.has(id)),
    [stemIds, filteredIdSet],
  )

  const reorderDisabled = useMemo(
    () =>
      hasCatalogToolbarRefinements({
        search,
        searchScopes,
        defaultSearchScopes: defaultStemCatalogSearchScopes,
        filters,
      }),
    [search, searchScopes, filters],
  )

  if (stemIds.length === 0) {
    return <p className="text-sm text-muted-foreground">No stems in this set yet.</p>
  }

  return (
    <UcatCatalogListPanel
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={searchPlaceholder}
      searchFromOptions={stemCatalogSearchScopeOptions}
      searchFromValue={searchScopes}
      onSearchFromChange={(values) => setSearchScopes(values as StemCatalogSearchScope[])}
      filterDefinitions={filterDefinitions}
      filters={filters}
      onFiltersChange={setFilters}
      filterSearchValues={filterSearchValues}
      onFilterSearchChange={onFilterSearchChange}
      columnDefinitions={stemCatalogColumnDefinitions}
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
        onChange={(reorderedVisibleIds) => {
          onStemIdsChange(mergeVisibleOrderIntoFull(stemIds, displayIds, reorderedVisibleIds))
        }}
        onRemove={(id) => onStemIdsChange(stemIds.filter((stemId) => stemId !== id))}
        onEdit={onEditStem}
        renderLabel={(id) => (
          <UcatStemCatalogLabel
            stem={stemById.get(id)}
            id={id}
            index={stemIds.indexOf(id)}
            visibleColumns={listState.state.visibleColumns}
          />
        )}
      />
    </UcatCatalogListPanel>
  )
}

export function UcatStemCatalogSidePanel({
  open,
  children,
  className,
}: {
  open: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-l',
        EXPANDABLE_DIALOG_TRANSITION,
        open ? 'w-96 opacity-100' : 'pointer-events-none w-0 border-l-0 opacity-0',
        className,
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full w-96 flex-col overflow-hidden p-6">{children}</div>
    </aside>
  )
}
