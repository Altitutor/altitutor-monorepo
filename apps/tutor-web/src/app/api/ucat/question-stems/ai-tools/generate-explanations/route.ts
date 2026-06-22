import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { callUcatAiJson } from '@/features/ucat/shared/server/ucat-ai-client'
import {
  AiToolExplanationResponseSchema,
  AiToolQuestionStemPayloadSchema,
  applyExplanationUpdates,
  findMissingExplanations,
  summarizeStemForAi,
} from '@/features/ucat/questions/lib/ai-tools'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

const GenerateExplanationsBodySchema = z.object({
  stem: AiToolQuestionStemPayloadSchema,
  questionIndexes: z.array(z.number().int().nonnegative()).optional(),
})

const SYSTEM_PROMPT = `You write concise UCAT ANZ answer explanations for already-authored questions.

Rules:
1. Only explain questions or answer options listed as missing targets.
2. Do not change stem text, question text, answer options, or correct answers.
3. Multiple-choice questions need one question-level explanation.
4. Syllogism questions need one explanation for each listed statement option.
5. Explain the decisive evidence, calculation, logic, or professional judgement.
6. Keep explanations concise and suitable for tutor review.
7. If an explanation cannot be generated confidently from the supplied text, mark it unresolved.
8. Return JSON only.`

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof GenerateExplanationsBodySchema>
  try {
    body = GenerateExplanationsBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid explanation payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const requestedIndexes = new Set(body.questionIndexes ?? body.stem.questions.map((_, index) => index))
  const targets = findMissingExplanations(body.stem as unknown as UcatQuestionStemFormValues).filter((target) =>
    requestedIndexes.has(target.questionIndex)
  )

  if (targets.length === 0) {
    return NextResponse.json({ stem: body.stem, updates: [], appliedCount: 0 })
  }

  const prompt = JSON.stringify(
    {
      task: 'Generate only missing UCAT answer explanations.',
      stem: summarizeStemForAi(body.stem),
      missingTargets: targets,
      outputShape: {
        updates: [
          {
            questionIndex: 0,
            answerExplanation: 'multiple-choice explanation or null',
            optionExplanations: ['syllogism option explanation or null'],
            confidence: 0.8,
            unresolved: false,
            rationale: 'brief generation rationale',
          },
        ],
      },
    },
    null,
    2
  )

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const raw = await callUcatAiJson({
      client,
      operation: 'answer_explanation_generate',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.2,
      metadata: { targetCount: targets.length },
    })
    const parse = AiToolExplanationResponseSchema.safeParse(raw.parsed)
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Explanation output schema mismatch', details: parse.error.flatten() },
        { status: 500 }
      )
    }

    const { stem, appliedCount } = applyExplanationUpdates(
      body.stem as unknown as UcatQuestionStemFormValues,
      parse.data.updates
    )
    return NextResponse.json({ stem, updates: parse.data.updates, appliedCount })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Answer explanation generation failed' },
      { status: 500 }
    )
  }
}
