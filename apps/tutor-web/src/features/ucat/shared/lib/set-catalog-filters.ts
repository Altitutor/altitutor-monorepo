import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import type { UcatSection } from '@/features/ucat/shared/types'
import {
  applyBooleanTextFilter,
  applyRangeFilter,
  applySort,
} from '@/features/ucat/shared/hooks/useUcatTableState'

export type SetCatalogSearchScope = 'name' | 'sections'

export const setCatalogSearchScopeOptions: Array<{ value: SetCatalogSearchScope; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'sections', label: 'Sections' },
]

export const defaultSetCatalogSearchScopes: SetCatalogSearchScope[] = ['name', 'sections']

export const setCatalogColumnDefinitions: DataTableColumnDefinition[] = [
  { key: 'name', label: 'Name', visibleByDefault: true },
  { key: 'sections', label: 'Sections', visibleByDefault: true },
  { key: 'time_limit_seconds', label: 'Time Limit', visibleByDefault: true },
  { key: 'stem_count', label: 'Question stems', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
]

export const setCatalogSortOptions: DataTableSortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'sections', label: 'Sections' },
  { key: 'time_limit_seconds', label: 'Time Limit' },
  { key: 'stem_count', label: 'Question stems' },
  { key: 'question_count', label: 'Questions' },
  { key: 'visibility', label: 'Visibility' },
]

const baseSetCatalogFilterDefinitions: DataTableFilterDefinition[] = [
  {
    key: 'visibility',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
    ],
  },
  {
    key: 'time_limit',
    label: 'Time limit (s)',
    type: 'number-range',
    minKey: 'time_limit_min',
    maxKey: 'time_limit_max',
    nullOptionLabel: 'Untimed',
  },
  {
    key: 'stem_count',
    label: 'Question stems',
    type: 'number-range',
    minKey: 'stem_count_min',
    maxKey: 'stem_count_max',
  },
  {
    key: 'question_count',
    label: 'Questions',
    type: 'number-range',
    minKey: 'question_count_min',
    maxKey: 'question_count_max',
  },
]

export function buildSetCatalogFilterDefinitions(
  sections: UcatSection[] = [],
): DataTableFilterDefinition[] {
  const defs: DataTableFilterDefinition[] = [...baseSetCatalogFilterDefinitions]

  if (sections.length > 0) {
    defs.unshift({
      key: 'section',
      label: 'Section',
      options: sections
        .filter((section) => section.section_number != null)
        .sort((a, b) => (a.section_number ?? 0) - (b.section_number ?? 0))
        .map((section) => ({
          label: section.name ?? `Section ${section.section_number}`,
          value: String(section.section_number),
        })),
    })
  }

  return defs
}

export function filterSetCatalogItems({
  sets,
  excludedIds = [],
  search,
  filters,
  searchScopes = defaultSetCatalogSearchScopes,
}: {
  sets: SetOption[]
  excludedIds?: string[]
  search: string
  filters: Record<string, unknown[]>
  searchScopes?: SetCatalogSearchScope[]
}): SetOption[] {
  const tableState = {
    search,
    filters,
    sortBy: null,
    sortDirection: 'desc' as const,
    groupBy: null,
    page: 1,
    pageSize: 100,
    visibleColumns: [] as string[],
  }

  return sets.filter((set) => {
    if (excludedIds.includes(set.id)) return false

    const query = search.trim().toLowerCase()
    const searchHit =
      query.length === 0 ||
      searchScopes.some((scope) => {
        const value = scope === 'name' ? set.name : set.sectionDisplay
        return value.toLowerCase().includes(query)
      })

    const visibilityHit = applyBooleanTextFilter(tableState, 'visibility', set.access_scope === 'private')
    const timeLimitHit = applyRangeFilter(
      tableState,
      'time_limit_min',
      'time_limit_max',
      set.time_limit_seconds ?? null,
      {
        nullFilterKey: 'time_limit',
        treatNonPositiveAsNull: true,
      },
    )
    const stemCountHit = applyRangeFilter(
      tableState,
      'stem_count_min',
      'stem_count_max',
      set.stem_count ?? null,
    )
    const questionCountHit = applyRangeFilter(
      tableState,
      'question_count_min',
      'question_count_max',
      set.question_count ?? null,
    )

    const sectionFilter = (filters.section ?? []).map(String)
    const sectionHit =
      sectionFilter.length === 0 ||
      sectionFilter.some((sectionValue) => {
        if (set.firstSectionNumber != null) {
          return String(set.firstSectionNumber) === sectionValue
        }
        return set.sectionDisplay.toLowerCase().includes(sectionValue.toLowerCase())
      })

    return searchHit && visibilityHit && timeLimitHit && stemCountHit && questionCountHit && sectionHit
  })
}

export function sortSetCatalogItems(
  sets: SetOption[],
  sortBy: string | null,
  sortDirection: 'asc' | 'desc',
): SetOption[] {
  return applySort(sets, sortBy, sortDirection, {
    name: (set) => set.name,
    sections: (set) => set.sectionDisplay,
    time_limit_seconds: (set) => set.time_limit_seconds,
    stem_count: (set) => set.stem_count,
    question_count: (set) => set.question_count,
    visibility: (set) => (set.access_scope === 'private' ? 'Private' : 'Public'),
  })
}

export function getDefaultSetCatalogVisibleColumns(): string[] {
  return setCatalogColumnDefinitions.filter((column) => column.visibleByDefault).map((column) => column.key)
}
