import { useCallback, useMemo, useState } from 'react'

type RowWithId = { id: string }

export function useUcatRowSelection<T extends RowWithId>(paginatedRows: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selectionMode = selectedIds.size > 0

  const allVisibleSelected =
    paginatedRows.length > 0 && paginatedRows.every((row) => selectedIds.has(row.id))
  const someVisibleSelected = paginatedRows.some((row) => selectedIds.has(row.id))

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (paginatedRows.length > 0 && paginatedRows.every((row) => prev.has(row.id))) {
        const next = new Set(prev)
        paginatedRows.forEach((row) => next.delete(row.id))
        return next
      }
      return new Set([...prev, ...paginatedRows.map((row) => row.id)])
    })
  }, [paginatedRows])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  return {
    selectedIds,
    setSelectedIds,
    selectedIdsArray,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection,
    toggleSelectAllVisible,
    clearSelection,
  }
}
