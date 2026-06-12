import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { Badge, getUcatVisibilityColor } from '@altitutor/ui'
import {
  applyBooleanTextFilter,
  applyRangeFilter,
  applySort,
  useVisibleColumns,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import type { UcatSkillTrainerSetRow } from '@/features/ucat/skill-trainer-sets/types'
import { cn } from '@/shared/utils'

export type SkillTrainerSetTableRow = {
  id: string
  name: string
  trainer_key: string
  trainer_name: string
  description: string | null
  item_count: number
  is_private: boolean
  updated_at: string
}

type UseUcatSkillTrainerSetsTableParams = {
  data: UcatSkillTrainerSetRow[] | undefined
  initialVisibleColumns: string[]
  availableColumns?: string[]
  onOpenSet?: (setId: string) => void
}

function formatUpdatedAt(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export function useUcatSkillTrainerSetsTable({
  data,
  initialVisibleColumns,
  availableColumns,
  onOpenSet,
}: UseUcatSkillTrainerSetsTableParams) {
  const tableState = useUcatTableUrlState(initialVisibleColumns, {
    availableColumns: availableColumns ?? initialVisibleColumns,
  })

  const rows: SkillTrainerSetTableRow[] = useMemo(
    () =>
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name || '—',
        trainer_key: row.trainer_key,
        trainer_name: row.trainer_name || '—',
        description: row.description,
        item_count: row.item_count,
        is_private: row.is_private,
        updated_at: row.updated_at,
      })),
    [data],
  )

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.name.toLowerCase().includes(search) ||
        row.trainer_name.toLowerCase().includes(search) ||
        (row.description ?? '').toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)
      const itemCountHit = applyRangeFilter(
        tableState.state,
        'item_count_min',
        'item_count_max',
        row.item_count,
      )
      return searchHit && visibilityHit && itemCountHit
    })
  }, [rows, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        name: (r) => r.name,
        trainer_name: (r) => r.trainer_name,
        item_count: (r) => r.item_count,
        visibility: (r) => (r.is_private ? 'Private' : 'Public'),
        updated_at: (r) => r.updated_at,
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection],
  )

  const allColumns: Array<{ key: string; column: ColumnDef<SkillTrainerSetTableRow> }> = [
    {
      key: 'name',
      column: {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) =>
          onOpenSet ? (
            <button
              type="button"
              className="font-medium hover:underline"
              onClick={() => onOpenSet(row.original.id)}
            >
              {row.original.name}
            </button>
          ) : (
            <Link
              href={`/ucat/skill-trainer-sets/${row.original.id}`}
              className="font-medium hover:underline"
            >
              {row.original.name}
            </Link>
          ),
      },
    },
    {
      key: 'trainer_name',
      column: {
        accessorKey: 'trainer_name',
        header: 'Trainer',
      },
    },
    {
      key: 'item_count',
      column: {
        accessorKey: 'item_count',
        header: 'Items',
        cell: ({ row }) => String(row.original.item_count),
      },
    },
    {
      key: 'visibility',
      column: {
        accessorKey: 'is_private',
        header: 'Visibility',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              'px-1.5 py-0 text-[10px] font-normal',
              getUcatVisibilityColor(row.original.is_private),
            )}
          >
            {row.original.is_private ? 'Private' : 'Public'}
          </Badge>
        ),
      },
    },
    {
      key: 'updated_at',
      column: {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) => formatUpdatedAt(row.original.updated_at),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  return {
    tableState,
    rows: sortedRows,
    visibleColumns,
  }
}
