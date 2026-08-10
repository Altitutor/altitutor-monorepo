import { createHash } from 'node:crypto'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type {
  UcatAssessmentFingerprints,
  UcatAssessmentImage,
  UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type JsonRecord = Record<string, unknown>

type AssessmentStemRow = Pick<
  Database['public']['Tables']['question_stems']['Row'],
  | 'id'
  | 'section_id'
  | 'question_stem_category_id'
  | 'status'
  | 'source_channel'
  | 'status_changed_at'
  | 'status_changed_by'
  | 'updated_by'
  | 'updated_at'
  | 'tutor_source_note'
  | 'access_scope'
  | 'stem_text'
>

type AssessmentSectionRow = Pick<
  Database['public']['Tables']['ucat_sections']['Row'],
  'section_number' | 'name' | 'display_columns'
>

type AssessmentCategoryRow = Pick<
  Database['public']['Tables']['question_stem_categories']['Row'],
  'name'
>

type AssessmentQuestionRow = Pick<
  Database['public']['Tables']['ucat_questions']['Row'],
  | 'id'
  | 'question_text'
  | 'answer_explanation'
  | 'index'
  | 'difficulty'
  | 'time_burden_seconds'
  | 'question_type'
  | 'response_type'
  | 'answer_scheme'
  | 'source_channel'
  | 'ai_generation_metadata'
>

type AssessmentOptionRow = Pick<
  Database['public']['Tables']['question_answer_options']['Row'],
  'id' | 'question_id' | 'answer_text' | 'answer_explanation' | 'index' | 'is_answer' | 'answer_key_value'
>

type AssessmentTagLinkRow = Pick<
  Database['public']['Tables']['questions_question_tags']['Row'],
  'question_id' | 'tag_id'
>

type AssessmentTagRow = Pick<
  Database['public']['Tables']['question_tags']['Row'],
  'id' | 'name'
>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function numeric(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizedText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isRecord(value)) return typeof value === 'string' ? value.normalize('NFC') : value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  )
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')
}

function stableImageSource(attrs: JsonRecord): string | null {
  const fileId = typeof attrs.fileId === 'string' ? attrs.fileId : null
  if (fileId) return `file:${fileId}`
  const storagePath = typeof attrs.storagePath === 'string' ? attrs.storagePath : null
  if (storagePath) return `path:${storagePath}`
  const src = typeof attrs.src === 'string' ? attrs.src : null
  if (!src) return null
  if (src.startsWith('data:')) return `data:${hash(src)}`
  try {
    const url = new URL(src)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return src.split('?')[0] ?? src
  }
}

function imageAuthoringMetadata(attrs: JsonRecord): Record<string, unknown> | null {
  const metadata = Object.fromEntries(
    Object.entries(attrs).filter(([key, value]) => {
      if (value === undefined) return false
      // Keep semantic/model-authored metadata while excluding volatile URLs,
      // storage locators, and any embedded/raw SVG or XML payloads.
      return !/(^src$|url$|fileid$|storagepath$|svg|xml)/iu.test(key)
    }),
  )
  return Object.keys(metadata).length > 0
    ? stableValue(metadata) as Record<string, unknown>
    : null
}

function canonicalRichNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalRichNode).filter((item) => item != null)
  if (!isRecord(value)) return value
  if (value.type === 'text') {
    const text = normalizedText(value.text)
    return text ? { type: 'text', text } : null
  }
  if (value.type === 'image') {
    const attrs = isRecord(value.attrs) ? value.attrs : {}
    return {
      type: 'image',
      source: stableImageSource(attrs),
      alt: normalizedText(attrs.alt),
      visualType: typeof attrs.visualType === 'string' ? attrs.visualType : null,
      visualSpec: stableValue(isRecord(attrs.visualSpec) ? attrs.visualSpec : null),
      visualTitle: normalizedText(attrs.visualTitle),
      visualAltText: normalizedText(attrs.visualAltText),
      width: numeric(attrs.modelWidth ?? attrs.originalModelWidth ?? attrs.modelSpecifiedWidth ?? attrs.visualWidth ?? attrs.width),
      height: numeric(attrs.modelHeight ?? attrs.originalModelHeight ?? attrs.modelSpecifiedHeight ?? attrs.visualHeight ?? attrs.height),
      authoringMetadata: imageAuthoringMetadata(attrs),
    }
  }
  const content = Array.isArray(value.content)
    ? value.content.map(canonicalRichNode).filter((item) => item != null)
    : undefined
  const attrs = isRecord(value.attrs)
    ? Object.fromEntries(
        Object.entries(value.attrs)
          .filter(([key]) => ['colspan', 'rowspan', 'colwidth'].includes(key))
          .map(([key, item]) => [key, stableValue(item)]),
      )
    : undefined
  return {
    type: typeof value.type === 'string' ? value.type : 'node',
    ...(content && content.length > 0 ? { content } : {}),
    ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
  }
}

function richTextPlain(value: Json | null | undefined): string {
  return proseMirrorToPlainText(value ?? null).normalize('NFC').trim()
}

export function collectAssessmentImages(value: Json | null | undefined, location: string): UcatAssessmentImage[] {
  if (!isRecord(value)) return []
  const images: UcatAssessmentImage[] = []
  function walk(node: JsonRecord) {
    if (node.type === 'image') {
      const attrs = isRecord(node.attrs) ? node.attrs : {}
      const spec = isRecord(attrs.visualSpec) ? structuredClone(attrs.visualSpec) : null
      images.push({
        location,
        index: images.length,
        src: typeof attrs.src === 'string' ? attrs.src : null,
        fileId: typeof attrs.fileId === 'string' ? attrs.fileId : null,
        storagePath: typeof attrs.storagePath === 'string' ? attrs.storagePath : null,
        alt: typeof attrs.alt === 'string' ? attrs.alt : null,
        visualType: typeof attrs.visualType === 'string' ? attrs.visualType : null,
        visualSpec: spec,
        visualTitle: typeof attrs.visualTitle === 'string' ? attrs.visualTitle : null,
        visualAltText: typeof attrs.visualAltText === 'string' ? attrs.visualAltText : null,
        modelWidth: numeric(attrs.modelWidth ?? attrs.originalModelWidth ?? attrs.modelSpecifiedWidth ?? attrs.visualWidth ?? attrs.width ?? spec?.width),
        modelHeight: numeric(attrs.modelHeight ?? attrs.originalModelHeight ?? attrs.modelSpecifiedHeight ?? attrs.visualHeight ?? attrs.height ?? spec?.height),
        authoringMetadata: imageAuthoringMetadata(attrs),
      })
    }
    if (!Array.isArray(node.content)) return
    for (const child of node.content) {
      if (isRecord(child)) walk(child)
    }
  }
  walk(value)
  return images
}

function compactRichTextForAudit(value: Json | null): Json | null {
  if (value == null) return null
  const clone = JSON.parse(JSON.stringify(value)) as unknown
  function sanitize(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(sanitize)
      return
    }
    if (!isRecord(node)) return
    if (node.type === 'image' && isRecord(node.attrs)) {
      for (const key of Object.keys(node.attrs)) {
        if (/(^src$|url$|fileid$|storagepath$|svg|xml)/iu.test(key)) delete node.attrs[key]
      }
    }
    Object.values(node).forEach(sanitize)
  }
  sanitize(clone)
  return clone as Json
}

async function loadAssessmentDetailRow(
  client: SupabaseClient<Database>,
  stemId: string,
): Promise<JsonRecord | null> {
  // Do not use vtutor_ucat_question_stem_detail here. That view explicitly
  // filters with is_ucat_tutor(), so a service-role/background client has no
  // tutor identity and receives an empty result even when the stem exists.
  const source = client as SupabaseAny
  const { data: stemData, error: stemError } = await source
    .from('question_stems')
    .select('id,section_id,question_stem_category_id,status,source_channel,status_changed_at,status_changed_by,updated_by,updated_at,tutor_source_note,access_scope,stem_text')
    .eq('id', stemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (stemError) throw stemError
  if (!stemData) return null
  const stem = stemData as AssessmentStemRow

  const categoryPromise = stem.question_stem_category_id
    ? source
        .from('question_stem_categories')
        .select('name')
        .eq('id', stem.question_stem_category_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const [sectionResult, categoryResult, questionResult] = await Promise.all([
    source
      .from('ucat_sections')
      .select('section_number,name,display_columns')
      .eq('id', stem.section_id)
      .single(),
    categoryPromise,
    source
      .from('ucat_questions')
      .select('id,question_text,answer_explanation,index,difficulty,time_burden_seconds,question_type,response_type,answer_scheme,source_channel,ai_generation_metadata')
      .eq('question_stem_id', stem.id)
      .is('deleted_at', null),
  ])
  if (sectionResult.error) throw sectionResult.error
  if (categoryResult.error) throw categoryResult.error
  if (questionResult.error) throw questionResult.error

  const section = sectionResult.data as AssessmentSectionRow
  const category = categoryResult.data as AssessmentCategoryRow | null
  const questionRows = (questionResult.data ?? []) as AssessmentQuestionRow[]
  const questionIds = questionRows.map((question) => question.id)
  let optionRows: AssessmentOptionRow[] = []
  let tagLinkRows: AssessmentTagLinkRow[] = []

  if (questionIds.length > 0) {
    const [optionResult, tagLinkResult] = await Promise.all([
      source
        .from('question_answer_options')
        .select('id,question_id,answer_text,answer_explanation,index,is_answer,answer_key_value')
        .in('question_id', questionIds)
        .is('deleted_at', null),
      source
        .from('questions_question_tags')
        .select('question_id,tag_id')
        .in('question_id', questionIds),
    ])
    if (optionResult.error) throw optionResult.error
    if (tagLinkResult.error) throw tagLinkResult.error
    optionRows = (optionResult.data ?? []) as AssessmentOptionRow[]
    tagLinkRows = (tagLinkResult.data ?? []) as AssessmentTagLinkRow[]
  }

  const tagIds = [...new Set(tagLinkRows.map((link) => link.tag_id))]
  let tagRows: AssessmentTagRow[] = []
  if (tagIds.length > 0) {
    const { data, error } = await source
      .from('question_tags')
      .select('id,name')
      .in('id', tagIds)
    if (error) throw error
    tagRows = (data ?? []) as AssessmentTagRow[]
  }
  const tagsById = new Map(tagRows.map((tag) => [tag.id, tag]))

  return {
    ...stem,
    section_number: section.section_number,
    section_name: section.name,
    display_columns: section.display_columns,
    category_name: category?.name ?? null,
    questions: questionRows.map((question) => ({
      ...question,
      tags: tagLinkRows
        .filter((link) => link.question_id === question.id)
        .flatMap((link) => {
          const tag = tagsById.get(link.tag_id)
          return tag ? [{ id: tag.id, name: tag.name }] : []
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      answer_options: optionRows.filter((option) => option.question_id === question.id),
    })),
  }
}

/** Compact immutable audit snapshot; deliberately excludes image bytes/URLs. */
export function compactUcatAssessmentSnapshot(snapshot: UcatAssessmentSnapshot): UcatAssessmentSnapshot {
  const compactImages = (images: UcatAssessmentImage[]) => images.map((image) => ({ ...image, src: null }))
  return {
    ...snapshot,
    stemText: compactRichTextForAudit(snapshot.stemText) ?? {},
    images: compactImages(snapshot.images),
    questions: snapshot.questions.map((question) => ({
      ...question,
      questionText: compactRichTextForAudit(question.questionText) ?? {},
      answerExplanation: compactRichTextForAudit(question.answerExplanation),
      images: compactImages(question.images),
      options: question.options.map((option) => ({
        ...option,
        answerText: compactRichTextForAudit(option.answerText) ?? {},
        answerExplanation: compactRichTextForAudit(option.answerExplanation),
        images: compactImages(option.images),
      })),
    })),
  }
}

export function ucatAssessmentSnapshotFromDetailRow(
  value: unknown,
  stemIdOverride?: string,
): UcatAssessmentSnapshot | null {
  if (!isRecord(value)) return null
  const row = value
  const stemId = stemIdOverride ?? (typeof row.id === 'string' ? row.id : null)
  if (!stemId) return null
  const rawQuestions = Array.isArray(row.questions) ? row.questions.filter(isRecord) : []
  const questions = rawQuestions
    .filter((question) => !question.deleted_at)
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    .flatMap((question) => {
      const id = typeof question.id === 'string' ? question.id : null
      if (!id) return []
      const questionText = (question.question_text ?? {}) as Json
      const answerExplanation = (question.answer_explanation ?? null) as Json | null
      const rawOptions = Array.isArray(question.answer_options) ? question.answer_options.filter(isRecord) : []
      const options = rawOptions
        .filter((option) => !option.deleted_at)
        .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
        .flatMap((option) => {
          const optionId = typeof option.id === 'string' ? option.id : null
          if (!optionId) return []
          const answerText = (option.answer_text ?? {}) as Json
          const optionExplanation = (option.answer_explanation ?? null) as Json | null
          return [{
            id: optionId,
            index: Number(option.index ?? 0),
            answerText,
            answerTextPlain: richTextPlain(answerText),
            answerExplanation: optionExplanation,
            answerExplanationPlain: richTextPlain(optionExplanation),
            isAnswer: option.is_answer === true,
            answerKeyValue:
              option.answer_key_value === 'correct'
                ? 'correct' as const
                : option.answer_key_value === 'yes'
                  ? 'yes' as const
                  : option.answer_key_value === 'no'
                    ? 'no' as const
                    : option.answer_key_value === 'most'
                      ? 'most' as const
                      : option.answer_key_value === 'least'
                        ? 'least' as const
                        : null,
            images: [
              ...collectAssessmentImages(answerText, `option:${optionId}:answer_text`),
              ...collectAssessmentImages(optionExplanation, `option:${optionId}:answer_explanation`),
            ],
          }]
        })
      const tags = Array.isArray(question.tags) ? question.tags.filter(isRecord) : []
      return [{
        id,
        index: Number(question.index ?? 0),
        questionText,
        questionTextPlain: richTextPlain(questionText),
        answerExplanation,
        answerExplanationPlain: richTextPlain(answerExplanation),
        questionType: question.question_type === 'syllogism' ? 'syllogism' as const : 'multiple_choice' as const,
        responseType: question.response_type === 'drag_and_drop' ? 'drag_and_drop' as const : 'multiple_choice' as const,
        answerScheme:
          question.answer_scheme === 'situational_judgement_rating'
            ? 'situational_judgement_rating' as const
            : question.answer_scheme === 'decision_making_binary_placement'
              ? 'decision_making_binary_placement' as const
              : question.answer_scheme === 'situational_judgement_most_least'
                ? 'situational_judgement_most_least' as const
                : 'single_choice' as const,
        sourceChannel:
          question.source_channel === 'ai_generation'
            ? 'ai_generation' as const
            : question.source_channel === 'bulk_import'
              ? 'bulk_import' as const
              : question.source_channel === 'individual'
                ? 'individual' as const
                : null,
        aiGenerationMetadata: (question.ai_generation_metadata ?? null) as Json | null,
        difficulty: Number.isFinite(Number(question.difficulty)) ? Number(question.difficulty) : null,
        timeBurdenSeconds: Number.isFinite(Number(question.time_burden_seconds))
          ? Number(question.time_burden_seconds)
          : null,
        tagIds: tags.flatMap((tag) => typeof tag.id === 'string' ? [tag.id] : []),
        tagNames: tags.flatMap((tag) => typeof tag.name === 'string' ? [tag.name] : []),
        images: [
          ...collectAssessmentImages(questionText, `question:${id}:question_text`),
          ...collectAssessmentImages(answerExplanation, `question:${id}:answer_explanation`),
        ],
        options,
      }]
    })

  const stemText = (row.stem_text ?? {}) as Json
  return {
    stemId,
    status: row.status === 'published' ? 'published' : row.status === 'in_review' ? 'in_review' : 'draft',
    sourceChannel:
      row.source_channel === 'ai_generation'
        ? 'ai_generation'
        : row.source_channel === 'bulk_import'
          ? 'bulk_import'
          : row.source_channel === 'individual'
            ? 'individual'
            : null,
    statusChangedAt: typeof row.status_changed_at === 'string' ? row.status_changed_at : null,
    statusChangedBy: typeof row.status_changed_by === 'string' ? row.status_changed_by : null,
    updatedBy: typeof row.updated_by === 'string' ? row.updated_by : null,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    tutorSourceNote: typeof row.tutor_source_note === 'string' ? row.tutor_source_note : null,
    sectionId: String(row.section_id ?? ''),
    sectionName: String(row.section_name ?? ''),
    sectionNumber: Number(row.section_number ?? 0),
    displayColumns: Number(row.display_columns ?? 1),
    categoryId: typeof row.question_stem_category_id === 'string' ? row.question_stem_category_id : null,
    categoryName: typeof row.category_name === 'string' ? row.category_name : null,
    accessScope: row.access_scope === 'private' ? 'private' : 'public',
    stemText,
    stemTextPlain: richTextPlain(stemText),
    images: collectAssessmentImages(stemText, 'stem:stem_text'),
    questions,
  }
}

export async function loadUcatAssessmentSnapshot(
  client: SupabaseClient<Database>,
  stemId: string,
): Promise<UcatAssessmentSnapshot | null> {
  const row = await loadAssessmentDetailRow(client, stemId)
  return ucatAssessmentSnapshotFromDetailRow(row, stemId)
}

export function fingerprintUcatAssessmentSnapshot(snapshot: UcatAssessmentSnapshot): UcatAssessmentFingerprints {
  const shared = hash({
    sectionId: snapshot.sectionId,
    sectionName: normalizedText(snapshot.sectionName),
    categoryId: snapshot.categoryId,
    categoryName: normalizedText(snapshot.categoryName),
    displayColumns: snapshot.displayColumns,
    accessScope: snapshot.accessScope,
    stemText: canonicalRichNode(snapshot.stemText),
    questionMembership: snapshot.questions.map((question) => question.id),
  })
  const questions = Object.fromEntries(snapshot.questions.map((question) => [
    question.id,
    hash({
      index: question.index,
      questionText: canonicalRichNode(question.questionText),
      answerExplanation: canonicalRichNode(question.answerExplanation),
      questionType: question.questionType,
      difficulty: question.difficulty,
      timeBurdenSeconds: question.timeBurdenSeconds,
      tagIds: [...question.tagIds].sort(),
      options: question.options.map((option) => ({
        index: option.index,
        answerText: canonicalRichNode(option.answerText),
        answerExplanation: canonicalRichNode(option.answerExplanation),
        isAnswer: option.isAnswer,
      })),
    }),
  ]))
  return {
    shared,
    questions,
    content: hash({ shared, questions }),
  }
}

export function changedAssessmentScope(
  previous: UcatAssessmentFingerprints | null,
  current: UcatAssessmentFingerprints,
): { scopeType: 'full' | 'questions'; questionIds: string[] } | null {
  if (!previous || previous.shared !== current.shared) return { scopeType: 'full', questionIds: [] }
  const previousIds = Object.keys(previous.questions).sort()
  const currentIds = Object.keys(current.questions).sort()
  if (previousIds.join('|') !== currentIds.join('|')) return { scopeType: 'full', questionIds: [] }
  const questionIds = currentIds.filter((id) => previous.questions[id] !== current.questions[id])
  return questionIds.length > 0 ? { scopeType: 'questions', questionIds } : null
}

export function assessmentFingerprintsFromRun(value: unknown): UcatAssessmentFingerprints | null {
  if (!isRecord(value)) return null
  const content = typeof value.content === 'string' ? value.content : null
  const shared = typeof value.shared === 'string' ? value.shared : null
  const questions = isRecord(value.questions)
    ? Object.fromEntries(Object.entries(value.questions).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : null
  return content && shared && questions ? { content, shared, questions } : null
}
