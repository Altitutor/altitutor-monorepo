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
  collectExplanationReviewFlags,
  findMissingExplanations,
  summarizeStemForAi,
} from '@/features/ucat/questions/lib/ai-tools'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

const GenerateExplanationsBodySchema = z.object({
  stem: AiToolQuestionStemPayloadSchema,
  questionIndexes: z.array(z.number().int().nonnegative()).optional(),
})

const SYSTEM_PROMPT = `You are a UCAT ANZ tutor writing student-facing answer explanations for already-authored questions.

Rules:
1. Only explain questions or answer options listed as missing targets.
2. The selected correct answer is supplied in selectedCorrectOptions. Explain why the selected correct answer is correct.
3. Use the full supplied context: shared stem, question text, every answer option, and which option is selected as correct.
4. Teach the student how to solve the question, not merely why the answer key is right. Include the reasoning path, decisive evidence/calculation/logic/judgement, and why plausible distractors fail when useful.
5. Do not change stem text, question text, answer options, or correct answers.
6. Multiple-choice questions need one question-level explanation.
7. Syllogism questions need one explanation for each listed statement option.
8. If the selected correct answer appears wrong, no answer appears correct, multiple answers appear correct, or the question itself has an error, set reviewRequired=true, do not provide answerExplanation/optionExplanations for direct insertion, and explain the issue to the tutor in reviewMessage.
9. When reviewRequired=true and there is a better correct option, include suggestedCorrectOptionIndex and suggestedAnswerExplanation. The suggestedAnswerExplanation should be student-facing and explain why that suggested option is correct.
10. When reviewRequired=true and the question or answer options should be edited, include suggestedChanges.
11. If an explanation cannot be generated confidently from the supplied text, mark it unresolved.
12. Return JSON only.`

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
    return NextResponse.json({ stem: body.stem, updates: [], appliedCount: 0, reviewFlags: [] })
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
            reviewRequired: false,
            reviewMessage: 'tutor-facing issue explanation or null',
            suggestedCorrectOptionIndex: 1,
            suggestedAnswerExplanation: 'student-facing explanation for the suggested correct answer or null',
            suggestedChanges: 'suggested tutor edit or null',
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
    return NextResponse.json({
      stem,
      updates: parse.data.updates,
      appliedCount,
      reviewFlags: collectExplanationReviewFlags(parse.data.updates),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Answer explanation generation failed' },
      { status: 500 }
    )
  }
}
