'use client'

import { useMemo, useState } from 'react'
import type { DataTableState, QuickFilter } from '@altitutor/shared'

export function useUcatTableState(
  initialVisibleColumns: string[],
  options?: { defaultFilters?: Record<string, unknown[]>; defaultPageSize?: number }
) {
  const defaultFilters = options?.defaultFilters ?? {}
  const [state, setState] = useState<DataTableState>({
    search: '',
    filters: defaultFilters,
    sortBy: null,
    sortDirection: 'desc',
    groupBy: null,
    page: 1,
    pageSize: options?.defaultPageSize ?? 20,
    visibleColumns: initialVisibleColumns,
    defaultVisibleColumns: initialVisibleColumns,
  })

  return {
    state,
    setState,
    actions: {
      onSearchChange: (value: string) => setState((prev) => ({ ...prev, search: value, page: 1 })),
      onFiltersChange: (filters: Record<string, unknown[]>) => setState((prev) => ({ ...prev, filters, page: 1 })),
      onSortChange: (field: string | null, direction: 'asc' | 'desc') =>
        setState((prev) => ({ ...prev, sortBy: field, sortDirection: direction })),
      onGroupByChange: (field: string | null) => setState((prev) => ({ ...prev, groupBy: field })),
      onVisibleColumnsChange: (columns: string[]) => setState((prev) => ({ ...prev, visibleColumns: columns })),
      onQuickFilterApply: (qf: QuickFilter) =>
        setState((prev) => ({ ...prev, filters: qf.config as Record<string, unknown[]>, page: 1 })),
      onReset: () =>
        setState((prev) => ({ ...prev, search: '', filters: {}, sortBy: null, sortDirection: 'desc', groupBy: null, page: 1 })),
      onPageChange: (page: number) => setState((prev) => ({ ...prev, page })),
      onPageSizeChange: (pageSize: number) => setState((prev) => ({ ...prev, pageSize, page: 1 })),
    },
  }
}

export function getSingleFilterValue(state: DataTableState, key: string): string {
  const values = state.filters[key]
  if (!values || values.length === 0) return 'all'
  return String(values[0])
}

/** Get all filter values for a key (for multi-select OR filtering). */
export function getFilterValues(state: DataTableState, key: string): unknown[] {
  const values = state.filters[key]
  if (!Array.isArray(values)) return []
  return values.filter((v) => v !== 'all')
}

export function applyCoreStringFilter(value: string | null | undefined, search: string) {
  if (!search.trim()) return true
  return (value ?? '').toLowerCase().includes(search.toLowerCase())
}

export function applySingleSelectFilter(state: DataTableState, key: string, rawValue: unknown) {
  const selected = getSingleFilterValue(state, key)
  if (selected === 'all') return true
  return String(rawValue ?? '') === selected
}

/** Multi-select filter: row matches when its value is among selected values. */
export function applyMultiSelectFilter(state: DataTableState, key: string, rawValue: unknown) {
  const selected = getFilterValues(state, key).map(String)
  if (selected.length === 0) return true
  return selected.includes(String(rawValue ?? ''))
}

/** Category filter supporting a sentinel value for uncategorised stems. */
export function applyCategoryFilter(
  state: DataTableState,
  categoryId: string | null | undefined,
  noneSentinel: string
) {
  const selected = getSingleFilterValue(state, 'question_stem_category_id')
  if (selected === 'all') return true
  if (selected === noneSentinel) return categoryId == null || categoryId === ''
  return String(categoryId ?? '') === selected
}

/** Multi-select tag filter: stem matches when it has any selected tag. */
export function applyTagFilter(state: DataTableState, tagIds: string[], key = 'question_tag_id') {
  const selected = getFilterValues(state, key).map(String)
  if (selected.length === 0) return true
  return selected.some((id) => tagIds.includes(id))
}

export function applyBooleanTextFilter(state: DataTableState, key: string, value: boolean) {
  const selected = getSingleFilterValue(state, key)
  if (selected === 'all') return true
  if (selected === 'private') return value
  if (selected === 'public') return !value
  return true
}

export function applyEnumFilter(state: DataTableState, key: string, value: string | null | undefined) {
  const selected = getSingleFilterValue(state, key)
  if (selected === 'all') return true
  return (value ?? '') === selected
}

export function useVisibleColumns<T extends object>(
  allColumns: Array<{ key: string; column: T }>,
  visibleColumnKeys: string[]
) {
  return useMemo(
    () => allColumns.filter((entry) => visibleColumnKeys.includes(entry.key)).map((entry) => entry.column),
    [allColumns, visibleColumnKeys]
  )
}

/** Get first filter value as number, or null if unset/invalid */
export function getRangeFilterMin(state: DataTableState, key: string): number | null {
  const values = state.filters[key]
  if (!values || values.length === 0) return null
  const n = Number(values[0])
  return Number.isFinite(n) ? n : null
}

/** Get first filter value as number (upper bound), or null if unset/invalid */
export function getRangeFilterMax(state: DataTableState, key: string): number | null {
  const values = state.filters[key]
  if (!values || values.length === 0) return null
  const n = Number(values[0])
  return Number.isFinite(n) ? n : null
}

/** Sentinel stored on a number-range filter `key` when its null option is selected. */
export const RANGE_FILTER_NULL_VALUE = '__null__'

export function isRangeNullFilterSelected(state: DataTableState, filterKey: string): boolean {
  return (state.filters[filterKey] ?? []).some((v) => String(v) === RANGE_FILTER_NULL_VALUE)
}

type ApplyRangeFilterOptions = {
  /** Filter key that holds `RANGE_FILTER_NULL_VALUE` when the null option is selected */
  nullFilterKey?: string
  /** Treat <= 0 the same as null (e.g. untimed time limits) */
  treatNonPositiveAsNull?: boolean
}

/**
 * Range bounds are inclusive: value >= min and value <= max when set.
 * When a null option is selected, nullish values match (OR with any range match).
 */
export function applyRangeFilter(
  state: DataTableState,
  minKey: string,
  maxKey: string,
  value: number | null,
  options?: ApplyRangeFilterOptions
): boolean {
  const min = getRangeFilterMin(state, minKey)
  const max = getRangeFilterMax(state, maxKey)
  const nullSelected =
    options?.nullFilterKey != null && isRangeNullFilterSelected(state, options.nullFilterKey)
  const hasBound = min != null || max != null

  if (!hasBound && !nullSelected) return true

  const isNullish = value == null || (options?.treatNonPositiveAsNull === true && value <= 0)

  if (isNullish) return nullSelected

  if (!hasBound) return false
  if (min != null && value < min) return false
  if (max != null && value > max) return false
  return true
}

function compareSortValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  const na = a == null ? NaN : Number(a)
  const nb = b == null ? NaN : Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    const cmp = na - nb
    return direction === 'asc' ? cmp : -cmp
  }
  const sa = a == null ? '' : String(a)
  const sb = b == null ? '' : String(b)
  const cmp = sa.localeCompare(sb, undefined, { numeric: true })
  return direction === 'asc' ? cmp : -cmp
}

/** Sort rows by sortBy key using accessors; returns new array. No-op if sortBy is null. */
export function applySort<T>(
  rows: T[],
  sortBy: string | null,
  sortDirection: 'asc' | 'desc',
  accessors: Record<string, (row: T) => unknown>
): T[] {
  if (!sortBy || !accessors[sortBy]) return rows
  const getVal = accessors[sortBy]
  return [...rows].sort((a, b) => compareSortValues(getVal(a), getVal(b), sortDirection))
}
