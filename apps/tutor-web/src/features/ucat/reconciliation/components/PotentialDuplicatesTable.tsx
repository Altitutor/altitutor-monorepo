'use client'

import { useMemo, useState } from 'react'
import { Button, DataTableToolbar, TableCell, TableRow } from '@altitutor/ui'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import type { Json } from '@altitutor/shared'
import { ReconciliationTable } from './ReconciliationTable'
import { PotentialDuplicatesReconciliationDialog } from './PotentialDuplicatesReconciliationDialog'
import type { PotentialDuplicatePair } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  applyCoreStringFilter,
  applySingleSelectFilter,
  applySort,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorTableBodyRow, tutorToolbarProps } from '@/shared/lib/tutor-visual'

const TRUNCATE_LEN = 72

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '…'
}

function stemPlain(pair: PotentialDuplicatePair, side: 'A' | 'B'): string {
  const stem = side === 'A' ? pair.stemA : pair.stemB
  return proseMirrorToPlainText(stem.stemText as Json) ?? ''
}

export function PotentialDuplicatesTable() {
  const { data, isLoading } = useReconciliationData()
  const sectionsQuery = useUcatSections()
  const [searchScopes, setSearchScopes] = useState(['stem_a', 'stem_b', 'section_name'])
  const [queueOpen, setQueueOpen] = useState(false)
  const [initialPairId, setInitialPairId] = useState<string | null>(null)

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'section', label: 'Section', visibleByDefault: true },
    { key: 'stem_a', label: 'Stem A', visibleByDefault: true },
    { key: 'stem_b', label: 'Stem B', visibleByDefault: true },
    { key: 'similarity', label: 'Similarity', visibleByDefault: true },
  ]

  const sortOptions: DataTableSortOption[] = [
    { key: 'section', label: 'Section' },
    { key: 'similarity', label: 'Similarity' },
    { key: 'stem_a', label: 'Stem A' },
    { key: 'stem_b', label: 'Stem B' },
  ]

  const tableState = useUcatTableUrlState(
    columnDefinitions.filter((c) => c.visibleByDefault !== false).map((c) => c.key),
    {
      paramPrefix: 'potentialDuplicates',
      availableColumns: columnDefinitions.map((c) => c.key),
    },
  )

  const sectionFilterDef: DataTableFilterDefinition = useMemo(
    () => ({
      key: 'section_id',
      label: 'Section',
      options: (sectionsQuery.data ?? []).map((s) => ({ label: s.name ?? 'Untitled', value: s.id ?? '' })),
    }),
    [sectionsQuery.data],
  )

  const accessors = useMemo(
    () => ({
      section: (pair: PotentialDuplicatePair) => pair.sectionName,
      stem_a: (pair: PotentialDuplicatePair) => stemPlain(pair, 'A'),
      stem_b: (pair: PotentialDuplicatePair) => stemPlain(pair, 'B'),
      similarity: (pair: PotentialDuplicatePair) => Math.max(pair.tokenRatio, pair.trigramRatio),
    }),
    [],
  )

  const filteredPairs = useMemo(() => {
    let result = data?.potentialDuplicatePairs ?? []
    const { search } = tableState.state
    if (search.trim()) {
      result = result.filter((pair) => {
        const values: Record<string, string> = {
          stem_a: accessors.stem_a(pair),
          stem_b: accessors.stem_b(pair),
          section_name: pair.sectionName,
        }
        return searchScopes.some((scope) => applyCoreStringFilter(values[scope] ?? '', search))
      })
    }
    result = result.filter((pair) => applySingleSelectFilter(tableState.state, 'section_id', pair.sectionId))
    result = applySort(result, tableState.state.sortBy, tableState.state.sortDirection, accessors)
    return result
  }, [data?.potentialDuplicatePairs, tableState.state, accessors, searchScopes])

  function openQueue(pairId?: string) {
    setInitialPairId(pairId ?? null)
    setQueueOpen(true)
  }

  return (
    <>
      <ReconciliationTable<PotentialDuplicatePair>
        title="Potential duplicates"
        items={filteredPairs}
        isLoading={isLoading}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={tableState.state.visibleColumns}
        toolbar={
          <DataTableToolbar
            {...tutorToolbarProps}
            state={tableState.state}
            onSearchChange={tableState.actions.onSearchChange}
            onFiltersChange={tableState.actions.onFiltersChange}
            onSortChange={tableState.actions.onSortChange}
            onGroupByChange={tableState.actions.onGroupByChange}
            onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
            onQuickFilterApply={tableState.actions.onQuickFilterApply}
            onReset={tableState.actions.onReset}
            searchPlaceholder="Search duplicate pairs..."
            filterDefinitions={[sectionFilterDef]}
            columnDefinitions={columnDefinitions}
            sortOptions={sortOptions}
            searchFromOptions={[
              { label: 'Stem A', value: 'stem_a' },
              { label: 'Stem B', value: 'stem_b' },
              { label: 'Section', value: 'section_name' },
            ]}
            searchFromValue={searchScopes}
            onSearchFromChange={setSearchScopes}
          />
        }
        headerActions={
          <Button
            size="sm"
            className={tutorBtnPrimary}
            onClick={() => openQueue()}
            disabled={filteredPairs.length === 0}
          >
            Begin reconciling
          </Button>
        }
        renderRow={(item, _index, visibleColumnKeys) => (
          <PotentialDuplicateRow
            key={item.id}
            item={item}
            visibleColumnKeys={visibleColumnKeys}
            onCompare={() => openQueue(item.id)}
          />
        )}
      />
      <PotentialDuplicatesReconciliationDialog
        open={queueOpen}
        pairs={filteredPairs}
        initialPairId={initialPairId}
        onOpenChange={(nextOpen) => {
          setQueueOpen(nextOpen)
          if (!nextOpen) setInitialPairId(null)
        }}
      />
    </>
  )
}

function PotentialDuplicateRow({
  item,
  visibleColumnKeys,
  onCompare,
}: {
  item: PotentialDuplicatePair
  visibleColumnKeys: string[]
  onCompare: () => void
}) {
  const stemA = truncate(stemPlain(item, 'A'), TRUNCATE_LEN)
  const stemB = truncate(stemPlain(item, 'B'), TRUNCATE_LEN)
  const similarityPct = Math.round(Math.max(item.tokenRatio, item.trigramRatio) * 100)

  const cells: Record<string, React.ReactNode> = {
    section: <TableCell className="whitespace-nowrap">{item.sectionName || '-'}</TableCell>,
    stem_a: (
      <TableCell className="max-w-[260px]" title={stemPlain(item, 'A')}>
        {stemA || '-'}
      </TableCell>
    ),
    stem_b: (
      <TableCell className="max-w-[260px]" title={stemPlain(item, 'B')}>
        {stemB || '-'}
      </TableCell>
    ),
    similarity: <TableCell className="whitespace-nowrap">{similarityPct}%</TableCell>,
  }

  return (
    <TableRow className={cn(tutorTableBodyRow)}>
      {visibleColumnKeys.map((key) => cells[key]).filter((cell): cell is React.ReactNode => cell != null)}
      <TableCell>
        <Button variant="outline" size="sm" className={tutorBtnOutline} onClick={onCompare}>
          Compare
        </Button>
      </TableCell>
    </TableRow>
  )
}
