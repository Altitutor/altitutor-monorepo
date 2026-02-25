'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { DataTable, DataTableToolbar } from '@altitutor/ui'
import { Eye } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatClassStudentIds, useUcatClasses, useUcatStudentProgress } from '@/features/ucat/students/hooks/useUcatStudents'
import { applySort, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'

type StudentRow = {
  student_id: string
  student_name: string
  total_sets_attempted: number
  total_mocks_attempted: number
  avg_score_points: number | null
  avg_scaled_score: number | null
  last_attempted_at: string | null
}

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'student_name', label: 'Student', visibleByDefault: true },
  { key: 'total_sets_attempted', label: 'Sets', visibleByDefault: true },
  { key: 'total_mocks_attempted', label: 'Mocks', visibleByDefault: true },
  { key: 'avg_score_points', label: 'Avg Score', visibleByDefault: true },
  { key: 'avg_scaled_score', label: 'Avg Scaled', visibleByDefault: true },
  { key: 'last_attempted_at', label: 'Last Attempted', visibleByDefault: true },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'student_name', label: 'Student' },
  { key: 'total_sets_attempted', label: 'Sets' },
  { key: 'total_mocks_attempted', label: 'Mocks' },
  { key: 'avg_score_points', label: 'Avg Score' },
  { key: 'avg_scaled_score', label: 'Avg Scaled' },
  { key: 'last_attempted_at', label: 'Last Attempted' },
]

export function UcatStudentsPage() {
  const access = useUcatAccess()
  const progress = useUcatStudentProgress()
  const classes = useUcatClasses()
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const classFilter = (tableState.state.filters.class_id?.[0] as string | undefined) ?? 'all'
  const classStudents = useUcatClassStudentIds(classFilter === 'all' ? null : classFilter)

  const rows: StudentRow[] = (progress.data ?? []).map((row) => ({
    student_id: row.student_id ?? '',
    student_name: row.student_name ?? '-',
    total_sets_attempted: row.total_sets_attempted ?? 0,
    total_mocks_attempted: row.total_mocks_attempted ?? 0,
    avg_score_points: row.avg_score_points,
    avg_scaled_score: row.avg_scaled_score,
    last_attempted_at: row.last_attempted_at,
  }))

  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    const allowedIds = new Set(classStudents.data ?? [])

    return rows.filter((row) => {
      const searchHit = search.length === 0 || row.student_name.toLowerCase().includes(search)
      const classHit = classFilter === 'all' || allowedIds.has(row.student_id)
      return searchHit && classHit
    })
  }, [rows, tableState.state.search, classStudents.data, classFilter])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        student_name: (r) => r.student_name,
        total_sets_attempted: (r) => r.total_sets_attempted,
        total_mocks_attempted: (r) => r.total_mocks_attempted,
        avg_score_points: (r) => r.avg_score_points ?? -1,
        avg_scaled_score: (r) => r.avg_scaled_score ?? -1,
        last_attempted_at: (r) => r.last_attempted_at ?? '',
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const allColumns: Array<{ key: string; column: ColumnDef<StudentRow> }> = [
    { key: 'student_name', column: { accessorKey: 'student_name', header: 'Student' } },
    { key: 'total_sets_attempted', column: { accessorKey: 'total_sets_attempted', header: 'Sets' } },
    { key: 'total_mocks_attempted', column: { accessorKey: 'total_mocks_attempted', header: 'Mocks' } },
    {
      key: 'avg_score_points',
      column: {
        accessorKey: 'avg_score_points',
        header: 'Avg Score',
        cell: ({ row }) => row.original.avg_score_points?.toFixed?.(2) ?? '-',
      },
    },
    {
      key: 'avg_scaled_score',
      column: {
        accessorKey: 'avg_scaled_score',
        header: 'Avg Scaled',
        cell: ({ row }) => row.original.avg_scaled_score?.toFixed?.(2) ?? '-',
      },
    },
    {
      key: 'last_attempted_at',
      column: {
        accessorKey: 'last_attempted_at',
        header: 'Last Attempted',
        cell: ({ row }) => (row.original.last_attempted_at ? new Date(row.original.last_attempted_at).toLocaleString() : '-'),
      },
    },
    {
      key: 'actions',
      column: {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions
              actions={[
                {
                  label: 'View',
                  icon: <Eye className="h-4 w-4" />,
                  href: `/ucat/students/${row.original.student_id}`,
                },
              ]}
            />
          </div>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)

  if (access.isLoading || progress.isLoading || classes.isLoading || classStudents.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  const classFilters: DataTableFilterDefinition[] = [
    {
      key: 'class_id',
      label: 'Class',
      options: (classes.data ?? []).map((row) => ({ label: row.id ?? 'Unknown', value: row.id ?? '' })),
    },
  ]

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Students"
        description="Track student progress across sets and mocks"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Students' }]}
      />

      <DataTableToolbar
        state={tableState.state}
        onSearchChange={tableState.actions.onSearchChange}
        onFiltersChange={tableState.actions.onFiltersChange}
        onSortChange={tableState.actions.onSortChange}
        onGroupByChange={tableState.actions.onGroupByChange}
        onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
        onQuickFilterApply={tableState.actions.onQuickFilterApply}
        onReset={tableState.actions.onReset}
        filterDefinitions={classFilters}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchPlaceholder="Search students"
      />

      <div className="pt-3">
        <DataTable columns={visibleColumns} data={sortedRows} pageSizeOptions={[10, 20, 50]} />
      </div>
    </div>
  )
}
