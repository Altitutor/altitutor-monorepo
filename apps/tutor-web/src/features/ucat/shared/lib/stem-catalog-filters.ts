import type { DataTableColumnDefinition, DataTableFilterDefinition } from '@altitutor/shared'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatSection } from '@/features/ucat/shared/types'
import {
  applyBooleanTextFilter,
  applyCategoryFilter,
  applyCoreStringFilter,
  applyMultiSelectFilter,
  applyTagFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { mapCategoriesToOptions, mapTagsToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  filterCategoriesForSections,
  filterTagsForSections,
  type CategoryRowForSectionFilter,
  type TagRowForSectionFilter,
} from '@/features/ucat/shared/lib/taxonomy-reparent'
import { resolveSectionIdsFromNumberFilter } from '@/features/ucat/shared/lib/taxonomy-section-filter'
import { UCAT_FILTER_NO_CATEGORY } from '@/features/ucat/shared/lib/table-filter-sentinel'

export const stemCatalogColumnDefinitions: DataTableColumnDefinition[] = [
  { key: 'created_at', label: 'Date created', visibleByDefault: false },
]

const baseStemCatalogFilterDefinitions: DataTableFilterDefinition[] = [
  { key: 'section_id', label: 'Section' },
  { key: 'question_stem_category_id', label: 'Category' },
  { key: 'question_tag_id', label: 'Tag' },
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

export function buildStemCatalogFilterDefinitions(
  sections: UcatSection[],
  categoryRows: CategoryRowForSectionFilter[],
  tagRows: TagRowForSectionFilter[] = [],
  filters: Record<string, unknown[]> = {},
): DataTableFilterDefinition[] {
  const selectedSectionIds = resolveSectionIdsFromNumberFilter(sections, filters)
  const categories = mapCategoriesToOptions(filterCategoriesForSections(categoryRows, selectedSectionIds))
  const tags = mapTagsToOptions(filterTagsForSections(tagRows, selectedSectionIds))

  return [
    {
      ...baseStemCatalogFilterDefinitions[0],
      options: sections.map((section) => ({
        label: section.name ?? 'Untitled',
        value: section.section_number ?? 0,
      })),
    },
    {
      ...baseStemCatalogFilterDefinitions[1],
      options: [
        { label: 'No category', value: UCAT_FILTER_NO_CATEGORY },
        ...categories.map((category) => ({
          label: taxonomyDisplayLabel(category),
          value: category.id ?? '',
        })),
      ],
    },
    {
      ...baseStemCatalogFilterDefinitions[2],
      options: tags.map((tag) => ({
        label: tag.label ?? tag.name,
        value: tag.id,
      })),
    },
    baseStemCatalogFilterDefinitions[3],
    baseStemCatalogFilterDefinitions[4],
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
      if (!applyMultiSelectFilter(stemsTableState, 'section_id', stem.sectionNumber)) return false
      if (!applyCategoryFilter(stemsTableState, stem.categoryId, UCAT_FILTER_NO_CATEGORY)) return false
      if (!applyTagFilter(stemsTableState, stem.tagIds)) return false
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
