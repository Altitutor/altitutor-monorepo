'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DataTableState, QuickFilter } from '@altitutor/shared'
import {
  clearUcatTableUrlParams,
  isUcatTableStateEqual,
  parseShowDeletedFromUrl,
  parseUcatTableStateFromUrl,
  UCAT_TABLE_URL_RESERVED_PARAMS,
  writeShowDeletedToUrl,
  writeUcatTableStateToUrl,
} from '@/features/ucat/shared/lib/ucat-table-url-state'

export type UseUcatTableUrlStateOptions = {
  defaultFilters?: Record<string, unknown[]>
  defaultPageSize?: number
  paramPrefix?: string
  availableColumns?: string[]
  reservedParams?: readonly string[]
  /** When true, sync `showDeleted` to URL (`deleted=1`). */
  syncShowDeleted?: boolean
  /** Disable URL read/write (e.g. ephemeral modal lists). */
  enabled?: boolean
}

function buildDefaultState(
  initialVisibleColumns: string[],
  defaultFilters: Record<string, unknown[]>,
  defaultPageSize: number,
): DataTableState {
  return {
    search: '',
    filters: defaultFilters,
    sortBy: null,
    sortDirection: 'desc',
    groupBy: null,
    page: 1,
    pageSize: defaultPageSize,
    visibleColumns: initialVisibleColumns,
  }
}

export function useUcatTableUrlState(
  initialVisibleColumns: string[],
  options?: UseUcatTableUrlStateOptions,
) {
  const {
    defaultFilters = {},
    defaultPageSize = 20,
    paramPrefix,
    availableColumns,
    reservedParams = UCAT_TABLE_URL_RESERVED_PARAMS,
    syncShowDeleted = false,
    enabled = true,
  } = options ?? {}

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const parseOptions = useMemo(
    () => ({
      initialVisibleColumns,
      defaultFilters,
      defaultPageSize,
      paramPrefix,
      availableColumns,
    }),
    [initialVisibleColumns, availableColumns, defaultFilters, defaultPageSize, paramPrefix],
  )

  const defaultState = useMemo(
    () => buildDefaultState(initialVisibleColumns, defaultFilters, defaultPageSize),
    [initialVisibleColumns, defaultFilters, defaultPageSize],
  )

  const [state, setState] = useState<DataTableState>(() =>
    enabled
      ? parseUcatTableStateFromUrl(searchParams, parseOptions)
      : defaultState,
  )

  const [showDeleted, setShowDeletedState] = useState(() =>
    enabled && syncShowDeleted
      ? parseShowDeletedFromUrl(searchParams, { paramPrefix })
      : false,
  )

  const skipUrlSyncRef = useRef(false)
  const lastWrittenQueryRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  const showDeletedRef = useRef(showDeleted)
  stateRef.current = state
  showDeletedRef.current = showDeleted

  const syncToUrl = useCallback(
    (nextState: DataTableState, nextShowDeleted?: boolean) => {
      if (!enabled) return
      const params = new URLSearchParams(searchParamsString)
      writeUcatTableStateToUrl(params, nextState, { paramPrefix, defaultPageSize, reservedParams })
      if (syncShowDeleted) {
        writeShowDeletedToUrl(params, nextShowDeleted ?? showDeletedRef.current, { paramPrefix })
      }
      const query = params.toString()
      if (query === searchParamsString) return
      lastWrittenQueryRef.current = query
      skipUrlSyncRef.current = true
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [enabled, searchParamsString, paramPrefix, defaultPageSize, reservedParams, syncShowDeleted, router, pathname],
  )

  useEffect(() => {
    if (!enabled) return
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false
      return
    }
    if (lastWrittenQueryRef.current === searchParamsString) {
      lastWrittenQueryRef.current = null
      return
    }

    const params = new URLSearchParams(searchParamsString)
    const nextState = parseUcatTableStateFromUrl(params, parseOptions)
    setState((prev) => (isUcatTableStateEqual(prev, nextState) ? prev : nextState))

    if (syncShowDeleted) {
      const nextShowDeleted = parseShowDeletedFromUrl(params, { paramPrefix })
      setShowDeletedState((prev) => (prev === nextShowDeleted ? prev : nextShowDeleted))
    }
  }, [enabled, searchParamsString, parseOptions, syncShowDeleted, paramPrefix])

  const updateState = useCallback(
    (updater: DataTableState | ((prev: DataTableState) => DataTableState)) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (isUcatTableStateEqual(prev, next)) return prev
        syncToUrl(next)
        return next
      })
    },
    [syncToUrl],
  )

  const setShowDeleted = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      if (!syncShowDeleted) return
      setShowDeletedState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        if (next !== prev) {
          syncToUrl(stateRef.current, next)
        }
        return next
      })
    },
    [syncShowDeleted, syncToUrl],
  )

  const actions = useMemo(
    () => ({
      onSearchChange: (value: string) =>
        updateState((prev) => ({ ...prev, search: value, page: 1 })),
      onFiltersChange: (filters: Record<string, unknown[]>) =>
        updateState((prev) => ({ ...prev, filters, page: 1 })),
      onSortChange: (field: string | null, direction: 'asc' | 'desc') =>
        updateState((prev) => ({ ...prev, sortBy: field, sortDirection: direction })),
      onGroupByChange: (field: string | null) =>
        updateState((prev) => ({ ...prev, groupBy: field })),
      onVisibleColumnsChange: (columns: string[]) =>
        updateState((prev) => ({ ...prev, visibleColumns: columns })),
      onQuickFilterApply: (qf: QuickFilter) =>
        updateState((prev) => ({
          ...prev,
          filters: qf.config as Record<string, unknown[]>,
          page: 1,
        })),
      onReset: () => {
        const resetState = buildDefaultState(initialVisibleColumns, defaultFilters, defaultPageSize)
        setState(resetState)
        if (syncShowDeleted) setShowDeletedState(false)
        syncToUrl(resetState, syncShowDeleted ? false : undefined)
      },
      onPageChange: (page: number) => updateState((prev) => ({ ...prev, page })),
      onPageSizeChange: (pageSize: number) =>
        updateState((prev) => ({ ...prev, pageSize, page: 1 })),
    }),
    [updateState, syncToUrl, initialVisibleColumns, defaultFilters, defaultPageSize, syncShowDeleted],
  )

  const clearUrlParams = useCallback(() => {
    if (!enabled) return
    const params = new URLSearchParams(searchParamsString)
    clearUcatTableUrlParams(params, { paramPrefix, reservedParams })
    const query = params.toString()
    lastWrittenQueryRef.current = query
    skipUrlSyncRef.current = true
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [enabled, searchParamsString, paramPrefix, reservedParams, router, pathname])

  return {
    state,
    setState: updateState,
    actions,
    ...(syncShowDeleted ? { showDeleted, setShowDeleted } : {}),
    clearUrlParams,
  }
}
