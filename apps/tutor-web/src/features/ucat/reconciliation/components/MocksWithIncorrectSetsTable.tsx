'use client'

import React, { useMemo } from 'react'
import { TableRow, TableCell, Button, DataTableToolbar } from '@altitutor/ui'
import { Pencil } from 'lucide-react'
import { ReconciliationTable } from './ReconciliationTable'
import type { MockWithIncorrectSets } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { applyCoreStringFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import type { DataTableColumnDefinition, DataTableSortOption } from '@altitutor/shared'
import { tutorTableBodyRow } from '@/shared/lib/tutor-visual'

export function MocksWithIncorrectSetsTable({
  onEditMock,
}: {
  onEditMock: (mockId: string) => void
}) {
  const { data, isLoading } = useReconciliationData()
  const items = useMemo(() => data?.mocksWithIncorrectSets ?? [], [data?.mocksWithIncorrectSets])

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'name', label: 'Name', visibleByDefault: true },
    { key: 'sets', label: 'Sets', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'sets', label: 'Sets' },
  ]

  const tableState = useUcatTableUrlState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key), {
    paramPrefix: 'incorrectMocks',
    availableColumns: columnDefinitions.map((c) => c.key),
  })

  const accessors = useMemo(
    () => ({
      name: (r: MockWithIncorrectSets) => r.name,
      sets: (r: MockWithIncorrectSets) => r.sets.map((s) => s.name).join(', '),
    }),
    []
  )

  const filteredItems = useMemo(() => {
    let result = items
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter(
        (r) =>
          applyCoreStringFilter(accessors.name(r), search) ||
          applyCoreStringFilter(accessors.sets(r), search)
      )
    }
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, accessors)
    return result
  }, [items, tableState.state, accessors])

  const toolbar = (
    <DataTableToolbar
      state={tableState.state}
      onSearchChange={tableState.actions.onSearchChange}
      onFiltersChange={tableState.actions.onFiltersChange}
      onSortChange={tableState.actions.onSortChange}
      onGroupByChange={tableState.actions.onGroupByChange}
      onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
      onQuickFilterApply={tableState.actions.onQuickFilterApply}
      onReset={tableState.actions.onReset}
      filterDefinitions={[]}
      columnDefinitions={columnDefinitions}
      sortOptions={sortOptions}
      searchPlaceholder="Search mocks..."
    />
  )

  return (
    <ReconciliationTable<MockWithIncorrectSets>
      title="Mocks with incorrect number or order of sets"
      items={filteredItems}
      isLoading={isLoading}
      columnDefinitions={columnDefinitions}
      visibleColumnKeys={tableState.state.visibleColumns}
      toolbar={toolbar}
      renderRow={(item) => (
        <MockReconciliationRow
          key={item.id}
          item={item}
          visibleColumnKeys={tableState.state.visibleColumns}
          onEditMock={onEditMock}
        />
      )}
    />
  )
}

function MockReconciliationRow({
  item,
  visibleColumnKeys,
  onEditMock,
}: {
  item: MockWithIncorrectSets
  visibleColumnKeys: string[]
  onEditMock: (mockId: string) => void
}) {
  const setsDisplay = item.sets.map((s) => s.name).join(' · ')

  const cells: Record<string, React.ReactNode> = {
    name: <TableCell className="font-medium">{item.name || '—'}</TableCell>,
    sets: (
      <TableCell className="max-w-[400px] text-muted-foreground">
        <span className="block truncate" title={setsDisplay}>
          {setsDisplay || '—'}
        </span>
      </TableCell>
    ),
  }

  return (
    <TableRow className={tutorTableBodyRow}>
      {visibleColumnKeys.map((key) => cells[key]).filter((c): c is React.ReactNode => c != null)}
      <TableCell>
        <Button variant="default" size="sm" onClick={() => onEditMock(item.id)}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit mock
        </Button>
      </TableCell>
    </TableRow>
  )
}
