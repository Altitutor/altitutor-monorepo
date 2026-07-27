'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  applyBooleanTextFilter,
  applyMultiSelectFilter,
  applySort,
  useVisibleColumns,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { UcatVisibilityBadge } from '@/features/ucat/shared/components/UcatVisibilityBadge'
import { UcatVisibilityTableHeaderLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { formatStaffDisplayName } from '@/features/ucat/questions/lib/source-display'
import type {
  UcatLearningModuleRow,
  UcatLearningModuleStudyPlanPriority,
} from '@/features/ucat/learning-modules/types'
import type { UcatAccessScope, UcatContentStatus } from '@/features/ucat/shared/types'
import { formatDateTime } from '@/shared/utils'

export const UCAT_LEARNING_MODULE_SECTION_NONE = '__none__'

export const STUDY_PLAN_PRIORITY_LABELS: Record<UcatLearningModuleStudyPlanPriority, string> = {
  essential: 'Essential',
  recommended: 'Recommended',
  optional: 'Optional',
  excluded: 'Excluded',
}

const STUDY_PLAN_PRIORITY_SORT_ORDER: Record<UcatLearningModuleStudyPlanPriority, number> = {
  essential: 0,
  recommended: 1,
  optional: 2,
  excluded: 3,
}

export type LearningModuleLessonRow = {
  id: string
  title: string
  ucat_section_id: string | null
  section_name: string | null
  section_number: number | null
  index: number
  block_count: number
  access_scope: UcatAccessScope
  status: UcatContentStatus
  created_at: string
  updated_at: string
  created_by: string | null
  created_by_name: string
  deleted_at: string | null
  study_plan_priority: UcatLearningModuleStudyPlanPriority
  study_plan_category_ids: string[]
  study_plan_tag_ids: string[]
}

type UseUcatLearningModulesTableParams = {
  data: UcatLearningModuleRow[] | undefined
  initialVisibleColumns: string[]
  availableColumns: string[]
  status: UcatContentStatus
  categoryPathLookup: Map<string, string>
  tagPathLookup: Map<string, string>
}

function sectionSortKey(sectionNumber: number | null): number {
  return sectionNumber ?? Number.POSITIVE_INFINITY
}

function compareSectionThenIndex(
  a: LearningModuleLessonRow,
  b: LearningModuleLessonRow,
  direction: 'asc' | 'desc' = 'asc',
): number {
  const sectionCmp = sectionSortKey(a.section_number) - sectionSortKey(b.section_number)
  if (sectionCmp !== 0) {
    return direction === 'asc' ? sectionCmp : -sectionCmp
  }
  return a.index - b.index
}

export function useUcatLearningModulesTable({
  data,
  initialVisibleColumns,
  availableColumns,
  status,
  categoryPathLookup,
  tagPathLookup,
}: UseUcatLearningModulesTableParams) {
  const tableState = useUcatTableUrlState(initialVisibleColumns, {
    syncShowDeleted: true,
    availableColumns,
  })
  const showDeleted = tableState.showDeleted ?? false

  const rows: LearningModuleLessonRow[] = useMemo(
    () =>
      (data ?? [])
        .filter((row) => row.kind === 'lesson')
        .map((row) => {
          const createdByName =
            formatStaffDisplayName(row.created_by_first_name, row.created_by_last_name) ??
            (row.created_by ? 'Unknown staff' : '')
          return {
            id: row.id,
            title: row.title || 'Untitled lesson',
            ucat_section_id: row.ucat_section_id,
            section_name: row.section_name,
            section_number: row.section_number,
            index: row.index,
            block_count: row.block_count,
            access_scope: row.access_scope,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by: row.created_by,
            created_by_name: createdByName,
            deleted_at: row.deleted_at,
            study_plan_priority: row.study_plan_priority,
            study_plan_category_ids: row.study_plan_category_ids,
            study_plan_tag_ids: row.study_plan_tag_ids,
          }
        }),
    [data],
  )

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted
      ? rows.filter((row) => row.deleted_at != null)
      : rows.filter((row) => row.deleted_at == null && row.status === status)
    const search = tableState.state.search.trim().toLowerCase()
    return byDeleted.filter((row) => {
      const searchHit = search.length === 0 || row.title.toLowerCase().includes(search)
      const visibilityHit = applyBooleanTextFilter(
        tableState.state,
        'visibility',
        row.access_scope === 'private',
      )
      const sectionValue = row.ucat_section_id ?? UCAT_LEARNING_MODULE_SECTION_NONE
      const sectionHit = applyMultiSelectFilter(tableState.state, 'section_id', sectionValue)
      const createdByHit = applyMultiSelectFilter(tableState.state, 'created_by', row.created_by)
      return searchHit && visibilityHit && sectionHit && createdByHit
    })
  }, [rows, showDeleted, status, tableState.state])

  const sortedRows = useMemo(() => {
    const { sortBy, sortDirection } = tableState.state
    // Default (and explicit Section sort): section number, then hierarchy index within section.
    if (!sortBy || sortBy === 'section') {
      return [...filteredRows].sort((a, b) =>
        compareSectionThenIndex(a, b, sortBy ? sortDirection : 'asc'),
      )
    }
    const primarySorted = applySort(filteredRows, sortBy, sortDirection, {
      title: (row) => row.title,
      section: (row) => sectionSortKey(row.section_number),
      block_count: (row) => row.block_count,
      visibility: (row) => (row.access_scope === 'private' ? 'Private' : 'Public'),
      source: (row) => row.created_by_name,
      created_by: (row) => row.created_by_name,
      created_at: (row) => row.created_at,
      updated_at: (row) => row.updated_at,
      status: (row) => row.status,
      study_plan: (row) => STUDY_PLAN_PRIORITY_SORT_ORDER[row.study_plan_priority],
    })
    return primarySorted
  }, [filteredRows, tableState.state])

  const allColumns: Array<{ key: string; column: ColumnDef<LearningModuleLessonRow> }> = [
    {
      key: 'title',
      column: {
        accessorKey: 'title',
        header: 'Title',
      },
    },
    {
      key: 'section',
      column: {
        id: 'section',
        header: 'Section',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.section_name ?? '—'}</span>
        ),
      },
    },
    {
      key: 'study_plan',
      column: {
        id: 'study_plan',
        header: 'Study plan',
        cell: ({ row }) => {
          const categoryLabels = row.original.study_plan_category_ids
            .map((id) => categoryPathLookup.get(id))
            .filter((label): label is string => Boolean(label))
          const tagLabels = row.original.study_plan_tag_ids
            .map((id) => tagPathLookup.get(id))
            .filter((label): label is string => Boolean(label))
          return (
            <div className="min-w-[9rem] space-y-1 py-0.5">
              <div className="text-sm font-medium">
                {STUDY_PLAN_PRIORITY_LABELS[row.original.study_plan_priority]}
              </div>
              {categoryLabels.length > 0 ? (
                <div className="text-xs text-muted-foreground">{categoryLabels.join(' · ')}</div>
              ) : null}
              {tagLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {row.original.study_plan_tag_ids.map((id) => {
                    const label = tagPathLookup.get(id)
                    if (!label) return null
                    return (
                      <span
                        key={id}
                        className="inline-flex max-w-[12rem] truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        title={label}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        },
      },
    },
    {
      key: 'block_count',
      column: {
        accessorKey: 'block_count',
        header: 'Blocks',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.block_count}</span>
        ),
      },
    },
    {
      key: 'visibility',
      column: {
        accessorKey: 'access_scope',
        header: () => <UcatVisibilityTableHeaderLabel />,
        cell: ({ row }) => (
          <UcatVisibilityBadge isPrivate={row.original.access_scope === 'private'} />
        ),
      },
    },
    {
      key: 'source',
      column: {
        id: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.created_by_name || '—'}</span>
        ),
      },
    },
    {
      key: 'created_at',
      column: {
        accessorKey: 'created_at',
        header: 'Date created',
        cell: ({ row }) => formatDateTime(row.original.created_at) || '—',
      },
    },
    {
      key: 'updated_at',
      column: {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) =>
          row.original.updated_at ? new Date(row.original.updated_at).toLocaleString() : '—',
      },
    },
    {
      key: 'status',
      column: {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="capitalize text-sm text-muted-foreground">{row.original.status}</span>
        ),
      },
    },
  ]

  const visibleColumns = useVisibleColumns(allColumns, tableState.state.visibleColumns)
  const setShowDeleted = tableState.setShowDeleted ?? (() => undefined)

  return {
    tableState,
    rows: sortedRows,
    visibleColumns,
    showDeleted,
    setShowDeleted,
  }
}
