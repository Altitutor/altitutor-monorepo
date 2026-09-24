import type { UcatContentStatus } from '@/features/ucat/shared/types'
import type { UcatQuestionCatalogRow } from '@/features/ucat/questions/api/questions'
import type { QuestionCatalogQuery } from '@/features/ucat/questions/lib/question-catalog-query'
import type { QuestionSearchScope } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'

/** Catalog HTTP API caps non-ids-only page size at 100. */
export const QUESTION_CATALOG_BY_ID_PAGE_SIZE = 100

export const QUESTION_CATALOG_STATUSES: UcatContentStatus[] = ['draft', 'in_review', 'published']

const DEFAULT_SEARCH_SCOPES: QuestionSearchScope[] = [
  'stem_text',
  'question_text',
  'answer_option_text',
  'tutor_source_note',
]

export function chunkStemIds(stemIds: string[], chunkSize = QUESTION_CATALOG_BY_ID_PAGE_SIZE): string[][] {
  const unique = [...new Set(stemIds.filter(Boolean))]
  if (unique.length === 0) return []
  const chunks: string[][] = []
  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    chunks.push(unique.slice(offset, offset + chunkSize))
  }
  return chunks
}

export function questionCatalogQueryForStemIds(
  stemIds: string[],
  status: UcatContentStatus,
): QuestionCatalogQuery {
  return {
    status,
    showDeleted: false,
    search: '',
    searchScopes: DEFAULT_SEARCH_SCOPES,
    stemIds,
    sectionIds: [],
    categoryIds: [],
    includeNoCategory: false,
    tagIds: [],
    accessScopes: [],
    practicePool: null,
    setIds: [],
    includeWithoutSet: false,
    sourceChannels: [],
    aiReviewStatuses: [],
    auditFilters: [],
    createdByIds: [],
    createdFrom: null,
    createdTo: null,
    questionCountMin: null,
    questionCountMax: null,
    sortBy: null,
    sortDirection: 'asc',
    page: 1,
    pageSize: Math.min(QUESTION_CATALOG_BY_ID_PAGE_SIZE, Math.max(stemIds.length, 1)),
  }
}

export function orderCatalogRowsByStemIds<T extends { id?: string | null }>(
  rows: T[],
  stemIds: string[],
): T[] {
  const byId = new Map<string, T>()
  for (const row of rows) {
    if (!row.id || byId.has(row.id)) continue
    byId.set(row.id, row)
  }
  return stemIds.flatMap((stemId) => {
    const row = byId.get(stemId)
    return row ? [row] : []
  })
}

export function mergeCatalogRowsByStemIds(
  pages: Array<{ items: UcatQuestionCatalogRow[] }>,
  stemIds: string[],
): UcatQuestionCatalogRow[] {
  return orderCatalogRowsByStemIds(
    pages.flatMap((page) => page.items),
    stemIds,
  )
}
