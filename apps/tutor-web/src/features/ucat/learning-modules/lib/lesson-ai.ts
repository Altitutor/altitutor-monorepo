import { z } from 'zod'
import type { Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import {
  proseMirrorToPlainText,
  type JsonLike,
} from '@/features/ucat/shared/lib/rich-text'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

const MAX_TEXT_CHARS = 3_000
const MAX_ASSESSMENT_TEXT_CHARS = 2_400

export const LessonAiBlockSchema = z.object({
  clientId: z.string(),
  block_type: z.enum(['text', 'video', 'file', 'question_stem', 'question', 'skill_trainer']),
  content: z.record(z.string(), z.unknown()).default({}),
  question_stem_id: z.string().uuid().nullable().optional(),
  question_id: z.string().uuid().nullable().optional(),
  file_id: z.string().uuid().nullable().optional(),
  skill_trainer_id: z.string().uuid().nullable().optional(),
  skill_trainer_set_id: z.string().uuid().nullable().optional(),
})

export const LessonAiModuleSchema = z.object({
  moduleId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(240).default(''),
  description: z.string().trim().max(2000).default(''),
  sectionId: z.string().uuid().nullable().optional(),
})

export const LessonAiTextBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().trim().min(1).max(2000) }),
  z.object({
    type: z.literal('heading'),
    level: z.number().int().min(2).max(4).default(3),
    text: z.string().trim().min(1).max(160),
  }),
  z.object({
    type: z.literal('bulletList'),
    items: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  }),
  z.object({
    type: z.literal('orderedList'),
    items: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  }),
  z.object({
    type: z.literal('table'),
    rows: z.array(z.array(z.string().trim().max(500)).min(1).max(8)).min(2).max(12),
  }),
])

export const LessonAiRichTextResponseSchema = z.object({
  blocks: z.array(LessonAiTextBlockSchema).min(1).max(24),
  summary: z.string().trim().max(500).nullable().optional(),
})

export type LessonAiBlock = z.infer<typeof LessonAiBlockSchema>
export type LessonAiModule = z.infer<typeof LessonAiModuleSchema>
export type LessonAiRichTextResponse = z.infer<typeof LessonAiRichTextResponseSchema>

type LessonContextBlock = {
  index: number
  role?: 'target' | 'previous' | 'next'
  type: LessonAiBlock['block_type']
  summary: Record<string, unknown>
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
}

function truncateText(text: string, maxChars = MAX_TEXT_CHARS): string {
  const normalized = text.replace(/\s+\n/gu, '\n').replace(/[ \t]{2,}/gu, ' ').trim()
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}...` : normalized
}

function asJson(value: unknown): Json | null {
  return value == null ? null : (value as Json)
}

function richTextPlain(value: unknown, maxChars?: number): string {
  return truncateText(proseMirrorToPlainText(asJson(value)) ?? '', maxChars)
}

function textNode(text: string, marks?: Array<{ type: 'bold' | 'italic' }>): Json {
  return marks?.length ? { type: 'text', text, marks } : { type: 'text', text }
}

function normalizeInlineFormattingTags(text: string): string {
  return text
    .replace(/&lt;(\/?(?:b|strong|i|em))&gt;/giu, '<$1>')
    .replace(/<((?:b|strong|i|em))\s+[^>]*>/giu, '<$1>')
}

function activeMarks(active: Set<'bold' | 'italic'>, extra?: 'bold' | 'italic') {
  const marks = new Set(active)
  if (extra) marks.add(extra)
  return Array.from(marks).map((type) => ({ type }))
}

function appendTextNode(nodes: Json[], text: string, active: Set<'bold' | 'italic'>, extra?: 'bold' | 'italic') {
  if (!text) return
  nodes.push(textNode(text, activeMarks(active, extra)))
}

function inlineTextNodes(text: string): Json[] {
  const nodes: Json[] = []
  const active = new Set<'bold' | 'italic'>()
  const normalized = normalizeInlineFormattingTags(text)
  const pattern = /(\*\*[^*\n]+\*\*|_[^_\n]+_|<\/?(?:b|strong|i|em)>)/giu
  let cursor = 0
  for (const match of normalized.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) appendTextNode(nodes, normalized.slice(cursor, index), active)
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      appendTextNode(nodes, token.slice(2, -2), active, 'bold')
    } else if (token.startsWith('_') && token.endsWith('_')) {
      appendTextNode(nodes, token.slice(1, -1), active, 'italic')
    } else {
      const tag = token.toLowerCase()
      if (tag === '<b>' || tag === '<strong>') active.add('bold')
      if (tag === '</b>' || tag === '</strong>') active.delete('bold')
      if (tag === '<i>' || tag === '<em>') active.add('italic')
      if (tag === '</i>' || tag === '</em>') active.delete('italic')
    }
    cursor = index + token.length
  }
  if (cursor < normalized.length) appendTextNode(nodes, normalized.slice(cursor), active)
  return nodes.filter((node) => {
    const text = (node as Record<string, unknown>).text
    return typeof text !== 'string' || text.length > 0
  })
}

function paragraph(text: string): Json {
  const trimmed = text.trim()
  return { type: 'paragraph', content: trimmed ? inlineTextNodes(trimmed) : [] }
}

function tableCell(text: string, header: boolean): Json {
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [paragraph(text)],
  }
}

export function lessonAiRichTextToProseMirror(response: LessonAiRichTextResponse): Json {
  const content = response.blocks.map((block): Json => {
    if (block.type === 'paragraph') return paragraph(block.text)
    if (block.type === 'heading') {
      return {
        type: 'heading',
        attrs: { level: block.level },
        content: inlineTextNodes(block.text),
      }
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      return {
        type: block.type,
        ...(block.type === 'orderedList' ? { attrs: { start: 1 } } : {}),
        content: block.items.map((item) => ({
          type: 'listItem',
          content: [paragraph(item)],
        })),
      }
    }
    const columnCount = Math.max(...block.rows.map((row) => row.length))
    return {
      type: 'table',
      content: block.rows.map((row, rowIndex) => ({
        type: 'tableRow',
        content: Array.from({ length: columnCount }, (_, columnIndex) =>
          tableCell(row[columnIndex] ?? '', rowIndex === 0)
        ),
      })),
    }
  })
  return { type: 'doc', content }
}

function compactQuestion(question: Record<string, unknown>, questionIndex: number) {
  const options = Array.isArray(question.answer_options)
    ? (question.answer_options as Array<Record<string, unknown>>)
    : []
  return {
    questionIndex,
    questionText: richTextPlain(question.question_text, 700),
    answerExplanation: richTextPlain(question.answer_explanation, 900),
    options: options.slice(0, 6).map((option, optionIndex) => ({
      label: String.fromCharCode(65 + optionIndex),
      answerText: richTextPlain(option.answer_text, 320),
      answerExplanation: richTextPlain(option.answer_explanation, 500),
      answerKeyValue: typeof option.answer_key_value === 'string' ? option.answer_key_value : null,
    })),
  }
}

function compactStemDetail(detail: Record<string, unknown>, questionId?: string | null) {
  const questions = Array.isArray(detail.questions)
    ? (detail.questions as Array<Record<string, unknown>>)
    : []
  const scopedQuestions = questionId
    ? questions.filter((question) => question.id === questionId)
    : questions
  return {
    section: detail.section_name ?? null,
    category: detail.category_name ?? null,
    stemText: richTextPlain(detail.stem_text, MAX_ASSESSMENT_TEXT_CHARS),
    questions: scopedQuestions.slice(0, 6).map(compactQuestion),
  }
}

async function fetchStemDetails(
  client: SupabaseClient<Database>,
  stemIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  if (stemIds.length === 0) return new Map()
  const { data } = await asAny(client)
    .from('vtutor_ucat_question_stem_detail')
    .select('id,section_name,category_name,stem_text,questions')
    .in('id', Array.from(new Set(stemIds)))
  return new Map(
    ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => typeof row.id === 'string')
      .map((row) => [row.id as string, row])
  )
}

async function fetchQuestionStemIds(
  client: SupabaseClient<Database>,
  questionIds: string[]
): Promise<Map<string, string>> {
  if (questionIds.length === 0) return new Map()
  const { data } = await asAny(client)
    .from('ucat_questions')
    .select('id,question_stem_id')
    .in('id', Array.from(new Set(questionIds)))
  return new Map(
    ((data ?? []) as Array<{ id?: string | null; question_stem_id?: string | null }>)
      .filter((row): row is { id: string; question_stem_id: string } => !!row.id && !!row.question_stem_id)
      .map((row) => [row.id, row.question_stem_id])
  )
}

export async function buildLessonAiContext(params: {
  client: SupabaseClient<Database>
  module: LessonAiModule
  blocks: LessonAiBlock[]
  targetIndex?: number | null
  selectedBlockId?: string | null
}) {
  const questionIds = params.blocks
    .map((block) => block.question_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  const questionStemIdsByQuestionId = await fetchQuestionStemIds(params.client, questionIds)
  const stemIds = params.blocks
    .flatMap((block) => [
      block.question_stem_id,
      block.question_id ? questionStemIdsByQuestionId.get(block.question_id) : null,
    ])
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  const stemDetails = await fetchStemDetails(params.client, stemIds)

  const targetIndex = params.targetIndex ?? null
  const contextBlocks: LessonContextBlock[] = params.blocks.map((block, index) => {
    const role =
      params.selectedBlockId && block.clientId === params.selectedBlockId
        ? 'target'
        : targetIndex != null && index === targetIndex - 1
          ? 'previous'
          : targetIndex != null && index === targetIndex
            ? 'next'
            : undefined

    if (block.block_type === 'text') {
      return {
        index,
        role,
        type: block.block_type,
        summary: { text: richTextPlain(block.content.body, MAX_TEXT_CHARS) },
      }
    }
    if (block.block_type === 'question_stem' && block.question_stem_id) {
      const detail = stemDetails.get(block.question_stem_id)
      return {
        index,
        role,
        type: block.block_type,
        summary: detail ? compactStemDetail(detail) : { unavailable: true },
      }
    }
    if (block.block_type === 'question' && block.question_id) {
      const stemId = questionStemIdsByQuestionId.get(block.question_id)
      const detail = stemId ? stemDetails.get(stemId) : null
      return {
        index,
        role,
        type: block.block_type,
        summary: detail ? compactStemDetail(detail, block.question_id) : { unavailable: true },
      }
    }
    if (block.block_type === 'video') {
      return { index, role, type: block.block_type, summary: { url: String(block.content.url ?? '') } }
    }
    if (block.block_type === 'file') {
      return {
        index,
        role,
        type: block.block_type,
        summary: { label: String(block.content.label ?? 'File') },
      }
    }
    return {
      index,
      role,
      type: block.block_type,
      summary: {
        label: String(block.content.label ?? block.content.trainerKey ?? 'Skill trainer'),
      },
    }
  })

  return {
    module: {
      title: params.module.title,
      description: params.module.description,
      sectionId: params.module.sectionId ?? null,
    },
    blockCount: params.blocks.length,
    targetIndex,
    blocks: contextBlocks,
  }
}

export function metadataToJson(value: Record<string, unknown>): Json {
  return value as Json
}

export function jsonLike(value: unknown): JsonLike {
  return value as JsonLike
}
