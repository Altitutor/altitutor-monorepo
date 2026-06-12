'use client'

import React, { useMemo } from 'react'
import { TableRow, TableCell, Button, DataTableToolbar } from '@altitutor/ui'
import { Pencil } from 'lucide-react'
import { ReconciliationTable } from './ReconciliationTable'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { formatSetTimeLimit } from '@/features/ucat/shared/lib/time-utils'
import type { SetReconciliationRow } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { applyCoreStringFilter, applySort } from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import type { DataTableColumnDefinition, DataTableSortOption } from '@altitutor/shared'
import { tutorTableBodyRow } from '@/shared/lib/tutor-visual'

export function SetsReconciliationTable({
  title,
  dataKey,
  onEditSet,
  showTimeColumn = false,
}: {
  title: string
  dataKey: 'setsWithIncorrectQuestionCount' | 'setsWithIncorrectTiming' | 'setsWithMultipleSections'
  onEditSet: (setId: string) => void
  showTimeColumn?: boolean
}) {
  const { data, isLoading } = useReconciliationData()
  const items = useMemo(() => data?.[dataKey] ?? [], [data, dataKey])

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'name', label: 'Name', visibleByDefault: true },
    { key: 'section', label: 'Section', visibleByDefault: true },
    ...(showTimeColumn ? [{ key: 'time_limit', label: 'Time limit', visibleByDefault: true } as DataTableColumnDefinition] : []),
    { key: 'stem_count', label: 'Question stems', visibleByDefault: true },
    { key: 'question_count', label: 'Questions', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'name', label: 'Name' },
    { key: 'section', label: 'Section' },
    ...(showTimeColumn ? [{ key: 'time_limit', label: 'Time limit' } as DataTableSortOption] : []),
    { key: 'stem_count', label: 'Question stems' },
    { key: 'question_count', label: 'Questions' },
  ]

  const urlParamPrefix =
    dataKey === 'setsWithIncorrectQuestionCount'
      ? 'incorrectQuestionCount'
      : dataKey === 'setsWithIncorrectTiming'
        ? 'incorrectTiming'
        : 'multipleSections'
  const tableState = useUcatTableUrlState(columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key), {
    paramPrefix: urlParamPrefix,
    availableColumns: columnDefinitions.map((c) => c.key),
  })

  const accessors = useMemo(
    () => ({
      name: (r: SetReconciliationRow) => r.name,
      section: (r: SetReconciliationRow) => r.sectionDisplay,
      time_limit: (r: SetReconciliationRow) => r.timeLimitSeconds ?? -1,
      stem_count: (r: SetReconciliationRow) => String(r.stemCount),
      question_count: (r: SetReconciliationRow) => String(r.questionCount),
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
          applyCoreStringFilter(accessors.section(r), search)
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
      searchPlaceholder="Search sets..."
    />
  )

  return (
    <ReconciliationTable<SetReconciliationRow>
      title={title}
      items={filteredItems}
      isLoading={isLoading}
      columnDefinitions={columnDefinitions}
      visibleColumnKeys={tableState.state.visibleColumns}
      toolbar={toolbar}
      renderRow={(item) => (
        <SetReconciliationRow
          key={item.id}
          item={item}
          visibleColumnKeys={tableState.state.visibleColumns}
          onEditSet={onEditSet}
          showTimeColumn={showTimeColumn}
        />
      )}
    />
  )
}

function SetReconciliationRow({
  item,
  visibleColumnKeys,
  onEditSet,
  showTimeColumn = false,
}: {
  item: SetReconciliationRow
  visibleColumnKeys: string[]
  onEditSet: (setId: string) => void
  showTimeColumn?: boolean
}) {
  const sectionsStatus = item.sectionCount === 1 ? 'match' : 'mismatch'
  const sectionsTooltip =
    item.sectionCount === 1
      ? 'This set contains questions from a single UCAT section.'
      : 'This set contains questions from multiple UCAT sections.'

  const cells: Record<string, React.ReactNode> = {
    name: <TableCell className="font-medium">{item.name || '—'}</TableCell>,
    section: (
      <TableCell>
        <SetStatusSpan status={sectionsStatus} tooltip={sectionsTooltip}>
          {item.sectionDisplay || '—'}
        </SetStatusSpan>
      </TableCell>
    ),
    ...(showTimeColumn
      ? {
          time_limit: (
            <TableCell>
              <SetStatusSpan status={item.timeLimitStatus} tooltip={item.timeLimitTooltip}>
                {formatSetTimeLimit(item.timeLimitSeconds)}
              </SetStatusSpan>
            </TableCell>
          ),
        }
      : {}),
    stem_count: <TableCell>{item.stemCount}</TableCell>,
    question_count: (
      <TableCell>
        <SetStatusSpan status={item.questionCountStatus} tooltip={item.questionCountTooltip}>
          {item.questionCount}
        </SetStatusSpan>
      </TableCell>
    ),
  }

  return (
    <TableRow className={tutorTableBodyRow}>
      {visibleColumnKeys.map((key) => cells[key]).filter((c): c is React.ReactNode => c != null)}
      <TableCell>
        <Button variant="default" size="sm" onClick={() => onEditSet(item.id)}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit set
        </Button>
      </TableCell>
    </TableRow>
  )
}
