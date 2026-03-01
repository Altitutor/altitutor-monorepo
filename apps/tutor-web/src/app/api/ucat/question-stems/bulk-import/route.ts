import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

const SerializedAnswerOptionSchema = z.object({
  index: z.number().int().positive(),
  answer_text: z.any(),
  answer_explanation: z.any().nullable().optional(),
  is_answer: z.boolean(),
  image_file_id: z.string().uuid().nullable().optional(),
})

const SerializedQuestionSchema = z.object({
  index: z.number().int().positive(),
  question_text: z.any(),
  answer_explanation: z.any().nullable().optional(),
  difficulty: z.number().nullable().optional(),
  time_burden_seconds: z.number().nullable().optional(),
  question_type: z.enum(['multiple_choice', 'syllogism']),
  tag_ids: z.array(z.string().uuid()),
  answer_options: z.array(SerializedAnswerOptionSchema),
})

const SerializedStemSchema = z.object({
  stemId: z.string().uuid().nullable().optional(),
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: z.any(),
  isPrivate: z.boolean(),
  questions: z.array(SerializedQuestionSchema),
})

const BulkImportBodySchema = z.object({
  sectionId: z.string().uuid(),
  stems: z.array(SerializedStemSchema).min(1),
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

  const { sectionId, stems } = parsedBody

  const { data, error } = await client.rpc('tutor_ucat_bulk_upsert_question_stem_bundles', {
    p_section_id: sectionId,
    p_stems: stems,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // RPC should return an array of created stem IDs
  const ids = Array.isArray(data) ? (data as string[]) : []
  return NextResponse.json({ ids })
}

