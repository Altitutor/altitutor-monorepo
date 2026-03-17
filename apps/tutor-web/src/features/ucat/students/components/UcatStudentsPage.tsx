'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { DataTable, DataTableToolbar } from '@altitutor/ui'
import { Eye } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import {
  useUcatClassStudentIds,
  useUcatClasses,
  useUcatStudentProgressSummary,
} from '@/features/ucat/students/hooks/useUcatStudents'
import { applySort, useUcatTableState, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { ProgressModeSelector } from '@/features/ucat/students/progress/components/progress-mode-selector'
import {
  type ProgressMode,
  type TimeFrameDays,
  TIME_FRAME_OPTIONS,
} from '@/features/ucat/students/progress/lib/progress-mode'
import type { StudentProgressSummaryRow } from '@/features/ucat/students/api/students'

export function UcatStudentsPage() {
  const [mode, setMode] = useState<ProgressMode>('all_time')
  const [timeFrameDays, setTimeFrameDays] = useState<TimeFrameDays>(
    TIME_FRAME_OPTIONS[2].value
  )

  const access = useUcatAccess()
  const progress = useUcatStudentProgressSummary(mode, timeFrameDays)
  const classes = useUcatClasses()
  const tableState = useUcatTableState([
    'student_name',
    'total_questions',
    'total_sets_attempted',
    'total_mocks_attempted',
    'avg_score_points',
    'exam',
    'actions',
  ])

  const classFilterValue = (tableState.state.filters.class_id?.[0] as string | undefined) ?? 'all'
  const classStudents = useUcatClassStudentIds(
    classFilterValue === 'all' ? null : classFilterValue
  )

  const rows = useMemo(
    () => progress.data?.students ?? [],
    [progress.data?.students]
  )
  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase()
    const allowedIds = new Set(classStudents.data ?? [])

    return rows.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.student_name.toLowerCase().includes(search)
      const classHit =
        classFilterValue === 'all' || allowedIds.has(row.student_id)
      return searchHit && classHit
    })
  }, [rows, tableState.state.search, classStudents.data, classFilterValue])

  const sectionKeys = useMemo(
    () => (progress.data?.sections ?? []).map((s) => `section_${s.id}`),
    [progress.data?.sections]
  )

  const sortedRows = useMemo(
    () =>
      applySort(
        filteredRows,
        tableState.state.sortBy,
        tableState.state.sortDirection,
        {
          student_name: (r) => r.student_name,
          total_questions: (r) => r.total_questions,
          total_sets_attempted: (r) => r.total_sets_attempted,
          total_mocks_attempted: (r) => r.total_mocks_attempted,
          avg_score_points: (r) => r.avg_score_points ?? -1,
          exam: (r) => r.exam ?? -1,
          last_attempted_at: (r) => r.last_attempted_at ?? '',
          ...Object.fromEntries(
            sectionKeys.map((k) => {
              const sectionId = k.replace('section_', '')
              return [
                k,
                (r: StudentProgressSummaryRow) =>
                  r.section_scores[sectionId] ?? -1,
              ]
            })
          ),
        }
      ),
    [
      filteredRows,
      tableState.state.sortBy,
      tableState.state.sortDirection,
      sectionKeys,
    ]
  )

  const allColumns: Array<{ key: string; column: ColumnDef<StudentProgressSummaryRow> }> = [
    { key: 'student_name', column: { accessorKey: 'student_name', header: 'Student' } },
    { key: 'total_questions', column: { accessorKey: 'total_questions', header: 'Questions' } },
    {
      key: 'total_sets_attempted',
      column: { accessorKey: 'total_sets_attempted', header: 'Sets' },
    },
    {
      key: 'total_mocks_attempted',
      column: { accessorKey: 'total_mocks_attempted', header: 'Mocks' },
    },
    {
      key: 'avg_score_points',
      column: {
        accessorKey: 'avg_score_points',
        header: 'Avg Score',
        cell: ({ row }) =>
          row.original.avg_score_points?.toFixed?.(2) ?? '-',
      },
    },
    {
      key: 'exam',
      column: {
        accessorKey: 'exam',
        header: 'Exam',
        cell: ({ row }) =>
          row.original.exam != null ? String(row.original.exam) : '-',
      },
    },
    {
      key: 'last_attempted_at',
      column: {
        accessorKey: 'last_attempted_at',
        header: 'Last Attempted',
        cell: ({ row }) =>
          row.original.last_attempted_at
            ? new Date(row.original.last_attempted_at).toLocaleString()
            : '-',
      },
    },
    ...(progress.data?.sections ?? []).map((sec) => ({
      key: `section_${sec.id}`,
      column: {
        id: `section_${sec.id}`,
        header: sec.name,
        accessorFn: (row: StudentProgressSummaryRow) =>
          row.section_scores[sec.id] ?? null,
        cell: ({ row }: { row: { original: StudentProgressSummaryRow } }) => {
          const score = row.original.section_scores[sec.id]
          return score != null ? String(Math.round(score)) : '-'
        },
      },
    })),
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

  const visibleColumns = useVisibleColumns(
    allColumns,
    tableState.state.visibleColumns
  )

  const columnDefinitions = useMemo(
    () =>
      [
        { key: 'student_name', label: 'Student', visibleByDefault: true },
        { key: 'total_questions', label: 'Questions', visibleByDefault: true },
        { key: 'total_sets_attempted', label: 'Sets', visibleByDefault: true },
        { key: 'total_mocks_attempted', label: 'Mocks', visibleByDefault: true },
        { key: 'avg_score_points', label: 'Avg Score', visibleByDefault: true },
        { key: 'exam', label: 'Exam', visibleByDefault: true },
        { key: 'last_attempted_at', label: 'Last Attempted', visibleByDefault: false },
        ...(progress.data?.sections ?? []).map((sec) => ({
          key: `section_${sec.id}`,
          label: sec.name,
          visibleByDefault: false,
        })),
        { key: 'actions', label: 'Actions', visibleByDefault: true },
      ] as DataTableColumnDefinition[],
    [progress.data?.sections]
  )

  const sortOptions: DataTableSortOption[] = useMemo(
    () => [
      { key: 'student_name', label: 'Student' },
      { key: 'total_questions', label: 'Questions' },
      { key: 'total_sets_attempted', label: 'Sets' },
      { key: 'total_mocks_attempted', label: 'Mocks' },
      { key: 'avg_score_points', label: 'Avg Score' },
      { key: 'exam', label: 'Exam' },
      { key: 'last_attempted_at', label: 'Last Attempted' },
      ...(progress.data?.sections ?? []).map((sec) => ({
        key: `section_${sec.id}`,
        label: sec.name,
      })),
    ],
    [progress.data?.sections]
  )

  if (access.isLoading || progress.isLoading || classes.isLoading || classStudents.isLoading)
    return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  const classFilters: DataTableFilterDefinition[] = [
    {
      key: 'class_id',
      label: 'Class',
      options: (classes.data ?? []).map((row) => ({
        label: row.id ?? 'Unknown',
        value: row.id ?? '',
      })),
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

      <ProgressModeSelector
        mode={mode}
        onModeChange={setMode}
        timeFrameDays={timeFrameDays}
        onTimeFrameDaysChange={setTimeFrameDays}
        showAttemptFilter={false}
        className="mb-4"
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
        <DataTable
          columns={visibleColumns}
          data={sortedRows}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>
    </div>
  )
}
