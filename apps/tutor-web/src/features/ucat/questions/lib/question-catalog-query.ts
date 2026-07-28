import type { DataTableState } from '@altitutor/shared'
import type {
  UcatContentStatus,
} from '@/features/ucat/shared/types'
import type {
  QuestionSearchScope,
} from '@/features/ucat/questions/hooks/useUcatQuestionsTable'
import {
  UCAT_FILTER_NO_CATEGORY,
  UCAT_FILTER_NOT_IN_ANY_SET,
} from '@/features/ucat/shared/lib/table-filter-sentinel'

export const CREATED_AT_FROM_FILTER_KEY = 'created_at_from'
export const CREATED_AT_TO_FILTER_KEY = 'created_at_to'

const CATALOG_SORT_KEYS = new Set([
  'section_name',
  'category_name',
  'question_count',
  'sets',
  'type_summary',
  'visibility',
  'source',
  'created_at',
  'status',
])

export type QuestionCatalogQuery = {
  status: UcatContentStatus
  showDeleted: boolean
  search: string
  searchScopes: QuestionSearchScope[]
  sectionIds: string[]
  categoryIds: string[]
  includeNoCategory: boolean
  tagIds: string[]
  accessScopes: string[]
  questionTypes: string[]
  setIds: string[]
  includeWithoutSet: boolean
  sourceChannels: string[]
  createdByIds: string[]
  createdFrom: string | null
  createdTo: string | null
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
  page: number
  pageSize: number
}

function filterStrings(state: DataTableState, key: string): string[] {
  const values = state.filters[key]
  if (!Array.isArray(values)) return []
  return values
    .map(String)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== 'all')
}

function firstFilterString(state: DataTableState, key: string): string | null {
  return filterStrings(state, key)[0] ?? null
}

export function toUtcIso(value: string | null): string | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export function buildQuestionCatalogQuery(input: {
  tableState: DataTableState
  status: UcatContentStatus
  showDeleted: boolean
  searchScopes: QuestionSearchScope[]
}): QuestionCatalogQuery {
  const { tableState } = input
  const rawCategoryIds = filterStrings(tableState, 'question_stem_category_id')
  const rawSetIds = filterStrings(tableState, 'question_set_id')

  return {
    status: input.status,
    showDeleted: input.showDeleted,
    search: tableState.search.trim(),
    searchScopes: input.searchScopes,
    sectionIds: filterStrings(tableState, 'section_id'),
    categoryIds: rawCategoryIds.filter((id) => id !== UCAT_FILTER_NO_CATEGORY),
    includeNoCategory: rawCategoryIds.includes(UCAT_FILTER_NO_CATEGORY),
    tagIds: filterStrings(tableState, 'question_tag_id'),
    accessScopes: filterStrings(tableState, 'visibility'),
    questionTypes: filterStrings(tableState, 'question_type'),
    setIds: rawSetIds.filter((id) => id !== UCAT_FILTER_NOT_IN_ANY_SET),
    includeWithoutSet: rawSetIds.includes(UCAT_FILTER_NOT_IN_ANY_SET),
    sourceChannels: filterStrings(tableState, 'source_channel'),
    createdByIds: filterStrings(tableState, 'created_by'),
    createdFrom: toUtcIso(firstFilterString(tableState, CREATED_AT_FROM_FILTER_KEY)),
    createdTo: toUtcIso(firstFilterString(tableState, CREATED_AT_TO_FILTER_KEY)),
    sortBy:
      tableState.sortBy && CATALOG_SORT_KEYS.has(tableState.sortBy)
        ? tableState.sortBy
        : null,
    sortDirection: tableState.sortDirection,
    page: Math.max(1, tableState.page),
    pageSize: Math.min(100, Math.max(1, tableState.pageSize)),
  }
}

export function serializeQuestionCatalogQuery(query: QuestionCatalogQuery): string {
  const params = new URLSearchParams()
  params.set('status', query.status)
  if (query.showDeleted) params.set('deleted', '1')
  if (query.search) params.set('search', query.search)
  for (const scope of query.searchScopes) params.append('scope', scope)
  for (const value of query.sectionIds) params.append('section', value)
  for (const value of query.categoryIds) params.append('category', value)
  if (query.includeNoCategory) params.set('noCategory', '1')
  for (const value of query.tagIds) params.append('tag', value)
  for (const value of query.accessScopes) params.append('access', value)
  for (const value of query.questionTypes) params.append('type', value)
  for (const value of query.setIds) params.append('set', value)
  if (query.includeWithoutSet) params.set('withoutSet', '1')
  for (const value of query.sourceChannels) params.append('source', value)
  for (const value of query.createdByIds) params.append('createdBy', value)
  if (query.createdFrom) params.set('createdFrom', query.createdFrom)
  if (query.createdTo) params.set('createdTo', query.createdTo)
  if (query.sortBy) params.set('sort', query.sortBy)
  params.set('direction', query.sortDirection)
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  return params.toString()
}
