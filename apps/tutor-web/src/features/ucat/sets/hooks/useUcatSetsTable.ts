import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  applyBooleanTextFilter,
  applyRangeFilter,
  applySort,
  applySingleSelectFilter,
  useUcatTableState,
  useVisibleColumns,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { formatSecondsToDuration } from '@/features/ucat/shared/lib/time-utils'
import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type SetRow = {
  id: string
  name: string
  time_limit_seconds: number | null
  is_private: boolean
  is_student_generated: boolean
  stem_count: number
  question_count: number
  created_by_first_name: string | null
  created_by_last_name: string | null
  deleted_at: string | null
}

type UseUcatSetsTableParams<T> = {
  data: T[] | undefined
  showDeleted: boolean
  defaultFilters: Record<string, unknown[]>
}

type SetRowInput = {
  id?: string | null
  name?: unknown
  time_limit_seconds?: number | null
  is_private?: boolean | null
  is_student_generated?: boolean | null
  created_by_first_name?: string | null
  created_by_last_name?: string | null
  stem_count?: number | null
  question_count?: number | null
  deleted_at?: string | null
}

export function useUcatSetsTable<T extends SetRowInput>({
  data,
  showDeleted,
  defaultFilters,
}: UseUcatSetsTableParams<T>) {
  const baseColumns: Array<{ key: string; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'time_limit_seconds', label: 'Time Limit' },
    { key: 'stem_count', label: 'Question stems' },
    { key: 'question_count', label: 'Questions' },
    { key: 'visibility', label: 'Visibility' },
    { key: 'created_by', label: 'Created by' },
  ]

  const tableState = useUcatTableState(
    baseColumns.map((c) => c.key),
    {
      defaultFilters,
    }
  )

  const rows: SetRow[] = useMemo(
    () =>
      (data ?? []).map((row) => {
        const r = row as T & { stem_count?: number; question_count?: number; deleted_at?: string | null }
        return {
          id: row.id ?? '',
          name: proseMirrorToPlainText((row.name ?? null) as Json | null) || '—',
          time_limit_seconds: row.time_limit_seconds ?? null,
          is_private: !!row.is_private,
          is_student_generated: !!row.is_student_generated,
          stem_count: r.stem_count ?? 0,
          question_count: r.question_count ?? 0,
          created_by_first_name: row.created_by_first_name ?? null,
          created_by_last_name: row.created_by_last_name ?? null,
          deleted_at: r.deleted_at ?? null,
        }
      }),
    [data]
  )

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted ? rows.filter((row) => row.deleted_at != null) : rows.filter((row) => row.deleted_at == null)
    const search = tableState.state.search.trim().toLowerCase()
    return byDeleted.filter((row) => {
      const searchHit = search.length === 0 || row.name.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)
      const originValue = row.is_student_generated ? 'student' : 'staff'
      const originHit = applySingleSelectFilter(tableState.state, 'is_student_generated', originValue)
      const timeLimitHit = applyRangeFilter(tableState.state, 'time_limit_min', 'time_limit_max', row.time_limit_seconds)
      const stemCountHit = applyRangeFilter(tableState.state, 'stem_count_min', 'stem_count_max', row.stem_count)
      const questionCountHit = applyRangeFilter(
        tableState.state,
        'question_count_min',
        'question_count_max',
        row.question_count
      )
      return searchHit && visibilityHit && originHit && timeLimitHit && stemCountHit && questionCountHit
    })
  }, [rows, showDeleted, tableState.state])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        name: (r) => r.name,
        time_limit_seconds: (r) => r.time_limit_seconds ?? -1,
        stem_count: (r) => r.stem_count,
        question_count: (r) => r.question_count,
        visibility: (r) => (r.is_private ? 'Private' : 'Public'),
        created_by: (r) =>
          r.is_student_generated ? 'Student' : [r.created_by_first_name, r.created_by_last_name].filter(Boolean).join(' ') || '',
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const allColumns: Array<{ key: string; column: ColumnDef<SetRow> }> = [
    { key: 'name', column: { accessorKey: 'name', header: 'Name' } },
    {
      key: 'time_limit_seconds',
      column: {
        accessorKey: 'time_limit_seconds',
        header: 'Time Limit',
        cell: ({ row }) => formatSecondsToDuration(row.original.time_limit_seconds),
      },
    },
    {
      key: 'stem_count',
      column: {
        accessorKey: 'stem_count',
        header: 'Question stems',
        cell: ({ row }) => String(row.original.stem_count),
      },
    },
    {
      key: 'question_count',
      column: {
        accessorKey: 'question_count',
        header: 'Questions',
        cell: ({ row }) => String(row.original.question_count),
      },
    },
    {
      key: 'visibility',
      column: {
        accessorKey: 'is_private',
        header: 'Visibility',
        cell: ({ row }) => (row.original.is_private ? 'Private' : 'Public'),
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

export type { SetRow }

