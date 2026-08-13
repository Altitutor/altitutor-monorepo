import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { buildDraftUcatAssessmentSnapshot } from '@/features/ucat/questions/server/ai-assessment/draft-snapshot'
import { evaluateUcatReadiness } from '@/features/ucat/questions/lib/ai-assessment/readiness'
import { enqueueUcatQuestionAssessmentPreparation } from '@/features/ucat/questions/server/ai-assessment/dispatcher'
import { normalizeBulkImportCreatePayload } from '@/features/ucat/questions/server/bulk-import-create-payload'

const SerializedAnswerOptionSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  index: z.number().int().positive(),
  // Allow full JSON structures (ProseMirror, etc.) for answer text/explanation.
  answer_text: z.unknown(),
  answer_explanation: z.unknown().nullable().optional(),
  answer_key_value: z.enum(['correct', 'yes', 'no', 'most', 'least']).nullable(),
})

const SerializedQuestionSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  index: z.number().int().positive(),
  // Question text and explanation are rich-text JSON blobs in practice.
  question_text: z.unknown(),
  answer_explanation: z.unknown().nullable().optional(),
  difficulty: z.number().min(0).max(1).nullable().optional(),
  time_burden_seconds: z.number().int().positive().nullable().optional(),
  response_type: z.enum(['multiple_choice', 'drag_and_drop']),
  answer_scheme: z.enum([
    'single_choice',
    'situational_judgement_rating',
    'decision_making_binary_placement',
    'situational_judgement_most_least',
  ]),
  source_channel: z.enum(['individual', 'bulk_import', 'ai_generation']).nullable().optional(),
  ai_generation_metadata: z.unknown().nullable().optional(),
  tag_ids: z.array(z.string().uuid()),
  answer_options: z.array(SerializedAnswerOptionSchema),
})

const SerializedStemSchema = z.object({
  stemId: z.string().uuid().nullable().optional(),
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  // Stem text is also rich-text JSON.
  stemText: z.unknown(),
  accessScope: z.enum(['public', 'private']).default('public'),
  sourceChannel: z.enum(['individual', 'bulk_import', 'ai_generation']).nullable().optional(),
  tutorSourceNote: z.string().nullable().optional(),
  importStatus: z.enum(['draft', 'in_review']),
  questions: z.array(SerializedQuestionSchema),
})

const BulkImportBodySchema = z.object({
  sectionId: z.string().uuid(),
  stems: z.array(SerializedStemSchema).min(1),
})

type SerializedStem = z.infer<typeof SerializedStemSchema>

function json(value: unknown): Json {
  return value as Json
}

function readinessValues(stem: SerializedStem): UcatQuestionStemFormValues {
  return {
    sectionId: stem.sectionId,
    categoryId: stem.categoryId ?? null,
    stemText: json(stem.stemText),
    accessScope: stem.accessScope,
    tutorSourceNote: stem.tutorSourceNote ?? null,
    questions: stem.questions.map((question) => ({
      id: question.id ?? crypto.randomUUID(),
      questionText: json(question.question_text),
      responseType: question.response_type,
      answerScheme: question.answer_scheme,
      answerExplanation: question.answer_explanation == null
        ? null
        : json(question.answer_explanation),
      difficulty: question.difficulty ?? null,
      timeBurdenSeconds: question.time_burden_seconds == null
        ? null
        : String(question.time_burden_seconds),
      tagIds: question.tag_ids,
      sourceChannel: question.source_channel ?? stem.sourceChannel ?? 'bulk_import',
      aiGenerationMetadata: question.ai_generation_metadata == null
        ? null
        : json(question.ai_generation_metadata),
      options: question.answer_options.map((option) => ({
        id: option.id ?? crypto.randomUUID(),
        answerText: json(option.answer_text),
        answerExplanation: option.answer_explanation == null
          ? null
          : json(option.answer_explanation),
        answerKeyValue: option.answer_key_value,
      })),
    })),
  }
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let parsedBody: z.infer<typeof BulkImportBodySchema>

  try {
    const json = await request.json()
    parsedBody = BulkImportBodySchema.parse(json)
  } catch (error) {
    const message =
      error instanceof z.ZodError ? 'Invalid bulk import payload' : 'Invalid request payload'
    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 400 }
    )
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient

  const { sectionId, stems } = parsedBody

  const metadataClient = access.userClient as unknown as SupabaseClient<Database>
  const sectionIds = [...new Set(stems.map((stem) => stem.sectionId))]
  const categoryIds = [...new Set(stems.flatMap((stem) => stem.categoryId ? [stem.categoryId] : []))]
  const [sectionsResult, categoriesResult] = await Promise.all([
    metadataClient
      .from('vtutor_ucat_sections')
      .select('id,name,section_number,display_columns')
      .in('id', sectionIds),
    categoryIds.length > 0
      ? metadataClient
          .from('vtutor_ucat_question_stem_categories')
          .select('id,name')
          .in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const metadataError = sectionsResult.error ?? categoriesResult.error
  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 })
  }
  const sectionsById = new Map((sectionsResult.data ?? []).flatMap((row) => row.id ? [[row.id, row] as const] : []))
  const categoryNamesById = new Map((categoriesResult.data ?? []).flatMap((row) => (
    row.id ? [[row.id, row.name ?? ''] as const] : []
  )))

  const readinessFailures = stems.flatMap((stem, stemIndex) => {
    if (stem.importStatus !== 'in_review') return []
    const section = sectionsById.get(stem.sectionId)
    if (!section) {
      return [{ stemIndex, code: 'section_unavailable', message: 'The UCAT section is unavailable.' }]
    }
    const snapshot = buildDraftUcatAssessmentSnapshot({
      stemId: stem.stemId ?? crypto.randomUUID(),
      values: readinessValues(stem),
      sectionName: section.name ?? '',
      sectionNumber: section.section_number ?? 0,
      displayColumns: section.display_columns ?? 1,
      categoryName: stem.categoryId ? categoryNamesById.get(stem.categoryId) ?? null : null,
      tagNamesById: new Map(),
    })
    return evaluateUcatReadiness(snapshot)
      .filter((check) => check.severity === 'error')
      .map((check) => ({ stemIndex, code: check.code, message: check.message }))
  })
  if (readinessFailures.length > 0) {
    return NextResponse.json(
      {
        error: 'One or more stems no longer pass the readiness gates for In review. Import them as Draft or fix the listed issues.',
        readinessFailures,
      },
      { status: 409 },
    )
  }

  // Bulk import is create-only: normalize nulls and remove browser-only draft IDs
  // before calling the upsert RPC, where non-null IDs mean "update existing".
  const normalizedStems = normalizeBulkImportCreatePayload(stems.map((stem) => ({
    ...stem,
    sourceChannel: stem.sourceChannel ?? 'bulk_import',
    tutorSourceNote: stem.tutorSourceNote ?? null,
    questions: stem.questions.map((q) => ({
      ...q,
      answer_explanation:
        q.answer_explanation == null || q.answer_explanation === 'null'
          ? null
          : q.answer_explanation,
      answer_options: (q.answer_options ?? []).map((opt) => ({
        ...opt,
        answer_explanation:
          opt.answer_explanation == null || opt.answer_explanation === 'null'
            ? null
            : opt.answer_explanation,
      })),
    })),
  })))

  const { data, error } = await client.rpc('tutor_ucat_bulk_upsert_question_stem_bundles', {
    p_section_id: sectionId,
    p_stems: normalizedStems,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // RPC should return an array of created stem IDs
  const ids = Array.isArray(data) ? (data as string[]) : []

  if (ids.length !== normalizedStems.length) {
    return NextResponse.json({ error: 'Bulk import returned an unexpected number of stems.' }, { status: 500 })
  }

  const inReviewIds = ids.filter((_, index) => normalizedStems[index].importStatus === 'in_review')
  await enqueueUcatQuestionAssessmentPreparation({
    stemIds: inReviewIds,
    triggerKind: 'review_submission',
  }).catch((assessmentError) => {
    console.error('Could not queue automatic UCAT AI assessment after bulk import', assessmentError)
  })

  const statuses = Object.fromEntries(ids.map((id, index) => [id, normalizedStems[index].importStatus]))

  return NextResponse.json({ ids, statuses })
}
