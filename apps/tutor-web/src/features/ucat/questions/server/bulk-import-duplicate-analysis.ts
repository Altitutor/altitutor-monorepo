import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

const DETAIL_ID_CHUNK_SIZE = 100

type DetailRow = Database['public']['Views']['vtutor_ucat_question_stem_detail']['Row']

export type BulkImportDuplicateDraftQuestion = {
  id?: string
  questionText: unknown
  responseType: 'multiple_choice' | 'drag_and_drop'
  answerScheme: 'single_choice' | 'situational_judgement_rating' | 'decision_making_binary_placement' | 'situational_judgement_most_least'
  answerExplanation?: unknown
  options: Array<{
    id?: string
    answerText: unknown
    answerExplanation?: unknown
    answerKeyValue: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
  }>
}

export type BulkImportDuplicateDraft = {
  id: string
  sectionId: string
  stemText: unknown
  questions: BulkImportDuplicateDraftQuestion[]
}

type CatalogQuestion = {
  id: string
  index: number
  question_text: unknown
  response_type: 'multiple_choice' | 'drag_and_drop'
  answer_scheme: 'single_choice' | 'situational_judgement_rating' | 'decision_making_binary_placement' | 'situational_judgement_most_least'
  answer_explanation?: unknown
  answer_options: Array<{
    id: string
    index: number
    answer_text: unknown
    answer_explanation?: unknown
    answer_key_value: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
  }>
}

export type BulkImportDuplicateCatalogStem = {
  id: string
  sectionId: string
  status: 'draft' | 'in_review' | 'published'
  stemText: unknown
  questions: CatalogQuestion[]
}

export type BulkImportDuplicateQuestionRef = {
  id: string | null
  questionIndex: number
  questionText: unknown
  answerExplanation?: unknown
  options: Array<{
    answerText: unknown
    answerExplanation?: unknown
    answerKeyValue: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
  }>
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
  draft: Extract<BulkImportDuplicateFindingSide, { source: 'draft' }>
  match: BulkImportDuplicateFindingSide
  similarity: number
}

export type BulkImportDuplicateMatch = {
  draftId: string
  matchSource: 'catalog' | 'draft'
  matchStemId: string
  similarity: number
}

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isCatalogStatus(value: unknown): value is BulkImportDuplicateCatalogStem['status'] {
  return value === 'draft' || value === 'in_review' || value === 'published'
}

function catalogAnswerKeyValue(
  value: unknown,
): CatalogQuestion['answer_options'][number]['answer_key_value'] {
  return value === 'correct' ||
    value === 'yes' ||
    value === 'no' ||
    value === 'most' ||
    value === 'least'
    ? value
    : null
}

function catalogQuestions(value: Json | null): CatalogQuestion[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const question = record(item)
    if (
      !question ||
      typeof question.id !== 'string' ||
      typeof question.index !== 'number' ||
      (question.response_type !== 'multiple_choice' && question.response_type !== 'drag_and_drop') ||
      ![
        'single_choice',
        'situational_judgement_rating',
        'decision_making_binary_placement',
        'situational_judgement_most_least',
      ].includes(String(question.answer_scheme))
    ) {
      return []
    }
    const options = Array.isArray(question.answer_options)
      ? question.answer_options.flatMap((optionValue) => {
          const option = record(optionValue)
          if (!option || typeof option.id !== 'string' || typeof option.index !== 'number') {
            return []
          }
          return [{
            id: option.id,
            index: option.index,
            answer_text: option.answer_text,
            answer_explanation: option.answer_explanation,
            answer_key_value: catalogAnswerKeyValue(option.answer_key_value),
          }]
        })
      : []
    return [{
      id: question.id,
      index: question.index,
      question_text: question.question_text,
      response_type: question.response_type,
      answer_scheme: question.answer_scheme as CatalogQuestion['answer_scheme'],
      answer_explanation: question.answer_explanation,
      answer_options: options,
    }]
  })
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
      questionText: question.questionText,
      answerExplanation: question.answerExplanation,
      options: question.options.map((option) => ({
        answerText: option.answerText,
        answerExplanation: option.answerExplanation,
        answerKeyValue: option.answerKeyValue,
      })),
    })),
  }
}

function catalogSide(stem: BulkImportDuplicateCatalogStem): Extract<
  BulkImportDuplicateFindingSide,
  { source: 'catalog' }
> {
  return {
    source: 'catalog',
    stemId: stem.id,
    sectionId: stem.sectionId,
    status: stem.status,
    stemText: stem.stemText,
    questions: [...stem.questions]
      .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id))
      .map((question) => ({
        id: question.id,
        questionIndex: question.index,
        questionText: question.question_text,
        answerExplanation: question.answer_explanation,
        options: [...question.answer_options]
          .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id))
          .map((option) => ({
            answerText: option.answer_text,
            answerExplanation: option.answer_explanation,
            answerKeyValue: option.answer_key_value,
          })),
      })),
  }
}

function parseMatches(payload: Json): BulkImportDuplicateMatch[] {
  const root = record(payload)
  if (!root || !Array.isArray(root.items)) {
    throw new Error('Duplicate matching returned an invalid response.')
  }
  return root.items.map((item) => {
    const match = record(item)
    if (
      !match ||
      typeof match.draftId !== 'string' ||
      (match.matchSource !== 'catalog' && match.matchSource !== 'draft') ||
      typeof match.matchStemId !== 'string' ||
      typeof match.similarity !== 'number'
    ) {
      throw new Error('Duplicate matching returned an invalid item.')
    }
    return {
      draftId: match.draftId,
      matchSource: match.matchSource,
      matchStemId: match.matchStemId,
      similarity: match.similarity,
    }
  })
}

async function hydrateCatalogMatches(
  client: SupabaseClient<Database>,
  stemIds: string[],
): Promise<BulkImportDuplicateCatalogStem[]> {
  const result: BulkImportDuplicateCatalogStem[] = []
  for (let offset = 0; offset < stemIds.length; offset += DETAIL_ID_CHUNK_SIZE) {
    const ids = stemIds.slice(offset, offset + DETAIL_ID_CHUNK_SIZE)
    const { data, error } = await client
      .from('vtutor_ucat_question_stem_detail')
      .select('id,section_id,status,stem_text,questions')
      .in('id', ids)
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as Array<Pick<
      DetailRow,
      'id' | 'section_id' | 'status' | 'stem_text' | 'questions'
    >>) {
      if (!row.id || !row.section_id || !isCatalogStatus(row.status)) continue
      result.push({
        id: row.id,
        sectionId: row.section_id,
        status: row.status,
        stemText: row.stem_text,
        questions: catalogQuestions(row.questions),
      })
    }
  }
  return result
}

export function buildBulkImportDuplicateFindings(
  drafts: BulkImportDuplicateDraft[],
  catalog: BulkImportDuplicateCatalogStem[],
  matches: BulkImportDuplicateMatch[],
): BulkImportDuplicateFinding[] {
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]))
  const catalogById = new Map(catalog.map((stem) => [stem.id, stem]))
  return matches.flatMap((match) => {
    const draft = draftById.get(match.draftId)
    if (!draft) return []
    const matchSide = match.matchSource === 'draft'
      ? draftById.get(match.matchStemId)
      : catalogById.get(match.matchStemId)
    if (!matchSide) return []
    return [{
      id: `${draft.id}:${match.matchSource}:${match.matchStemId}`,
      draft: draftSide(draft),
      match: match.matchSource === 'draft'
        ? draftSide(matchSide as BulkImportDuplicateDraft)
        : catalogSide(matchSide as BulkImportDuplicateCatalogStem),
      similarity: match.similarity,
    }]
  })
}

export async function analyzeBulkImportDuplicatesFromCatalog(
  client: SupabaseClient<Database>,
  drafts: BulkImportDuplicateDraft[],
  similarityThreshold = 0.95,
): Promise<BulkImportDuplicateFinding[]> {
  const rpcDrafts = drafts.map((draft) => ({
    id: draft.id,
    sectionId: draft.sectionId,
    stemText: draft.stemText as Json,
  }))
  const { data, error } = await client.rpc('tutor_ucat_match_import_stems', {
    p_drafts: rpcDrafts,
    p_similarity_threshold: similarityThreshold,
  })
  if (error) throw new Error(error.message)

  const matches = parseMatches(data)
  const catalogIds = [...new Set(
    matches.flatMap((match) => match.matchSource === 'catalog' ? [match.matchStemId] : []),
  )]
  const catalog = await hydrateCatalogMatches(client, catalogIds)
  return buildBulkImportDuplicateFindings(drafts, catalog, matches)
}
