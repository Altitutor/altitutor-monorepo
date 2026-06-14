import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  AI_IMPORT_GENERATE_MISSING_SYSTEM_PROMPT,
  getAiImportSectionPrompt,
} from '@/features/ucat/questions/lib/ai-import/prompts'
import {
  AiImportDraftStemPayloadSchema,
  AiImportGenerateMissingResponseSchema,
  type AiImportDraftStemPayload,
  type AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'
import { callUcatAiJson } from '@/features/ucat/shared/server/ucat-ai-client'

const GenerateMissingBodySchema = z.object({
  section: z.enum([
    'verbal_reasoning',
    'decision_making',
    'quantitative_reasoning',
    'situational_judgement',
  ]),
  stems: z.array(AiImportDraftStemPayloadSchema).min(1),
})

function listMissingTargets(stems: AiImportDraftStemPayload[]) {
  const targets: Array<{
    stemIndex: number
    questionIndex: number
    stemText: string
    questionText: string
    options: string[]
    imageDependent: boolean
    answerMissing: boolean
    explanationMissing: boolean
  }> = []

  stems.forEach((stem, stemIndex) => {
    const stemText = proseMirrorToPlainText(stem.stemText as never)
    stem.questions.forEach((question, questionIndex) => {
      const answerMissing = !question.options.some((option) => option.isAnswer)
      const explanationMissing = !proseMirrorToPlainText((question.answerExplanation ?? null) as never).trim()
      if (!answerMissing && !explanationMissing) return
      const imageDependent = question.options.some((option) =>
        proseMirrorToPlainText(option.answerText as never).includes('[[IMG:')
      )
      targets.push({
        stemIndex,
        questionIndex,
        stemText,
        questionText: proseMirrorToPlainText(question.questionText as never),
        options: question.options.map((option) => proseMirrorToPlainText(option.answerText as never)),
        imageDependent,
        answerMissing,
        explanationMissing,
      })
    })
  })

  return targets
}

async function callOpenAiMissingAnswers(client: SupabaseClient<Database>, userPrompt: string) {
  const result = await callUcatAiJson({
    client,
    operation: 'ai_import_generate_missing',
    systemPrompt: AI_IMPORT_GENERATE_MISSING_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2,
  })
  return result.parsed
}

function applyUpdates(
  stems: AiImportDraftStemPayload[],
  updates: z.infer<typeof AiImportGenerateMissingResponseSchema>['updates']
): AiImportDraftStemPayload[] {
  const next = structuredClone(stems) as AiImportDraftStemPayload[]
  for (const update of updates) {
    const stem = next[update.stemIndex]
    const question = stem?.questions?.[update.questionIndex]
    if (!stem || !question) continue
    if (update.correctOptionIndex != null && question.options[update.correctOptionIndex]) {
      question.options = question.options.map((option, optionIndex) => ({
        ...option,
        isAnswer: optionIndex === update.correctOptionIndex,
      }))
    }
    if (update.answerExplanation && !update.unresolved) {
      question.answerExplanation = plainTextToProseMirror(update.answerExplanation)
    }
    if (Array.isArray(update.optionExplanations)) {
      question.options = question.options.map((option, optionIndex) => {
        const explanation = update.optionExplanations?.[optionIndex]
        if (typeof explanation !== 'string' || !explanation.trim()) return option
        return {
          ...option,
          answerExplanation: plainTextToProseMirror(explanation),
        }
      })
    }
  }
  return next
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const client = access.userClient as unknown as SupabaseClient<Database>

  let body: z.infer<typeof GenerateMissingBodySchema>
  try {
    body = GenerateMissingBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid generate-missing payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const targets = listMissingTargets(body.stems)
  if (targets.length === 0) {
    return NextResponse.json({ stems: body.stems, updates: [] })
  }

  const prompt = JSON.stringify(
    {
      task: 'Fill missing UCAT answers/explanations only',
      section: body.section,
      sectionRules: getAiImportSectionPrompt(body.section as AiImportSectionKey),
      targets,
      outputShape: {
        updates: [
          {
            stemIndex: 0,
            questionIndex: 0,
            correctOptionIndex: 0,
            answerExplanation: 'string|null',
            optionExplanations: ['string|null'],
            confidence: 0.5,
            rationale: 'string',
            unresolved: false,
          },
        ],
      },
    },
    null,
    2
  )

  try {
    const raw = await callOpenAiMissingAnswers(client, prompt)
    const parse = AiImportGenerateMissingResponseSchema.safeParse(raw)
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Generate-missing output schema mismatch', details: parse.error.flatten() },
        { status: 500 }
      )
    }
    const stems = applyUpdates(body.stems, parse.data.updates)
    return NextResponse.json({ stems, updates: parse.data.updates })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Generate missing answers failed',
      },
      { status: 500 }
    )
  }
}
