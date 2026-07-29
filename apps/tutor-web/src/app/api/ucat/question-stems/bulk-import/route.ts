import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import {
  BulkImportAiReviewSubmissionSchema,
  persistFreshBulkImportAiReviews,
  type BulkImportAiReviewPersistenceResult,
} from '@/features/ucat/questions/server/ai-assessment/bulk-import-review-persistence'

const SerializedAnswerOptionSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  index: z.number().int().positive(),
  // Allow full JSON structures (ProseMirror, etc.) for answer text/explanation.
  answer_text: z.unknown(),
  answer_explanation: z.unknown().nullable().optional(),
  is_answer: z.boolean(),
})

const SerializedQuestionSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  index: z.number().int().positive(),
  // Question text and explanation are rich-text JSON blobs in practice.
  question_text: z.unknown(),
  answer_explanation: z.unknown().nullable().optional(),
  difficulty: z.number().nullable().optional(),
  time_burden_seconds: z.number().nullable().optional(),
  question_type: z.enum(['multiple_choice', 'syllogism']),
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
  questions: z.array(SerializedQuestionSchema),
})

const BulkImportBodySchema = z.object({
  sectionId: z.string().uuid(),
  stems: z.array(SerializedStemSchema).min(1),
  aiReviews: z.array(BulkImportAiReviewSubmissionSchema).max(200).optional().default([]),
})

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

  const { sectionId, stems, aiReviews } = parsedBody

  // Normalize answer_explanation: never send the string "null" to the DB (use actual null).
  const normalizedStems = stems.map((stem) => ({
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
  }))

  const { data, error } = await client.rpc('tutor_ucat_bulk_upsert_question_stem_bundles', {
    p_section_id: sectionId,
    p_stems: normalizedStems,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // RPC should return an array of created stem IDs
  const ids = Array.isArray(data) ? (data as string[]) : []

  // Prefer the RPC setting in_review (post-migration). Fall back to an explicit
  // lifecycle move so older databases still land bulk imports in review.
  if (ids.length > 0) {
    const { error: statusError } = await client.rpc('tutor_ucat_set_content_status_bulk', {
      p_content_type: 'stem',
      p_content_ids: ids,
      p_status: 'in_review',
    })
    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 400 })
    }
  }

  let aiReviewPersistence: BulkImportAiReviewPersistenceResult | undefined
  if (aiReviews.length > 0) {
    try {
      aiReviewPersistence = await persistFreshBulkImportAiReviews({
        reviews: aiReviews,
        importedStemIds: ids,
        userClient: access.userClient as unknown as SupabaseClient<Database>,
      })
    } catch (reviewError) {
      console.error('Could not initialize bulk-import AI review persistence', reviewError)
      aiReviewPersistence = {
        persistedStemIds: [],
        skipped: aiReviews.map((review) => ({
          stemId: review.draftStemId,
          reason: 'persistence_failed',
        })),
      }
    }
  }

  return NextResponse.json({ ids, ...(aiReviewPersistence ? { aiReviewPersistence } : {}) })
}
