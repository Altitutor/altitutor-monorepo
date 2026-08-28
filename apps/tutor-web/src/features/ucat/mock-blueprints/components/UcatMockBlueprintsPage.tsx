'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { Button, DataTable, DataTableToolbar, TablePagination, useToast } from '@altitutor/ui'
import { Pencil } from 'lucide-react'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { applyRangeFilter, applySort, useVisibleColumns } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { tutorBtnPrimary, tutorDataTableProps, tutorToolbarProps } from '@/shared/lib/tutor-visual'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { useUcatCategories } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  useCreateUcatMockBlueprintVersion,
  useUcatMockBlueprintsList,
} from '@/features/ucat/mock-blueprints/hooks/useUcatMockBlueprints'
import { UcatMockBlueprintDialog } from '@/features/ucat/mock-blueprints/components/UcatMockBlueprintDialog'
import type { MockBlueprintPayload, MockBlueprintRow } from '@/features/ucat/mock-blueprints/types'

const FILTERS: DataTableFilterDefinition[] = [
  { type: 'number-range', key: 'test_year', label: 'Test year', minKey: 'test_year_min', maxKey: 'test_year_max' },
  { type: 'number-range', key: 'version', label: 'Version', minKey: 'version_min', maxKey: 'version_max' },
]

const COLUMNS: DataTableColumnDefinition[] = [
  { key: 'code', label: 'Blueprint', visibleByDefault: true },
  { key: 'test_year', label: 'Test year', visibleByDefault: true },
  { key: 'version', label: 'Version', visibleByDefault: true },
  { key: 'category_rules', label: 'Category rules', visibleByDefault: true },
  { key: 'question_total', label: 'Total questions', visibleByDefault: true },
  { key: 'created_at', label: 'Created', visibleByDefault: false },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const SORTS: DataTableSortOption[] = [
  { key: 'code', label: 'Blueprint' },
  { key: 'test_year', label: 'Test year' },
  { key: 'version', label: 'Version' },
  { key: 'category_rules', label: 'Category rules' },
  { key: 'question_total', label: 'Total questions' },
  { key: 'created_at', label: 'Created' },
]

function sectionSummary(sections: unknown): { categoryRules: number; questionTotal: number } {
  if (!Array.isArray(sections)) return { categoryRules: 0, questionTotal: 0 }
  return sections.reduce((summary, value) => {
    if (!value || typeof value !== 'object') return summary
    const section = value as { exactQuestionCount?: unknown; altitutorCompositionPolicy?: unknown }
    const policy = section.altitutorCompositionPolicy && typeof section.altitutorCompositionPolicy === 'object'
      ? section.altitutorCompositionPolicy as { categoryRules?: unknown }
      : null
    return {
      categoryRules: summary.categoryRules + (Array.isArray(policy?.categoryRules) ? policy.categoryRules.length : 0),
      questionTotal: summary.questionTotal + (typeof section.exactQuestionCount === 'number' ? section.exactQuestionCount : 0),
    }
  }, { categoryRules: 0, questionTotal: 0 })
}

type TableRow = MockBlueprintRow & { category_rules: number; question_total: number }

export function UcatMockBlueprintsPage() {
  const access = useUcatAccess()
  const blueprints = useUcatMockBlueprintsList()
  const sections = useUcatSections()
  const categories = useUcatCategories()
  const createVersion = useCreateUcatMockBlueprintVersion()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [source, setSource] = useState<MockBlueprintRow | null>(null)
  const tableState = useUcatTableUrlState(
    COLUMNS.filter((column) => column.visibleByDefault).map((column) => column.key),
    { availableColumns: COLUMNS.map((column) => column.key) },
  )

  const rows = useMemo<TableRow[]>(() => (blueprints.data ?? []).map((row) => {
    const summary = sectionSummary(row.sections)
    return { ...row, category_rules: summary.categoryRules, question_total: summary.questionTotal }
  }), [blueprints.data])

  const sortedRows = useMemo(() => {
    const query = tableState.state.search.trim().toLowerCase()
    const filtered = rows.filter((row) => (
      (!query || row.code.toLowerCase().includes(query) || String(row.test_year).includes(query))
      && applyRangeFilter(tableState.state, 'test_year_min', 'test_year_max', row.test_year)
      && applyRangeFilter(tableState.state, 'version_min', 'version_max', row.version)
    ))
    return applySort(filtered, tableState.state.sortBy, tableState.state.sortDirection, {
      code: (row) => row.code,
      test_year: (row) => row.test_year,
      version: (row) => row.version,
      category_rules: (row) => row.category_rules,
      question_total: (row) => row.question_total,
      created_at: (row) => row.created_at ?? '',
    })
  }, [rows, tableState.state])

  const allColumns: Array<{ key: string; column: ColumnDef<TableRow> }> = [
    { key: 'code', column: { accessorKey: 'code', header: 'Blueprint' } },
    { key: 'test_year', column: { accessorKey: 'test_year', header: 'Test year' } },
    { key: 'version', column: { accessorKey: 'version', header: 'Version', cell: ({ row }) => `v${row.original.version}` } },
    { key: 'category_rules', column: { accessorKey: 'category_rules', header: 'Category rules' } },
    { key: 'question_total', column: { accessorKey: 'question_total', header: 'Total questions' } },
    {
      key: 'created_at',
      column: {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : '—',
      },
    },
    {
      key: 'actions',
      column: {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions actions={[{
              label: 'Edit',
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => {
                setSource(row.original)
                setDialogOpen(true)
              },
            }]} />
          </div>
        ),
      },
    },
  ]
  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / tableState.state.pageSize))
  const page = Math.min(tableState.state.page, pageCount)
  const paginatedRows = sortedRows.slice((page - 1) * tableState.state.pageSize, page * tableState.state.pageSize)

  if (access.isLoading || blueprints.isLoading || sections.isLoading || categories.isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  async function save(payload: MockBlueprintPayload) {
    const result = await createVersion.mutateAsync(payload)
    setDialogOpen(false)
    setSource(null)
    toast({
      title: source ? 'Blueprint version created' : 'Mock blueprint created',
      description: source ? `${source.code} remains available for existing mocks.` : `Created blueprint ${result.id}.`,
    })
  }

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Mock Blueprints"
        description="Manage immutable, test-year-specific full-mock composition rules"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Mock Blueprints' }]}
        actions={<Button className={tutorBtnPrimary} onClick={() => { setSource(null); setDialogOpen(true) }}>Add Blueprint</Button>}
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
        filterDefinitions={FILTERS}
        columnDefinitions={COLUMNS}
        sortOptions={SORTS}
        searchPlaceholder="Search blueprints"
        {...tutorToolbarProps}
      />
      <div className="pt-3">
        <DataTable {...tutorDataTableProps} columns={visibleColumns} data={paginatedRows} pagination="external" />
        <TablePagination
          page={page}
          pageSize={tableState.state.pageSize}
          total={sortedRows.length}
          onPageChange={tableState.actions.onPageChange}
          onPageSizeChange={tableState.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          className="pt-3"
        />
      </div>
      <UcatMockBlueprintDialog
        open={dialogOpen}
        source={source}
        sections={sections.data ?? []}
        categories={categories.data ?? []}
        isSaving={createVersion.isPending}
        onClose={() => { setDialogOpen(false); setSource(null) }}
        onSave={save}
      />
    </div>
  )
}

