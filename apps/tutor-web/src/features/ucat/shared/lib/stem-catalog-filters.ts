import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatContentStatus, UcatSection } from '@/features/ucat/shared/types'
import { UCAT_CONTENT_STATUS_OPTIONS } from '@/features/ucat/shared/types'
import {
  applyBooleanTextFilter,
  applyCategoryFilter,
  applyMultiSelectFilter,
  applySort,
  applyTagFilter,
  getFilterValues,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { mapCategoriesToOptions, mapTagsToOptions, resolveCategoryPathLabel, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  filterCategoriesForSections,
  filterTagsForSections,
  type CategoryRowForSectionFilter,
  type TagRowForSectionFilter,
} from '@/features/ucat/shared/lib/taxonomy-reparent'
import { resolveSectionIdsFromIdFilter } from '@/features/ucat/shared/lib/taxonomy-section-filter'
import {
  UCAT_FILTER_NO_CATEGORY,
  UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET,
  UCAT_FILTER_NOT_IN_ANY_SET,
} from '@/features/ucat/shared/lib/table-filter-sentinel'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'

export type StemCatalogSearchScope = 'stem_text' | 'question_text' | 'answer_option_text'

export const stemCatalogSearchScopeOptions: Array<{ value: StemCatalogSearchScope; label: string }> = [
  { value: 'stem_text', label: 'Stem text' },
  { value: 'question_text', label: 'Question text' },
  { value: 'answer_option_text', label: 'Answer options' },
]

export const defaultStemCatalogSearchScopes: StemCatalogSearchScope[] = [
  'stem_text',
  'question_text',
  'answer_option_text',
]

export const stemCatalogColumnDefinitions: DataTableColumnDefinition[] = [
  { key: 'section_name', label: 'Section', visibleByDefault: true },
  { key: 'category_name', label: 'Category', visibleByDefault: false },
  { key: 'stem_text', label: 'Stem text', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'sets', label: 'Sets', visibleByDefault: false },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'created_at', label: 'Date created', visibleByDefault: false },
  { key: 'type_summary', label: 'Type', visibleByDefault: false },
]

export const stemCatalogSortOptions: DataTableSortOption[] = [
  { key: 'section_name', label: 'Section' },
  { key: 'category_name', label: 'Category' },
  { key: 'stem_text', label: 'Stem text' },
  { key: 'question_count', label: 'Questions' },
  { key: 'sets', label: 'Sets' },
  { key: 'type_summary', label: 'Type' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'created_at', label: 'Date created' },
]

const baseStemCatalogFilterDefinitions: DataTableFilterDefinition[] = [
  { key: 'section_id', label: 'Section' },
  { key: 'question_stem_category_id', label: 'Category' },
  { key: 'question_tag_id', label: 'Tag' },
  {
    key: 'status',
    label: 'Status',
    options: UCAT_CONTENT_STATUS_OPTIONS.map((option) => ({
      label: option.label,
      value: option.value,
    })),
  },
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

/** Default add-stem sidebar filters when editing a published set. */
export function getDefaultStemCatalogFiltersForSetStatus(
  setStatus: UcatContentStatus | null | undefined,
): Record<string, unknown[]> {
  if (setStatus !== 'published') return {}
  return {
    status: ['published'],
    question_set_id: [UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET],
  }
}

export function stemIsInAnotherPublishedSet(
  stemSetIds: string[],
  publishedSetIds: ReadonlySet<string>,
  currentSetId?: string | null,
): boolean {
  return stemSetIds.some((setId) => setId !== currentSetId && publishedSetIds.has(setId))
}

type SetFilterOption = { label: string; value: string }

const EMPTY_PUBLISHED_SET_IDS: ReadonlySet<string> = new Set()

export function buildStemCatalogFilterDefinitions(
  sections: UcatSection[],
  categoryRows: CategoryRowForSectionFilter[],
  tagRows: TagRowForSectionFilter[] = [],
  filters: Record<string, unknown[]> = {},
  setOptions: SetFilterOption[] = [],
): DataTableFilterDefinition[] {
  const selectedSectionIds = resolveSectionIdsFromIdFilter(filters)
  const categories = mapCategoriesToOptions(filterCategoriesForSections(categoryRows, selectedSectionIds))
  const tags = mapTagsToOptions(filterTagsForSections(tagRows, selectedSectionIds))

  const defs: DataTableFilterDefinition[] = [
    {
      ...baseStemCatalogFilterDefinitions[0],
      options: sections.map((section) => ({
        label: section.name ?? 'Untitled',
        value: section.id ?? '',
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
    baseStemCatalogFilterDefinitions[5],
  ]

  if (setOptions.length > 0) {
    defs.push({
      key: 'question_set_id',
      label: 'Set',
      options: setOptions,
      searchable: true,
      searchPlaceholder: 'Search sets...',
    })
  }

  return defs
}

function stemMatchesSearch(
  stem: UcatStemCatalogItem,
  search: string,
  searchScopes: StemCatalogSearchScope[] = defaultStemCatalogSearchScopes,
) {
  const query = search.trim().toLowerCase()
  if (!query) return true

  const scopeValues: Record<StemCatalogSearchScope, string> = {
    stem_text: stem.text,
    question_text: stem.questionSearchText,
    answer_option_text: stem.answerOptionSearchText,
  }

  return searchScopes.some((scope) => scopeValues[scope].toLowerCase().includes(query))
}

export function filterStemCatalogItems({
  stems,
  excludedIds = [],
  includedIds,
  search,
  filters,
  searchScopes = defaultStemCatalogSearchScopes,
  publishedSetIds,
  currentSetId = null,
}: {
  stems: UcatStemCatalogItem[]
  excludedIds?: string[]
  includedIds?: Set<string>
  search: string
  filters: Record<string, unknown[]>
  searchScopes?: StemCatalogSearchScope[]
  publishedSetIds?: ReadonlySet<string>
  currentSetId?: string | null
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
  const resolvedPublishedSetIds = publishedSetIds ?? EMPTY_PUBLISHED_SET_IDS

  return stems.filter((stem) => {
    if (excludedIds.includes(stem.id)) return false
    if (includedIds && !includedIds.has(stem.id)) return false
    if (!stemMatchesSearch(stem, search, searchScopes)) return false
    if (!applyMultiSelectFilter(stemsTableState, 'section_id', stem.sectionId)) return false
    if (!applyCategoryFilter(stemsTableState, stem.categoryId, UCAT_FILTER_NO_CATEGORY)) return false
    if (!applyTagFilter(stemsTableState, stem.tagIds)) return false
    if (!applyMultiSelectFilter(stemsTableState, 'status', stem.status)) return false
    if (!applyBooleanTextFilter(stemsTableState, 'visibility', stem.accessScope === 'private')) return false
    if (questionTypeFilter && questionTypeFilter !== 'all') {
      if (!stem.questionTypes.includes(questionTypeFilter as 'multiple_choice' | 'syllogism')) {
        return false
      }
    }

    const selectedSetIds = getFilterValues(stemsTableState, 'question_set_id').map(String)
    const wantsNotInAnySet = selectedSetIds.includes(UCAT_FILTER_NOT_IN_ANY_SET)
    const wantsNotInAnotherPublishedSet = selectedSetIds.includes(UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET)
    const specificSetIds = selectedSetIds.filter(
      (id) => id !== UCAT_FILTER_NOT_IN_ANY_SET && id !== UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET,
    )
    const setHit =
      selectedSetIds.length === 0 ||
      (wantsNotInAnySet && stem.setIds.length === 0) ||
      (wantsNotInAnotherPublishedSet &&
        !stemIsInAnotherPublishedSet(stem.setIds, resolvedPublishedSetIds, currentSetId)) ||
      specificSetIds.some((setId) => stem.setIds.includes(setId))

    return setHit
  })
}

export function sortStemCatalogItems(
  stems: UcatStemCatalogItem[],
  sortBy: string | null,
  sortDirection: 'asc' | 'desc',
  categoryPathLookup: Map<string, string>,
): UcatStemCatalogItem[] {
  return applySort(stems, sortBy, sortDirection, {
    section_name: (stem) => stem.sectionName,
    category_name: (stem) =>
      resolveCategoryPathLabel(categoryPathLookup, stem.categoryId, stem.categoryName),
    stem_text: (stem) => stem.text,
    question_count: (stem) => stem.questionsCount,
    sets: (stem) => stem.setNames,
    type_summary: (stem) => stem.typeSummary,
    visibility: (stem) => (stem.accessScope === 'private' ? 'Private' : 'Public'),
    created_at: (stem) => stem.createdAt,
  })
}

export function getDefaultStemCatalogVisibleColumns(): string[] {
  return stemCatalogColumnDefinitions.filter((column) => column.visibleByDefault).map((column) => column.key)
}

export function buildStemCatalogSetFilterOptions(
  sets: Array<{ id?: string | null; name?: Json | null }>,
  search: string,
  options?: { includeNotInPublishedSet?: boolean },
): SetFilterOption[] {
  const query = search.trim().toLowerCase()
  const noneOption = { label: 'Not in any set', value: UCAT_FILTER_NOT_IN_ANY_SET }
  const notInPublishedOption = {
    label: 'Not in another published set',
    value: UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET,
  }
  const fromSets = sets
    .filter((set) => {
      if (!set.id) return false
      const name = proseMirrorToPlainText(set.name).toLowerCase()
      return !query || name.includes(query)
    })
    .sort((a, b) => proseMirrorToPlainText(a.name).localeCompare(proseMirrorToPlainText(b.name)))
    .map((set) => ({
      label: proseMirrorToPlainText(set.name) || 'Untitled',
      value: set.id as string,
    }))
  const combined = [
    noneOption,
    ...(options?.includeNotInPublishedSet ? [notInPublishedOption] : []),
    ...fromSets,
  ]
  if (!query) return combined
  return combined.filter((option) => option.label.toLowerCase().includes(query))
}
