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

export async function loadUcatAssessmentSnapshot(
  client: SupabaseClient<Database>,
  stemId: string,
): Promise<UcatAssessmentSnapshot | null> {
  const { data, error } = await (client as SupabaseAny)
    .from('vtutor_ucat_question_stem_detail')
    .select('*')
    .eq('id', stemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as JsonRecord
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
