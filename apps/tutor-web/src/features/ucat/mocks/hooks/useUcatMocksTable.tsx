'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  applyBooleanTextFilter,
  applySort,
  useVisibleColumns,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { UcatVisibilityBadge } from '@/features/ucat/shared/components/UcatVisibilityBadge'
import { UcatVisibilityTableHeaderLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { MockSetsColumnCellWithData } from '@/features/ucat/shared/components/MockSetsColumnCellWithData'
import type { UcatSectionForStatus } from '@/features/ucat/shared/lib/set-section-status'

export type MockRow = {
  id: string
  name: string
  is_private: boolean
  set_count: number
  updated_at: string | null
  deleted_at: string | null
}

type MockListRowInput = {
  id?: string | null
  name?: string | null
  is_private?: boolean | null
  set_count?: number | null
  updated_at?: string | null
  deleted_at?: string | null
}

type UseUcatMocksTableParams<T extends MockListRowInput> = {
  data: T[] | undefined
  initialVisibleColumns: string[]
  availableColumns: string[]
  sections: UcatSectionForStatus[]
  onOpenSet: (setId: string) => void
}

export function useUcatMocksTable<T extends MockListRowInput>({
  data,
  initialVisibleColumns,
  availableColumns,
  sections,
  onOpenSet,
}: UseUcatMocksTableParams<T>) {
  const tableState = useUcatTableUrlState(initialVisibleColumns, {
    syncShowDeleted: true,
    availableColumns,
  })
  const showDeleted = tableState.showDeleted ?? false

  const rows: MockRow[] = useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.id ?? '',
        name: row.name ?? 'Untitled',
        is_private: !!row.is_private,
        set_count: row.set_count ?? 0,
        updated_at: row.updated_at ?? null,
        deleted_at: row.deleted_at ?? null,
      })),
    [data],
  )

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted
      ? rows.filter((row) => row.deleted_at != null)
      : rows.filter((row) => row.deleted_at == null)
    const search = tableState.state.search.trim().toLowerCase()
    return byDeleted.filter((row) => {
      const searchHit = search.length === 0 || row.name.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)
      return searchHit && visibilityHit
    })
  }, [rows, showDeleted, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        name: (row) => row.name,
        visibility: (row) => (row.is_private ? 'Private' : 'Public'),
        set_count: (row) => row.set_count,
        updated_at: (row) => row.updated_at ?? '',
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection],
  )

  const allColumns: Array<{ key: string; column: ColumnDef<MockRow> }> = [
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'visibility',
      column: {
        accessorKey: 'is_private',
        header: () => <UcatVisibilityTableHeaderLabel />,
        cell: ({ row }) => <UcatVisibilityBadge isPrivate={row.original.is_private} />,
      },
    },
    {
      key: 'set_count',
      column: {
        accessorKey: 'set_count',
        header: 'Sets',
        cell: ({ row }) => (
          <MockSetsColumnCellWithData
            mockId={row.original.id}
            setCount={row.original.set_count}
            sections={sections}
            onOpenSet={onOpenSet}
          />
        ),
      },
    },
    {
      key: 'updated_at',
      column: {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) =>
          row.original.updated_at ? new Date(row.original.updated_at).toLocaleString() : '-',
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)
  const setShowDeleted = tableState.setShowDeleted ?? (() => undefined)

  return {
    tableState,
    rows: sortedRows,
    visibleColumns,
    showDeleted,
    setShowDeleted,
  }
}
