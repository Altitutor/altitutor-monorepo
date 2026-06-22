import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { callUcatAiJson } from '@/features/ucat/shared/server/ucat-ai-client'
import {
  AiToolQuestionStemPayloadSchema,
  AiToolRewriteResponseSchema,
  assertRewriteSupported,
  rewriteResponseToStemValues,
  summarizeStemForAi,
} from '@/features/ucat/questions/lib/ai-tools'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

const RewriteBodySchema = z.object({
  stem: AiToolQuestionStemPayloadSchema,
})

const SYSTEM_PROMPT = `You rewrite UCAT ANZ question stems to reduce source-text similarity for tutor review.

Rules:
1. Preserve the tested skill, answer logic, correct answer positions, explanation meaning, section fit, difficulty, and time burden.
2. Rewrite the shared stem text, each question text, and each answer option text.
3. Do not add or remove questions.
4. Do not add, remove, reorder, or relabel answer options.
5. Keep numbers, units, names, and logical relationships consistent unless rewording requires harmless equivalent wording.
6. Return JSON only.`

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof RewriteBodySchema>
  try {
    body = RewriteBodySchema.parse(await request.json())
    assertRewriteSupported(body.stem)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid rewrite payload' },
      { status: 400 }
    )
  }

  const summary = summarizeStemForAi(body.stem)
  const prompt = JSON.stringify(
    {
      task: 'Rewrite this UCAT stem to reduce source-text similarity while preserving answer logic.',
      stem: summary,
      outputShape: {
        stemText: 'rewritten shared stem text',
        questions: [
          {
            questionText: 'rewritten question text',
            options: ['rewritten option A', 'rewritten option B'],
          },
        ],
        summary: 'short description of wording changes',
      },
    },
    null,
    2
  )

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const raw = await callUcatAiJson({
      client,
      operation: 'question_rewrite',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.35,
      metadata: { questionCount: body.stem.questions.length },
    })
    const parse = AiToolRewriteResponseSchema.safeParse(raw.parsed)
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Rewrite output schema mismatch', details: parse.error.flatten() },
        { status: 500 }
      )
    }
    if (parse.data.questions.length !== body.stem.questions.length) {
      return NextResponse.json({ error: 'Rewrite changed the number of questions.' }, { status: 500 })
    }
    const optionCountChanged = parse.data.questions.some(
      (question, questionIndex) => question.options.length !== body.stem.questions[questionIndex]?.options.length
    )
    if (optionCountChanged) {
      return NextResponse.json({ error: 'Rewrite changed the number of answer options.' }, { status: 500 })
    }

    return NextResponse.json({
      rewrittenStem: rewriteResponseToStemValues(
        body.stem as unknown as UcatQuestionStemFormValues,
        parse.data
      ),
      summary: parse.data.summary ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Question rewrite failed' },
      { status: 500 }
    )
  }
}
