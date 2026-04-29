import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { AI_IMPORT_QC_SYSTEM_PROMPT, getAiImportSectionPrompt } from '@/features/ucat/questions/lib/ai-import/prompts'
import {
  AiImportDraftStemPayloadSchema,
  AiImportQcResponseSchema,
  type AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'
import { appendAiIssueMetadata } from '@/features/ucat/questions/lib/ai-import/normalize'

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

async function callOpenAiQc(userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const model = process.env.UCAT_AI_IMPORT_MODEL ?? process.env.UCAT_AI_GENERATION_MODEL ?? 'gpt-4o-mini'
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AI_IMPORT_QC_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`QC run failed: ${await response.text()}`)
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('QC run returned empty response')
  return JSON.parse(content)
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

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
    const raw = await callOpenAiQc(prompt)
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
