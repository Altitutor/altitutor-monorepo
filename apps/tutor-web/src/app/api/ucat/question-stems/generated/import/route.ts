import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'

const GeneratedOptionSchema = z.object({
  index: z.number().int().positive(),
  answerText: z.unknown(),
  answerExplanation: z.unknown().nullable().optional(),
  isAnswer: z.boolean(),
})

const GeneratedQuestionSchema = z.object({
  index: z.number().int().positive(),
  questionText: z.unknown(),
  answerExplanation: z.unknown().nullable().optional(),
  difficulty: z.number().nullable().optional(),
  timeBurdenSeconds: z.number().nullable().optional(),
  questionType: z.enum(['multiple_choice', 'syllogism']),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(GeneratedOptionSchema).min(1),
})

const GeneratedStemSchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: z.unknown(),
  questions: z.array(GeneratedQuestionSchema).min(1),
  aiGenerationMetadata: z.unknown().nullable().optional(),
})

const ImportBodySchema = z.object({
  sectionId: z.string().uuid(),
  stems: z.array(GeneratedStemSchema).min(1),
})

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof ImportBodySchema>
  try {
    body = ImportBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid generated import payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const payload = body.stems.map((stem) => ({
    stemId: null,
    sectionId: stem.sectionId,
    categoryId: stem.categoryId ?? null,
    stemText: stem.stemText ?? {},
    isPrivate: true,
    questions: stem.questions.map((question) => ({
      index: question.index,
      question_text: question.questionText ?? {},
      answer_explanation:
        question.answerExplanation == null || question.answerExplanation === 'null'
          ? null
          : question.answerExplanation,
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      question_type: question.questionType,
      tag_ids: question.tagIds ?? [],
      answer_options: question.options.map((option) => ({
        index: option.index,
        answer_text: option.answerText ?? {},
        answer_explanation:
          option.answerExplanation == null || option.answerExplanation === 'null'
            ? null
            : option.answerExplanation,
        is_answer: option.isAnswer,
      })),
    })),
    ai_generation_metadata: stem.aiGenerationMetadata ?? null,
  }))

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { data, error } = await client.rpc('tutor_ucat_bulk_upsert_generated_question_stem_bundles', {
    p_section_id: body.sectionId,
    p_stems: payload,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const ids = Array.isArray(data) ? (data as string[]) : []
  return NextResponse.json({ ids })
}
