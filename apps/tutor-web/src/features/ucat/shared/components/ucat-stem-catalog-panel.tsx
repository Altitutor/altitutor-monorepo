'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import { Badge, Button, getUcatVisibilityColor } from '@altitutor/ui'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import {
  useUcatQuestionCatalogByStemIds,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatQuestionsTable } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'
import { UcatQuestionStemsTable } from '@/features/ucat/questions/components/UcatQuestionStemsTable'
import {
  defaultVisibleColumnKeys,
  QUESTION_STEM_NESTED_ANSWER_COLUMNS,
  QUESTION_STEM_NESTED_QUESTION_COLUMNS,
  SET_MEMBERSHIP_TABLE_COLUMNS,
} from '@/features/ucat/questions/lib/question-stems-table-columns'
import { UcatCatalogListPanel } from '@/features/ucat/shared/components/ucat-catalog-list-panel'
import { mergeVisibleOrderIntoFull } from '@/features/ucat/shared/drag-list'
import { useUcatCatalogListState } from '@/features/ucat/shared/hooks/useUcatCatalogListState'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
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
import {
  buildSetMembershipCatalogRows,
  setDetailStemToFallback,
  stemCatalogItemToFallback,
  type SetDetailMembershipStem,
} from '@/features/ucat/sets/lib/set-membership-rows'
import { cn, formatDateTime } from '@/shared/utils'
import { tutorBtnIconOutline, tutorBtnPrimary, tutorTransition } from '@/shared/lib/tutor-visual'
import { EXPANDABLE_DIALOG_TRANSITION } from '@/shared/components/expandable-dialog'

const EMPTY_STEM_EXCLUDED_IDS: string[] = []
const EMPTY_CATEGORY_PATH_LOOKUP = new Map<string, string>()

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
          className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.accessScope === 'private'))}
        >
          {stem.accessScope === 'private' ? 'Private' : 'Public'}
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
    <div className="line-clamp-2 w-full break-words text-xs sm:text-sm">{title}</div>
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
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 w-full break-words text-xs sm:text-sm">{stem?.text || id}</div>
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
  publishedSetIds?: ReadonlySet<string>
  currentSetId?: string | null
  lockedSectionId?: string | null
  isLoading?: boolean
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  compact?: boolean
  onAddStem?: (stemId: string) => void
  onViewStem?: (stemId: string) => void
  onEditStem?: (stemId: string) => void
  onOpenStem?: (stemId: string) => void
}

export function UcatStemCatalogListPanel({
  stems,
  excludedIds = EMPTY_STEM_EXCLUDED_IDS,
  includedIds,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  filterDefinitions,
  columnDefinitions = stemCatalogColumnDefinitions,
  categoryPathLookup = EMPTY_CATEGORY_PATH_LOOKUP,
  filterSearchValues,
  onFilterSearchChange,
  publishedSetIds,
  currentSetId = null,
  lockedSectionId = null,
  isLoading = false,
  emptyMessage = 'No stems match the current filters.',
  searchPlaceholder = 'Search stems or questions',
  className,
  compact = true,
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
        publishedSetIds,
        currentSetId,
        lockedSectionId,
      }),
    [stems, excludedIds, includedIds, search, filters, searchScopes, publishedSetIds, currentSetId, lockedSectionId],
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
      compact={compact}
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
  setDetailStems?: SetDetailMembershipStem[]
  filterDefinitions: DataTableFilterDefinition[]
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  publishedSetIds?: ReadonlySet<string>
  currentSetId?: string | null
  categoryPathLookup?: Map<string, string>
  onEditStem?: (stemId: string) => void
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
}

const defaultMembershipVisibleColumns = defaultVisibleColumnKeys(SET_MEMBERSHIP_TABLE_COLUMNS)
const defaultVisibleQuestionColumns = defaultVisibleColumnKeys(QUESTION_STEM_NESTED_QUESTION_COLUMNS)
const defaultVisibleAnswerOptionColumns = defaultVisibleColumnKeys(QUESTION_STEM_NESTED_ANSWER_COLUMNS)

export function UcatStemMembershipListPanel({
  stemIds,
  onStemIdsChange,
  stems,
  setDetailStems = [],
  filterDefinitions,
  filterSearchValues,
  onFilterSearchChange,
  publishedSetIds,
  currentSetId = null,
  categoryPathLookup = EMPTY_CATEGORY_PATH_LOOKUP,
  onEditStem,
  emptyMessage = 'No stems match the current filters.',
  searchPlaceholder = 'Search stems or questions',
  className,
}: UcatStemMembershipListPanelProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [searchScopes, setSearchScopes] = useState<StemCatalogSearchScope[]>(defaultStemCatalogSearchScopes)
  const [expandedStemIds, setExpandedStemIds] = useState<Set<string>>(new Set())
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(new Set())
  const [visibleQuestionColumns, setVisibleQuestionColumns] = useState(defaultVisibleQuestionColumns)
  const [visibleAnswerOptionColumns, setVisibleAnswerOptionColumns] = useState(defaultVisibleAnswerOptionColumns)
  const listState = useUcatCatalogListState(defaultMembershipVisibleColumns)
  const catalogQuery = useUcatQuestionCatalogByStemIds(stemIds, stemIds.length > 0)

  const fallbackStems = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof stemCatalogItemToFallback>>()
    for (const stem of setDetailStems) {
      byId.set(stem.stem_id, setDetailStemToFallback(stem))
    }
    for (const stem of stems) {
      byId.set(stem.id, stemCatalogItemToFallback(stem))
    }
    return [...byId.values()]
  }, [setDetailStems, stems])

  const membershipCatalogRows = useMemo(
    () =>
      buildSetMembershipCatalogRows({
        stemIds,
        catalogRows: catalogQuery.data ?? [],
        fallbackStems,
      }),
    [catalogQuery.data, fallbackStems, stemIds],
  )

  const dummyTableState = listState.state
  const { rows } = useUcatQuestionsTable({
    data: membershipCatalogRows,
    stemTagIds: {},
    questionSearchTexts: undefined,
    categoryPathLookup,
    tableState: dummyTableState,
    showDeleted: false,
    status: 'published',
    searchScopes: ['stem_text', 'question_text', 'answer_option_text'],
    serverProcessed: true,
  })

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

  const filterableStems = useMemo(
    () =>
      stemIds.flatMap((stemId) => {
        const row = rowById.get(stemId)
        const catalogStem = stems.find((stem) => stem.id === stemId)
        if (!row && !catalogStem) return []
        return [{
          id: stemId,
          text: row?.stem_text ?? catalogStem?.text ?? '',
          questionsCount: row?.question_count ?? catalogStem?.questionsCount ?? 0,
          sectionName: row?.section_name ?? catalogStem?.sectionName ?? '',
          sectionNumber: catalogStem?.sectionNumber ?? 0,
          sectionId: row?.section_id ?? catalogStem?.sectionId ?? null,
          categoryId: row?.question_stem_category_id ?? catalogStem?.categoryId ?? null,
          categoryName: row?.category_name ?? catalogStem?.categoryName ?? null,
          accessScope: row?.access_scope ?? catalogStem?.accessScope ?? 'public',
          status: row?.status ?? catalogStem?.status ?? 'draft',
          sourceChannel: row?.source_channel ?? catalogStem?.sourceChannel ?? 'individual',
          tagIds: row?.tag_ids ?? catalogStem?.tagIds ?? [],
          createdAt: row?.created_at ?? catalogStem?.createdAt ?? null,
          questionSearchText: row?.question_text ?? catalogStem?.questionSearchText ?? '',
          answerOptionSearchText: row?.answer_option_text ?? catalogStem?.answerOptionSearchText ?? '',
          setNames: row?.set_names ?? catalogStem?.setNames ?? '—',
          setIds: row?.set_ids ?? catalogStem?.setIds ?? [],
          typeSummary: row?.type_summary ?? catalogStem?.typeSummary ?? '-',
        } satisfies UcatStemCatalogItem]
      }),
    [rowById, stemIds, stems],
  )

  const filteredStems = useMemo(
    () =>
      filterStemCatalogItems({
        stems: filterableStems,
        search,
        filters,
        searchScopes,
        publishedSetIds,
        currentSetId,
      }),
    [filterableStems, search, filters, searchScopes, publishedSetIds, currentSetId],
  )

  const filteredIdSet = useMemo(() => new Set(filteredStems.map((stem) => stem.id)), [filteredStems])
  const displayIds = useMemo(
    () => stemIds.filter((id) => filteredIdSet.has(id)),
    [stemIds, filteredIdSet],
  )
  const displayRows = useMemo(
    () => displayIds.flatMap((id) => {
      const row = rowById.get(id)
      return row ? [row] : []
    }),
    [displayIds, rowById],
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

  const expandedStemArray = useMemo(() => Array.from(expandedStemIds), [expandedStemIds])
  const detailQueries = useQueries({
    queries: expandedStemArray.map((stemId) => ({
      queryKey: [...ucatKeys.question(stemId), 'detail'],
      queryFn: () => ucatQuestionsApi.getDetail(stemId),
      enabled: true,
    })),
  })
  const detailsMap = useMemo(() => {
    const map: Record<string, StemDetailRow | null> = {}
    detailQueries.forEach((query, index) => {
      const stemId = expandedStemArray[index]
      if (stemId) map[stemId] = query.data ?? null
    })
    return map
  }, [detailQueries, expandedStemArray])

  const columnViewGroups = useMemo(
    () => [
      {
        heading: 'Stem columns',
        columnDefinitions: SET_MEMBERSHIP_TABLE_COLUMNS,
        visibleColumns: listState.state.visibleColumns,
        onVisibleColumnsChange: listState.actions.onVisibleColumnsChange,
        defaultVisibleColumns: defaultMembershipVisibleColumns,
      },
      {
        heading: 'Question columns',
        columnDefinitions: QUESTION_STEM_NESTED_QUESTION_COLUMNS,
        visibleColumns: visibleQuestionColumns,
        onVisibleColumnsChange: setVisibleQuestionColumns,
        defaultVisibleColumns: defaultVisibleQuestionColumns,
      },
      {
        heading: 'Answer option columns',
        columnDefinitions: QUESTION_STEM_NESTED_ANSWER_COLUMNS,
        visibleColumns: visibleAnswerOptionColumns,
        onVisibleColumnsChange: setVisibleAnswerOptionColumns,
        defaultVisibleColumns: defaultVisibleAnswerOptionColumns,
      },
    ],
    [
      listState.actions.onVisibleColumnsChange,
      listState.state.visibleColumns,
      visibleAnswerOptionColumns,
      visibleQuestionColumns,
    ],
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
      columnDefinitions={SET_MEMBERSHIP_TABLE_COLUMNS}
      visibleColumns={listState.state.visibleColumns}
      onVisibleColumnsChange={listState.actions.onVisibleColumnsChange}
      columnViewGroups={columnViewGroups}
      defaultVisibleColumns={defaultMembershipVisibleColumns}
      emptyMessage={emptyMessage}
      hasItems={displayRows.length > 0}
      hidePagination
      compact={false}
      className={className}
    >
      <UcatQuestionStemsTable
        rows={displayRows}
        visibleColumns={listState.state.visibleColumns}
        visibleQuestionColumns={visibleQuestionColumns}
        visibleAnswerOptionColumns={visibleAnswerOptionColumns}
        categoryPathLookup={categoryPathLookup}
        expandedStemIds={expandedStemIds}
        expandedQuestionKeys={expandedQuestionKeys}
        detailsMap={detailsMap}
        reorderEnabled={!reorderDisabled}
        onReorder={(reorderedVisibleIds) => {
          onStemIdsChange(mergeVisibleOrderIntoFull(stemIds, displayIds, reorderedVisibleIds))
        }}
        onToggleStemExpanded={(stemId) => {
          setExpandedStemIds((current) => {
            const next = new Set(current)
            if (next.has(stemId)) next.delete(stemId)
            else next.add(stemId)
            return next
          })
        }}
        onToggleQuestionExpanded={(stemId, questionId) => {
          const key = `${stemId}-${questionId}`
          setExpandedQuestionKeys((current) => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })
        }}
        getRowActions={(row) => [
          {
            label: row.status === 'published' ? 'View' : 'Edit',
            icon: row.status === 'published' ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />,
            onClick: () => onEditStem?.(row.id),
          },
          {
            label: 'Remove',
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            onClick: () => onStemIdsChange(stemIds.filter((stemId) => stemId !== row.id)),
          },
        ]}
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
