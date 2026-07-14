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
import type { UcatAccessScope, UcatContentStatus } from '@/features/ucat/shared/types'

export type MockRow = {
  id: string
  name: string
  access_scope: UcatAccessScope
  status: UcatContentStatus
  set_count: number
  updated_at: string | null
  deleted_at: string | null
}

type MockListRowInput = {
  id?: string | null
  name?: string | null
  access_scope?: UcatAccessScope | null
  status?: UcatContentStatus | null
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
  status: UcatContentStatus
}

export function useUcatMocksTable<T extends MockListRowInput>({
  data,
  initialVisibleColumns,
  availableColumns,
  sections,
  onOpenSet,
  status,
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
        access_scope: row.access_scope ?? 'public',
        status: row.status ?? 'draft',
        set_count: row.set_count ?? 0,
        updated_at: row.updated_at ?? null,
        deleted_at: row.deleted_at ?? null,
      })),
    [data],
  )

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted
      ? rows.filter((row) => row.deleted_at != null)
      : rows.filter((row) => row.deleted_at == null && row.status === status)
    const search = tableState.state.search.trim().toLowerCase()
    return byDeleted.filter((row) => {
      const searchHit = search.length === 0 || row.name.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.access_scope === 'private')
      return searchHit && visibilityHit
    })
  }, [rows, showDeleted, status, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        name: (row) => row.name,
        visibility: (row) => (row.access_scope === 'private' ? 'Private' : 'Public'),
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
        accessorKey: 'access_scope',
        header: () => <UcatVisibilityTableHeaderLabel />,
        cell: ({ row }) => <UcatVisibilityBadge isPrivate={row.original.access_scope === 'private'} />,
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
