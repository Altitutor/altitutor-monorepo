import type { Json } from '@altitutor/shared'
import type { UcatQuestionCatalogRow } from '@/features/ucat/questions/api/questions'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

export type SetDetailMembershipStem = {
  stem_id: string
  stem_text?: unknown
  questions_meta?: Array<{ id: string; index: number }>
}

export type SetMembershipFallbackStem = {
  id: string
  stemText: Json | string
  questionCount: number
  sectionName?: string
  sectionId?: string | null
  categoryId?: string | null
  categoryName?: string | null
  sourceChannel?: UcatQuestionCatalogRow['source_channel']
  tagIds?: string[]
  setIds?: string[]
  setNames?: unknown
  status?: UcatQuestionCatalogRow['status']
  accessScope?: UcatQuestionCatalogRow['access_scope']
  createdAt?: string | null
}

export function setDetailStemToFallback(stem: SetDetailMembershipStem): SetMembershipFallbackStem {
  return {
    id: stem.stem_id,
    stemText: (stem.stem_text ?? '') as Json,
    questionCount: Array.isArray(stem.questions_meta) ? stem.questions_meta.length : 0,
  }
}

export function stemCatalogItemToFallback(stem: UcatStemCatalogItem): SetMembershipFallbackStem {
  return {
    id: stem.id,
    stemText: stem.text,
    questionCount: stem.questionsCount,
    sectionName: stem.sectionName,
    sectionId: stem.sectionId,
    categoryId: stem.categoryId,
    categoryName: stem.categoryName,
    sourceChannel: stem.sourceChannel,
    tagIds: stem.tagIds,
    setIds: stem.setIds,
    setNames: stem.setNames === '—' ? [] : stem.setNames,
    status: stem.status,
    accessScope: stem.accessScope,
    createdAt: stem.createdAt,
  }
}

function fallbackStemText(stemText: Json | string): Json {
  return typeof stemText === 'string' ? plainTextToProseMirror(stemText) : stemText
}

export function fallbackStemToCatalogRow(stem: SetMembershipFallbackStem): UcatQuestionCatalogRow {
  return {
    id: stem.id,
    stem_text: fallbackStemText(stem.stemText),
    question_count: stem.questionCount,
    section_name: stem.sectionName ?? '-',
    section_id: stem.sectionId ?? null,
    question_stem_category_id: stem.categoryId ?? null,
    category_name: stem.categoryName ?? null,
    source_channel: stem.sourceChannel ?? 'individual',
    tag_ids: stem.tagIds ?? [],
    set_ids: stem.setIds ?? [],
    set_names: stem.setNames ?? [],
    status: stem.status ?? 'draft',
    access_scope: stem.accessScope ?? 'public',
    created_at: stem.createdAt ?? null,
    response_types: [],
    answer_schemes: [],
    is_available_in_question_pool: false,
  } as unknown as UcatQuestionCatalogRow
}

/**
 * Membership is driven by the set's stem ids. Catalog rows enrich them; missing
 * catalog hits still render from set-detail / add-stem fallbacks instead of vanishing.
 */
export function buildSetMembershipCatalogRows(input: {
  stemIds: string[]
  catalogRows: UcatQuestionCatalogRow[]
  fallbackStems?: SetMembershipFallbackStem[]
}): UcatQuestionCatalogRow[] {
  const catalogById = new Map(
    input.catalogRows.flatMap((row) => (row.id ? [[row.id, row] as const] : [])),
  )
  const fallbackById = new Map(
    (input.fallbackStems ?? []).map((stem) => [stem.id, stem] as const),
  )

  return input.stemIds.map((stemId) => {
    const catalogRow = catalogById.get(stemId)
    if (catalogRow) return catalogRow
    const fallback = fallbackById.get(stemId)
    if (fallback) return fallbackStemToCatalogRow(fallback)
    return fallbackStemToCatalogRow({ id: stemId, stemText: '', questionCount: 0 })
  })
}
