'use client'

import { useMemo, useState } from 'react'
import type { DataTableState, QuickFilter } from '@altitutor/shared'

export function useUcatTableState(
  initialVisibleColumns: string[],
  options?: { defaultFilters?: Record<string, unknown[]> }
) {
  const defaultFilters = options?.defaultFilters ?? {}
  const [state, setState] = useState<DataTableState>({
    search: '',
    filters: defaultFilters,
    sortBy: null,
    sortDirection: 'desc',
    groupBy: null,
    page: 1,
    pageSize: 20,
    visibleColumns: initialVisibleColumns,
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

/** Range bounds are inclusive: value >= min and value <= max when set. */
export function applyRangeFilter(
  state: DataTableState,
  minKey: string,
  maxKey: string,
  value: number | null
): boolean {
  const min = getRangeFilterMin(state, minKey)
  const max = getRangeFilterMax(state, maxKey)
  const hasBound = min != null || max != null
  if (value === null) return !hasBound
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
