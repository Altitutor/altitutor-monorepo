import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { AI_IMPORT_QC_SYSTEM_PROMPT, getAiImportSectionPrompt } from '@/features/ucat/questions/lib/ai-import/prompts'
import {
  AiImportDraftStemPayloadSchema,
  AiImportQcResponseSchema,
  type AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'
import { appendAiIssueMetadata } from '@/features/ucat/questions/lib/ai-import/normalize'
import { callUcatAiJson } from '@/features/ucat/shared/server/ucat-ai-client'

const QcBodySchema = z.object({
  section: z.enum([
    'verbal_reasoning',
    'decision_making',
    'quantitative_reasoning',
    'situational_judgement',
  ]),
  stems: z.array(AiImportDraftStemPayloadSchema).min(1),
})

function summarizeStems(stems: z.infer<typeof QcBodySchema>['stems']) {
  return stems.map((stem, stemIndex) => ({
    stemIndex,
    stemText: proseMirrorToPlainText(stem.stemText as never),
    questions: stem.questions.map((question, questionIndex) => ({
      questionIndex,
      questionText: proseMirrorToPlainText(question.questionText as never),
      answerExplanation: proseMirrorToPlainText((question.answerExplanation ?? null) as never),
      options: question.options.map((option, optionIndex) => ({
        optionIndex,
        answerText: proseMirrorToPlainText(option.answerText as never),
        isAnswer: option.isAnswer,
        answerExplanation: proseMirrorToPlainText((option.answerExplanation ?? null) as never),
      })),
    })),
  }))
}

async function callOpenAiQc(client: SupabaseClient<Database>, userPrompt: string) {
  const result = await callUcatAiJson({
    client,
    operation: 'ai_import_qc',
    systemPrompt: AI_IMPORT_QC_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.1,
  })
  return result.parsed
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const client = access.userClient as unknown as SupabaseClient<Database>

  let body: z.infer<typeof QcBodySchema>
  try {
    body = QcBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid QC payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const prompt = JSON.stringify(
    {
      task: 'Audit extracted UCAT ANZ questions without rewriting text',
      section: body.section,
      sectionRules: getAiImportSectionPrompt(body.section as AiImportSectionKey),
      stems: summarizeStems(body.stems),
      outputShape: {
        issues: [
          {
            stemIndex: 0,
            questionIndex: 0,
            severity: 'low|medium|high',
            category: 'section_fit|question_quality|answer_correctness|explanation_quality|ambiguity',
            message: 'string',
            confidence: 0.5,
            skipped: false,
          },
        ],
      },
    },
    null,
    2
  )

  try {
    const raw = await callOpenAiQc(client, prompt)
    const parse = AiImportQcResponseSchema.safeParse(raw)
    if (!parse.success) {
      return NextResponse.json(
        {
          error: 'QC output schema mismatch',
          details: parse.error.flatten(),
        },
        { status: 500 }
      )
    }
    const stems = appendAiIssueMetadata(body.stems, {
      qcRun: true,
      qcRanAt: new Date().toISOString(),
      qcIssues: parse.data.issues,
    })
    return NextResponse.json({ stems, issues: parse.data.issues })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'QC run failed' },
      { status: 500 }
    )
  }
}
