'use client'

import { useUcatTableState } from '@/features/ucat/shared/hooks/useUcatTableState'

export function useUcatCatalogListState(
  initialVisibleColumns: string[],
  options?: { defaultFilters?: Record<string, unknown[]>; defaultPageSize?: number }
) {
  return useUcatTableState(initialVisibleColumns, {
    defaultFilters: options?.defaultFilters,
    defaultPageSize: options?.defaultPageSize ?? 10,
  })
}
