import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@altitutor/ui'
import {
  applyCoreStringFilter,
  applyEnumFilter,
  applySort,
  useUcatTableState,
  useVisibleColumns,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import type { UcatSkillTrainerItemRow } from '@/features/ucat/skill-trainer/api/items'
import { skillTrainerItemContentSummary } from '@/features/ucat/skill-trainer/lib/content-summary'

export type SkillTrainerItemTableRow = {
  id: string
  summary: string
  approval_status: string
  is_active: boolean
  updated_at: string
  raw: UcatSkillTrainerItemRow
}

type Params = {
  data: UcatSkillTrainerItemRow[] | undefined
  initialVisibleColumns: string[]
  onOpenItem?: (itemId: string) => void
}

function formatUpdatedAt(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export function useUcatSkillTrainerItemsTable({ data, initialVisibleColumns, onOpenItem }: Params) {
  const tableState = useUcatTableState(initialVisibleColumns)

  const rows: SkillTrainerItemTableRow[] = useMemo(
    () =>
      (data ?? []).map((item) => ({
        id: item.id,
        summary: skillTrainerItemContentSummary(item),
        approval_status: item.approval_status,
        is_active: item.is_active,
        updated_at: item.updated_at,
        raw: item,
      })),
    [data]
  )

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => applyCoreStringFilter(row.summary, tableState.state.search))
      .filter((row) => applyEnumFilter(tableState.state, 'approval_status', row.approval_status))
      .filter((row) => {
        const selected = tableState.state.filters.is_active?.[0]
        if (!selected || selected === 'all') return true
        if (selected === 'active') return row.is_active
        if (selected === 'inactive') return !row.is_active
        return true
      })
  }, [rows, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        summary: (r) => r.summary,
        approval_status: (r) => r.approval_status,
        is_active: (r) => (r.is_active ? '1' : '0'),
        updated_at: (r) => r.updated_at,
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const allColumns: Array<{ key: string; column: ColumnDef<SkillTrainerItemTableRow> }> = [
    {
      key: 'summary',
      column: {
        accessorKey: 'summary',
        header: 'Content',
        cell: ({ row }) =>
          onOpenItem ? (
            <button
              type="button"
              className="max-w-md truncate text-left font-medium hover:underline"
              onClick={() => onOpenItem(row.original.id)}
            >
              {row.original.summary}
            </button>
          ) : (
            <span className="max-w-md truncate">{row.original.summary}</span>
          ),
      },
    },
    {
      key: 'approval_status',
      column: {
        accessorKey: 'approval_status',
        header: 'Approval',
        cell: ({ row }) => <span className="capitalize">{row.original.approval_status}</span>,
      },
    },
    {
      key: 'is_active',
      column: {
        accessorKey: 'is_active',
        header: 'Active',
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge variant="outline">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Inactive
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

  return { tableState, rows: sortedRows, visibleColumns }
}
