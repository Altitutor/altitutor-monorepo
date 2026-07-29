import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  compareStemSimilarityText,
  RECONCILIATION_DUPLICATE_THRESHOLDS,
  type StemSimilarityResult,
} from '@/features/ucat/questions/lib/stem-similarity'

const CATALOG_PAGE_SIZE = 1_000
const DETAIL_ID_CHUNK_SIZE = 100

type CatalogRow = Database['public']['Views']['vtutor_ucat_question_catalog']['Row']
type DetailRow = Database['public']['Views']['vtutor_ucat_question_stem_detail']['Row']

export type BulkImportDuplicateDraftQuestion = {
  id?: string
  questionText: unknown
  questionType: 'multiple_choice' | 'syllogism'
  answerExplanation?: unknown
  options: Array<{
    id?: string
    answerText: unknown
    answerExplanation?: unknown
    isAnswer: boolean
  }>
}

export type BulkImportDuplicateDraft = {
  id: string
  sectionId: string
  stemText: unknown
  questions: BulkImportDuplicateDraftQuestion[]
}

export type BulkImportDuplicateCatalogSummary = {
  id: string
  sectionId: string
  status: 'draft' | 'in_review' | 'published'
  stemText: unknown
  stemComparisonText: string
  questionSearchText: string
  answerOptionSearchText: string
}

type CatalogQuestion = {
  id: string
  index: number
  question_text: unknown
  question_type: 'multiple_choice' | 'syllogism'
  answer_explanation?: unknown
  answer_options: Array<{
    id: string
    index: number
    answer_text: unknown
    answer_explanation?: unknown
    is_answer: boolean | null
  }>
}

export type BulkImportDuplicateCatalogStem = BulkImportDuplicateCatalogSummary & {
  questions: CatalogQuestion[]
}

export type BulkImportDuplicateQuestionRef = {
  id: string | null
  questionIndex: number
}

export type BulkImportDuplicateFindingSide =
  | {
      source: 'draft'
      stemId: string
      sectionId: string
      status: null
      stemText: unknown
      questions: BulkImportDuplicateQuestionRef[]
    }
  | {
      source: 'catalog'
      stemId: string
      sectionId: string
      status: 'draft' | 'in_review' | 'published'
      stemText: unknown
      questions: BulkImportDuplicateQuestionRef[]
    }

export type BulkImportDuplicateFinding = {
  id: string
  kind: 'exact_duplicate' | 'shared_stem' | 'possible_near_copy'
  draft: Extract<BulkImportDuplicateFindingSide, { source: 'draft' }>
  match: BulkImportDuplicateFindingSide
  similarity: StemSimilarityResult | null
}

function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[‐‑‒–—―]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
}

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function mediaIdentities(value: unknown): string[] {
  const node = record(value)
  if (!node) {
    return Array.isArray(value) ? value.flatMap(mediaIdentities) : []
  }

  if (node.type === 'image') {
    const attrs = record(node.attrs)
    if (!attrs) return []
    const identity =
      attrs.fileId ??
      attrs.file_id ??
      attrs.storagePath ??
      attrs.storage_path ??
      attrs.src ??
      JSON.stringify(attrs)
    return typeof identity === 'string' && identity.trim()
      ? [normalizeCatalogText(identity)]
      : []
  }

  return Array.isArray(node.content) ? node.content.flatMap(mediaIdentities) : []
}

/**
 * Mirrors canonical_ucat_catalog_rich_text for draft content closely enough to
 * compare unpersisted ProseMirror JSON with the catalog projection. Media identity
 * is retained so two image-only stems are not treated as the same empty stem.
 */
export function canonicalDraftRichText(value: unknown): string {
  const plainText = proseMirrorToPlainText((value ?? null) as Json)
  const media = mediaIdentities(value)
  return `${normalizeCatalogText(plainText)}${media.length > 0 ? `|media:${media.join('|')}` : ''}`
}

function draftCompositeText(stem: BulkImportDuplicateDraft): string {
  return [
    canonicalDraftRichText(stem.stemText),
    ...stem.questions.flatMap((question) => [
      canonicalDraftRichText(question.questionText),
      ...question.options.map((option) => canonicalDraftRichText(option.answerText)),
    ]),
  ]
    .filter(Boolean)
    .join(' ')
}

function catalogCompositeText(stem: BulkImportDuplicateCatalogSummary): string {
  return [
    stem.stemComparisonText,
    stem.questionSearchText,
    stem.answerOptionSearchText,
  ]
    .filter(Boolean)
    .join(' ')
}

function canonicalDraftBundle(stem: BulkImportDuplicateDraft): string {
  return JSON.stringify(
    stem.questions.map((question) => ({
      questionType: question.questionType,
      questionText: canonicalDraftRichText(question.questionText),
      answerExplanation: canonicalDraftRichText(question.answerExplanation),
      options: question.options.map((option) => ({
        answerText: canonicalDraftRichText(option.answerText),
        answerExplanation: canonicalDraftRichText(option.answerExplanation),
        isAnswer: option.isAnswer,
      })),
    })),
  )
}

function canonicalCatalogBundle(stem: BulkImportDuplicateCatalogStem): string {
  return JSON.stringify(
    [...stem.questions]
      .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id))
      .map((question) => ({
        questionType: question.question_type,
        questionText: canonicalDraftRichText(question.question_text),
        answerExplanation: canonicalDraftRichText(question.answer_explanation),
        options: [...question.answer_options]
          .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id))
          .map((option) => ({
            answerText: canonicalDraftRichText(option.answer_text),
            answerExplanation: canonicalDraftRichText(option.answer_explanation),
            isAnswer: Boolean(option.is_answer),
          })),
      })),
  )
}

function draftSide(stem: BulkImportDuplicateDraft): Extract<
  BulkImportDuplicateFindingSide,
  { source: 'draft' }
> {
  return {
    source: 'draft',
    stemId: stem.id,
    sectionId: stem.sectionId,
    status: null,
    stemText: stem.stemText,
    questions: stem.questions.map((question, questionIndex) => ({
      id: question.id ?? null,
      questionIndex,
    })),
  }
}

function catalogSide(
  stem: BulkImportDuplicateCatalogStem,
): Extract<BulkImportDuplicateFindingSide, { source: 'catalog' }> {
  return {
    source: 'catalog',
    stemId: stem.id,
    sectionId: stem.sectionId,
    status: stem.status,
    stemText: stem.stemText,
    questions: [...stem.questions]
      .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id))
      .map((question) => ({ id: question.id, questionIndex: question.index })),
  }
}

function compareDraftAndCatalog(
  draft: BulkImportDuplicateDraft,
  existing: BulkImportDuplicateCatalogStem,
): BulkImportDuplicateFinding | null {
  if (draft.sectionId !== existing.sectionId) return null

  const sameStem =
    canonicalDraftRichText(draft.stemText) === existing.stemComparisonText &&
    existing.stemComparisonText !== ''

  if (sameStem) {
    const kind =
      canonicalDraftBundle(draft) === canonicalCatalogBundle(existing)
        ? 'exact_duplicate'
        : 'shared_stem'
    return {
      id: `${draft.id}:catalog:${existing.id}`,
      kind,
      draft: draftSide(draft),
      match: catalogSide(existing),
      similarity: null,
    }
  }

  const similarity = compareStemSimilarityText(
    draftCompositeText(draft),
    catalogCompositeText(existing),
    RECONCILIATION_DUPLICATE_THRESHOLDS,
  )
  if (!similarity.isNearCopy) return null

  return {
    id: `${draft.id}:catalog:${existing.id}`,
    kind: 'possible_near_copy',
    draft: draftSide(draft),
    match: catalogSide(existing),
    similarity,
  }
}

function compareDraftPair(
  left: BulkImportDuplicateDraft,
  right: BulkImportDuplicateDraft,
): BulkImportDuplicateFinding | null {
  if (left.sectionId !== right.sectionId) return null

  const sameStem =
    canonicalDraftRichText(left.stemText) === canonicalDraftRichText(right.stemText) &&
    canonicalDraftRichText(left.stemText) !== ''

  if (sameStem) {
    const kind =
      canonicalDraftBundle(left) === canonicalDraftBundle(right)
        ? 'exact_duplicate'
        : 'shared_stem'
    return {
      id: `${left.id}:draft:${right.id}`,
      kind,
      draft: draftSide(left),
      match: draftSide(right),
      similarity: null,
    }
  }

  const similarity = compareStemSimilarityText(
    draftCompositeText(left),
    draftCompositeText(right),
    RECONCILIATION_DUPLICATE_THRESHOLDS,
  )
  if (!similarity.isNearCopy) return null

  return {
    id: `${left.id}:draft:${right.id}`,
    kind: 'possible_near_copy',
    draft: draftSide(left),
    match: draftSide(right),
    similarity,
  }
}

/**
 * Returns the catalog IDs that need hydration. This keeps the catalog scan small
 * and avoids downloading every question bundle before a match is known.
 */
export function findCatalogDuplicateCandidateIds(
  drafts: BulkImportDuplicateDraft[],
  catalog: BulkImportDuplicateCatalogSummary[],
): string[] {
  const ids = new Set<string>()
  for (const draft of drafts) {
    const draftStem = canonicalDraftRichText(draft.stemText)
    const draftComposite = draftCompositeText(draft)
    for (const existing of catalog) {
      if (draft.sectionId !== existing.sectionId) continue
      if (draftStem !== '' && draftStem === existing.stemComparisonText) {
        ids.add(existing.id)
        continue
      }
      const similarity = compareStemSimilarityText(
        draftComposite,
        catalogCompositeText(existing),
        RECONCILIATION_DUPLICATE_THRESHOLDS,
      )
      if (similarity.isNearCopy) ids.add(existing.id)
    }
  }
  return [...ids]
}

export function analyzeBulkImportDuplicates(
  drafts: BulkImportDuplicateDraft[],
  catalog: BulkImportDuplicateCatalogStem[],
): BulkImportDuplicateFinding[] {
  const findings: BulkImportDuplicateFinding[] = []

  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    const left = drafts[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const finding = compareDraftPair(left, drafts[rightIndex])
      if (finding) findings.push(finding)
    }
    for (const existing of catalog) {
      const finding = compareDraftAndCatalog(left, existing)
      if (finding) findings.push(finding)
    }
  }

  const priority = {
    exact_duplicate: 0,
    shared_stem: 1,
    possible_near_copy: 2,
  } as const
  return findings.sort(
    (left, right) => priority[left.kind] - priority[right.kind] || left.id.localeCompare(right.id),
  )
}

function isCatalogStatus(
  value: unknown,
): value is BulkImportDuplicateCatalogSummary['status'] {
  return value === 'draft' || value === 'in_review' || value === 'published'
}

function catalogSummary(row: CatalogRow): BulkImportDuplicateCatalogSummary | null {
  if (
    !row.id ||
    !row.section_id ||
    !isCatalogStatus(row.status) ||
    row.deleted_at != null
  ) {
    return null
  }
  return {
    id: row.id,
    sectionId: row.section_id,
    status: row.status,
    stemText: row.stem_text,
    stemComparisonText: row.stem_comparison_text ?? '',
    questionSearchText: row.question_search_text ?? '',
    answerOptionSearchText: row.answer_option_search_text ?? '',
  }
}

function catalogQuestions(value: Json | null): CatalogQuestion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const question = record(item)
    if (
      !question ||
      typeof question.id !== 'string' ||
      typeof question.index !== 'number' ||
      (question.question_type !== 'multiple_choice' && question.question_type !== 'syllogism')
    ) {
      return []
    }
    const options = Array.isArray(question.answer_options)
      ? question.answer_options.flatMap((itemOption) => {
          const option = record(itemOption)
          if (
            !option ||
            typeof option.id !== 'string' ||
            typeof option.index !== 'number'
          ) {
            return []
          }
          return [
            {
              id: option.id,
              index: option.index,
              answer_text: option.answer_text,
              answer_explanation: option.answer_explanation,
              is_answer:
                typeof option.is_answer === 'boolean' ? option.is_answer : null,
            },
          ]
        })
      : []
    return [
      {
        id: question.id,
        index: question.index,
        question_text: question.question_text,
        question_type: question.question_type,
        answer_explanation: question.answer_explanation,
        answer_options: options,
      },
    ]
  })
}

async function listCatalogSummaries(
  client: SupabaseClient<Database>,
  sectionIds: string[],
): Promise<BulkImportDuplicateCatalogSummary[]> {
  const summaries: BulkImportDuplicateCatalogSummary[] = []
  for (let from = 0; ; from += CATALOG_PAGE_SIZE) {
    const { data, error } = await client
      .from('vtutor_ucat_question_catalog')
      .select(
        'id,section_id,status,deleted_at,stem_text,stem_comparison_text,question_search_text,answer_option_search_text',
      )
      .in('section_id', sectionIds)
      .in('status', ['draft', 'in_review', 'published'])
      .is('deleted_at', null)
      .range(from, from + CATALOG_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []).flatMap((row) => {
      const summary = catalogSummary(row as CatalogRow)
      return summary ? [summary] : []
    })
    summaries.push(...page)
    if ((data?.length ?? 0) < CATALOG_PAGE_SIZE) break
  }
  return summaries
}

async function hydrateCatalogCandidates(
  client: SupabaseClient<Database>,
  summaries: BulkImportDuplicateCatalogSummary[],
  candidateIds: string[],
): Promise<BulkImportDuplicateCatalogStem[]> {
  if (candidateIds.length === 0) return []
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]))
  const result: BulkImportDuplicateCatalogStem[] = []

  for (let offset = 0; offset < candidateIds.length; offset += DETAIL_ID_CHUNK_SIZE) {
    const ids = candidateIds.slice(offset, offset + DETAIL_ID_CHUNK_SIZE)
    const { data, error } = await client
      .from('vtutor_ucat_question_stem_detail')
      .select('id,questions')
      .in('id', ids)
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as Array<Pick<DetailRow, 'id' | 'questions'>>) {
      if (!row.id) continue
      const summary = summaryById.get(row.id)
      if (!summary) continue
      result.push({ ...summary, questions: catalogQuestions(row.questions) })
    }
  }
  return result
}

export async function analyzeBulkImportDuplicatesFromCatalog(
  client: SupabaseClient<Database>,
  drafts: BulkImportDuplicateDraft[],
): Promise<BulkImportDuplicateFinding[]> {
  const sectionIds = [...new Set(drafts.map((draft) => draft.sectionId))]
  const summaries = await listCatalogSummaries(client, sectionIds)
  const candidateIds = findCatalogDuplicateCandidateIds(drafts, summaries)
  const candidates = await hydrateCatalogCandidates(client, summaries, candidateIds)
  return analyzeBulkImportDuplicates(drafts, candidates)
}
