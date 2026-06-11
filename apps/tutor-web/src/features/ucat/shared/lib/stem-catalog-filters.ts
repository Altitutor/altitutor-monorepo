import type { DataTableFilterDefinition } from '@altitutor/shared'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatSection } from '@/features/ucat/shared/types'
import { mapCategoriesToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applySingleSelectFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'

type CategoryRow = ReturnType<typeof mapCategoriesToOptions>[number]

export function buildStemCatalogFilterDefinitions(
  sections: UcatSection[],
  categories: CategoryRow[],
): DataTableFilterDefinition[] {
  const base: DataTableFilterDefinition[] = [
    { key: 'section_id', label: 'Section' },
    { key: 'question_stem_category_id', label: 'Category' },
    {
      key: 'visibility',
      label: 'Visibility',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
      ],
    },
    {
      key: 'question_type',
      label: 'Type',
      options: [
        { label: 'Multiple Choice', value: 'multiple_choice' },
        { label: 'Syllogism', value: 'syllogism' },
      ],
    },
  ]

  return [
    {
      ...base[0],
      options: sections.map((section) => ({
        label: section.name ?? 'Untitled',
        value: section.section_number ?? 0,
      })),
    },
    {
      ...base[1],
      options: categories.map((category) => ({
        label: taxonomyDisplayLabel(category),
        value: category.id ?? '',
      })),
    },
    base[2],
    base[3],
  ]
}

export function filterStemCatalogItems({
  stems,
  excludedIds,
  search,
  filters,
  limit = 60,
}: {
  stems: UcatStemCatalogItem[]
  excludedIds: string[]
  search: string
  filters: Record<string, unknown[]>
  limit?: number
}): UcatStemCatalogItem[] {
  const questionTypeFilter = filters.question_type?.[0] as string | undefined
  const stemsTableState = {
    search,
    filters,
    sortBy: null,
    sortDirection: 'desc' as const,
    groupBy: null,
    page: 1,
    pageSize: 100,
    visibleColumns: [] as string[],
  }

  return stems
    .filter((stem) => {
      if (excludedIds.includes(stem.id)) return false
      if (!applyCoreStringFilter(stem.text, search)) return false
      if (!applySingleSelectFilter(stemsTableState, 'section_id', stem.sectionNumber)) return false
      if (!applySingleSelectFilter(stemsTableState, 'question_stem_category_id', stem.categoryId)) {
        return false
      }
      if (!applyBooleanTextFilter(stemsTableState, 'visibility', stem.isPrivate)) return false
      if (questionTypeFilter && questionTypeFilter !== 'all') {
        if (!stem.questionTypes.includes(questionTypeFilter as 'multiple_choice' | 'syllogism')) {
          return false
        }
      }
      return true
    })
    .slice(0, limit)
}
