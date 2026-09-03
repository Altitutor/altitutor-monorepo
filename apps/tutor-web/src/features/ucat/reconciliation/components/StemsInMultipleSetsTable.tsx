'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
  Button,
  DataTableToolbar,
  TableCell,
  TableRow,
  useToast,
} from '@altitutor/ui'
import { useQueryClient } from '@tanstack/react-query'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { ReconciliationTable } from './ReconciliationTable'
import type { StemInMultipleSets } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { getQuestionIssueDefinition } from '../lib/question-issue-definitions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  applyCoreStringFilter,
  applySingleSelectFilter,
  applySort,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { lifecycleErrorToast } from '@/features/ucat/shared/lifecycle-errors'
import { tutorBtnOutline, tutorTableBodyRow, tutorToolbarProps } from '@/shared/lib/tutor-visual'

const ISSUE = getQuestionIssueDefinition('in-multiple-sets')
const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

export function StemsInMultipleSetsTable({
  onOpenStemDialog,
  onEditSet,
  showCountBadge = true,
}: {
  onOpenStemDialog?: (stemId: string) => void
  onEditSet?: (setId: string) => void
  showCountBadge?: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useReconciliationData()
  const sectionsQuery = useUcatSections()
  const [searchScopes, setSearchScopes] = useState(['stem_text', 'sets', 'section_id'])
  const [removingKey, setRemovingKey] = useState<string | null>(null)

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'section_id', label: 'Section', visibleByDefault: true },
    { key: 'stem_text', label: 'Question stem', visibleByDefault: true },
    { key: 'sets', label: 'Sets', visibleByDefault: true },
    { key: 'set_count', label: 'Set count', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'section_id', label: 'Section' },
    { key: 'stem_text', label: 'Question stem' },
    { key: 'set_count', label: 'Set count' },
  ]

  const tableState = useUcatTableUrlState(
    columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key),
    {
      paramPrefix: 'inMultipleSets',
      availableColumns: columnDefinitions.map((c) => c.key),
    },
  )

  const sectionFilterDef: DataTableFilterDefinition = useMemo(
    () => ({
      key: 'section_id',
      label: 'Section',
      options: (sectionsQuery.data ?? []).map((s) => ({
        label: s.name ?? 'Untitled',
        value: s.id ?? '',
      })),
    }),
    [sectionsQuery.data],
  )

  const accessors = useMemo(
    () => ({
      section_id: (row: StemInMultipleSets) => row.sectionName,
      stem_text: (row: StemInMultipleSets) =>
        proseMirrorToPlainText(row.stemText as import('@altitutor/shared').Json) ?? '',
      sets: (row: StemInMultipleSets) => row.sets.map((set) => set.name).join(', '),
      set_count: (row: StemInMultipleSets) => row.sets.length,
    }),
    [],
  )

  const filteredItems = useMemo(() => {
    let result = data?.stemsInMultipleSets ?? []
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter((row) =>
        searchScopes.some((scope) =>
          applyCoreStringFilter(String(accessors[scope as keyof typeof accessors](row)), search),
        ),
      )
    }
    result = result.filter((row) =>
      applySingleSelectFilter(tableState.state, 'section_id', row.sectionId),
    )
    return applySort(result, tableState.state.sortBy, tableState.state.sortDirection, accessors)
  }, [data?.stemsInMultipleSets, tableState.state, accessors, searchScopes])

  const handleRemoveFromSet = useCallback(
    async (stemId: string, setId: string) => {
      const key = `${stemId}:${setId}`
      setRemovingKey(key)
      try {
        await ucatSetsApi.removeStemsFromSet(setId, [stemId])
        await queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
        await queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
        toast({
          title: 'Removed from set',
          description: 'The question stem was removed from that set.',
        })
      } catch (error) {
        toast(lifecycleErrorToast(error, 'Could not remove from set', () => undefined, (entityType, entityId) => {
          if (entityType === 'set') {
            onEditSet?.(entityId)
            return true
          }
          if (entityType === 'stem') {
            onOpenStemDialog?.(entityId)
            return true
          }
          return false
        }))
      } finally {
        setRemovingKey(null)
      }
    },
    [queryClient, toast, onEditSet, onOpenStemDialog],
  )

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
      filterDefinitions={[sectionFilterDef]}
      columnDefinitions={columnDefinitions}
      sortOptions={sortOptions}
      {...tutorToolbarProps}
      searchPlaceholder="Search stems..."
      searchFromOptions={[
        { label: 'Question stem', value: 'stem_text' },
        { label: 'Sets', value: 'sets' },
        { label: 'Section', value: 'section_id' },
      ]}
      searchFromValue={searchScopes}
      onSearchFromChange={setSearchScopes}
    />
  )

  return (
    <ReconciliationTable<StemInMultipleSets>
      title={ISSUE.title}
      description={ISSUE.description}
      showCountBadge={showCountBadge}
      items={filteredItems}
      isLoading={isLoading}
      columnDefinitions={columnDefinitions}
      visibleColumnKeys={tableState.state.visibleColumns}
      toolbar={toolbar}
      renderRow={(item) => (
        <StemInMultipleSetsRow
          key={item.id}
          item={item}
          visibleColumnKeys={tableState.state.visibleColumns}
          removingKey={removingKey}
          onOpenStemDialog={onOpenStemDialog}
          onEditSet={onEditSet}
          onRemoveFromSet={handleRemoveFromSet}
        />
      )}
    />
  )
}

function StemInMultipleSetsRow({
  item,
  visibleColumnKeys,
  removingKey,
  onOpenStemDialog,
  onEditSet,
  onRemoveFromSet,
}: {
  item: StemInMultipleSets
  visibleColumnKeys: string[]
  removingKey: string | null
  onOpenStemDialog?: (stemId: string) => void
  onEditSet?: (setId: string) => void
  onRemoveFromSet: (stemId: string, setId: string) => Promise<void>
}) {
  const stemText =
    proseMirrorToPlainText(item.stemText as import('@altitutor/shared').Json) ?? ''
  const stemTruncated = truncate(stemText, TRUNCATE_LEN)

  return (
    <TableRow className={tutorTableBodyRow}>
      {visibleColumnKeys.includes('section_id') ? (
        <TableCell className="whitespace-nowrap">{item.sectionName || '—'}</TableCell>
      ) : null}
      {visibleColumnKeys.includes('stem_text') ? (
        <TableCell className="max-w-[300px]" title={stemText}>
          {stemTruncated || '—'}
        </TableCell>
      ) : null}
      {visibleColumnKeys.includes('sets') ? (
        <TableCell className="min-w-[280px]">
          <ul className="space-y-1.5">
            {item.sets.map((set) => {
              const key = `${item.id}:${set.id}`
              return (
                <li key={set.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    onClick={() => onEditSet?.(set.id)}
                    title={set.name}
                  >
                    {set.name}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={tutorBtnOutline}
                    disabled={removingKey === key}
                    onClick={() => void onRemoveFromSet(item.id, set.id)}
                  >
                    {removingKey === key ? 'Removing…' : 'Remove'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </TableCell>
      ) : null}
      {visibleColumnKeys.includes('set_count') ? (
        <TableCell className="whitespace-nowrap">{item.sets.length}</TableCell>
      ) : null}
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          className={tutorBtnOutline}
          onClick={() => onOpenStemDialog?.(item.id)}
        >
          Edit stem
        </Button>
      </TableCell>
    </TableRow>
  )
}
