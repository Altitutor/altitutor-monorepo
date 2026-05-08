import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  AiImportExtractResponseSchema,
  type AiImportSectionKey,
  AiImportSectionKeySchema,
} from '@/features/ucat/questions/lib/ai-import/schema'
import {
  AI_IMPORT_EXTRACT_SYSTEM_PROMPT,
  buildAiImportExtractionUserPrompt,
  getAiImportSectionPrompt,
} from '@/features/ucat/questions/lib/ai-import/prompts'
import {
  preprocessAiImportDocument,
  stringifyAiImportSourceBlocks,
} from '@/features/ucat/questions/lib/ai-import/preprocess'
import { normalizeAiExtractionToDrafts } from '@/features/ucat/questions/lib/ai-import/normalize'
import { validateAiExtraction } from '@/features/ucat/questions/lib/ai-import/validators'
import { parseDecisionMakingAnswers } from '@/features/ucat/questions/lib/parseAnswersTable'

const ExtractBodySchema = z.object({
  sectionId: z.string().uuid(),
  document: z.unknown(),
  expectedQuestionCount: z.number().int().positive().max(400).nullable().optional(),
})

const SECTION_NAME_TO_KEY: Record<string, AiImportSectionKey> = {
  'Verbal Reasoning': 'verbal_reasoning',
  'Decision Making': 'decision_making',
  'Quantitative Reasoning': 'quantitative_reasoning',
  'Situational Judgement': 'situational_judgement',
}

const RESPONSE_SCHEMA_DESCRIPTION = `{
  "status": "success|rejected",
  "rejectionReason": "string|null",
  "sourceSummary": { "estimatedQuestions": 0, "estimatedAnswerRows": 0, "imageCount": 0, "blockCount": 0 },
  "globalIssues": [{ "code": "missing_answer|missing_explanation|ambiguous_answer|low_confidence|image_dependent|format_mismatch|section_mismatch", "severity": "low|medium|high", "message": "string" }],
  "stems": [{
    "stemText": "string",
    "issues": [],
    "questions": [{
      "questionText": "string",
      "questionType": "multiple_choice|syllogism",
      "options": [{ "answerText": "string", "isAnswer": true, "answerExplanation": "string|null" }],
      "answerExplanation": "string|null",
      "confidence": 0.0,
      "imageDependent": false,
      "issues": [],
      "qcSkippedReasons": []
    }]
  }]
}`

function isYesNoOnlyOptions(options: Array<{ answerText: string }>): boolean {
  const values = options.map((option) => option.answerText.trim().toLowerCase())
  return values.length === 2 && values.includes('yes') && values.includes('no')
}

function applyDecisionMakingAnswerRepair(args: {
  sectionKey: AiImportSectionKey
  extraction: z.infer<typeof AiImportExtractResponseSchema>
  sourceText: string
}): {
  regroupedSyllogismQuestionCount: number
  reshapedSyllogismCount: number
  appliedAnswerUpdates: number
  appliedExplanationUpdates: number
} {
  if (args.sectionKey !== 'decision_making') {
    return {
      regroupedSyllogismQuestionCount: 0,
      reshapedSyllogismCount: 0,
      appliedAnswerUpdates: 0,
      appliedExplanationUpdates: 0,
    }
  }

  let regroupedSyllogismQuestionCount = 0
  let reshapedSyllogismCount = 0
  let appliedAnswerUpdates = 0
  let appliedExplanationUpdates = 0

  // Recover common malformed output where each syllogism statement is emitted as a standalone
  // Yes/No question and the instruction line is emitted as a separate MC question.
  for (const stem of args.extraction.stems) {
    const instructionIndex = stem.questions.findIndex((question) => {
      const text = question.questionText.toLowerCase()
      return (
        text.includes('place') &&
        text.includes('yes') &&
        text.includes('no') &&
        (text.includes('conclusion') || text.includes('follow'))
      )
    })
    if (instructionIndex < 0) continue

    const statementIndexes = stem.questions
      .map((question, index) => ({ question, index }))
      .filter(
        ({ question, index }) =>
          index !== instructionIndex &&
          isYesNoOnlyOptions(question.options) &&
          !question.questionText.toLowerCase().includes('place')
      )
      .map(({ index }) => index)

    if (statementIndexes.length < 3) continue

    const instructionQuestion = stem.questions[instructionIndex]
    const statementQuestions = statementIndexes.map((index) => stem.questions[index])
    instructionQuestion.questionType = 'syllogism'
    instructionQuestion.options = statementQuestions.map((question) => {
      const yesOption = question.options.find(
        (option) => option.answerText.trim().toLowerCase() === 'yes'
      )
      const noOption = question.options.find(
        (option) => option.answerText.trim().toLowerCase() === 'no'
      )
      return {
        answerText: question.questionText,
        isAnswer: yesOption?.isAnswer === true,
        answerExplanation:
          yesOption?.isAnswer === true
            ? yesOption.answerExplanation ?? null
            : noOption?.answerExplanation ?? null,
      }
    })
    stem.questions = stem.questions.filter(
      (_, index) => index === instructionIndex || !statementIndexes.includes(index)
    )
    regroupedSyllogismQuestionCount += 1
  }

  const flatQuestions: Array<{
    question: z.infer<typeof AiImportExtractResponseSchema>['stems'][number]['questions'][number]
    type: 'syllogism' | 'multiple_choice'
  }> = []
  for (const stem of args.extraction.stems) {
    for (const question of stem.questions) {
      const type: 'syllogism' | 'multiple_choice' =
        question.questionType === 'syllogism' || isYesNoOnlyOptions(question.options)
          ? 'syllogism'
          : 'multiple_choice'
      flatQuestions.push({ question, type })
    }
  }

  const parsedAnswers = parseDecisionMakingAnswers(
    args.sourceText,
    flatQuestions.map((item) => item.type)
  )

  flatQuestions.forEach((item, index) => {
    const parsed = parsedAnswers[index]
    if (!parsed) return
    const question = item.question

    if (item.type === 'syllogism') {
      const pattern = parsed.pattern?.trim().toUpperCase() ?? ''
      if (pattern.length === question.options.length && question.options.length > 0) {
        question.questionType = 'syllogism'
        question.options = question.options.map((option, optionIndex) => ({
          answerText: option.answerText,
          isAnswer: pattern.charAt(optionIndex) === 'Y',
          answerExplanation: parsed.optionExplanations?.[optionIndex] ?? null,
        }))
        question.answerExplanation = null
        reshapedSyllogismCount += 1
        appliedAnswerUpdates += 1
        if (Array.isArray(parsed.optionExplanations) && parsed.optionExplanations.some(Boolean)) {
          appliedExplanationUpdates += 1
        }
      }
      return
    }

    if (parsed.letter) {
      const letter = parsed.letter.charAt(0).toUpperCase()
      const indexFromLetter = letter.charCodeAt(0) - 'A'.charCodeAt(0)
      if (indexFromLetter >= 0 && indexFromLetter < question.options.length) {
        question.options = question.options.map((option, optionIndex) => ({
          ...option,
          isAnswer: optionIndex === indexFromLetter,
        }))
        appliedAnswerUpdates += 1
      }
    }
    if (parsed.explanation && parsed.explanation.trim().length > 0) {
      question.answerExplanation = parsed.explanation
      appliedExplanationUpdates += 1
    }
  })

  return {
    regroupedSyllogismQuestionCount,
    reshapedSyllogismCount,
    appliedAnswerUpdates,
    appliedExplanationUpdates,
  }
}

async function callOpenAiJson(params: {
  systemPrompt: string
  userPrompt: string
  maxCompletionTokens?: number
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  const model = process.env.UCAT_AI_IMPORT_MODEL ?? process.env.UCAT_AI_GENERATION_MODEL ?? 'gpt-4o-mini'
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'

  const controller = new AbortController()
  const timeoutMs = Number.parseInt(process.env.UCAT_AI_IMPORT_TIMEOUT_MS ?? '120000', 10)
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const maxCompletionTokens =
    params.maxCompletionTokens ??
    Number.parseInt(process.env.UCAT_AI_IMPORT_MAX_COMPLETION_TOKENS ?? '6000', 10)

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_completion_tokens: maxCompletionTokens,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  }).finally(() => clearTimeout(timeout))

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI extract failed: ${text}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI extract returned empty response')
  }

  return {
    content,
    model,
    usage: json.usage ?? null,
    contentLength: content.length,
    finishReason: json.choices?.[0]?.finish_reason ?? null,
    maxCompletionTokens,
  }
}

function getInitialCompletionBudget(estimatedQuestions: number): number {
  const envBudget = Number.parseInt(process.env.UCAT_AI_IMPORT_MAX_COMPLETION_TOKENS ?? '6000', 10)
  if (Number.isNaN(envBudget) || envBudget <= 0) return 6000
  if (estimatedQuestions <= 0) return envBudget
  const derived = 1200 + estimatedQuestions * 220
  return Math.max(envBudget, Math.min(10000, derived))
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof ExtractBodySchema>
  try {
    body = ExtractBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid AI import extraction payload',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 400 }
    )
  }

  const client = access.userClient as unknown as SupabaseClient<Database>
  const { data: section, error: sectionError } = await client
    .from('vtutor_ucat_sections')
    .select('id,name')
    .eq('id', body.sectionId)
    .maybeSingle()

  if (sectionError || !section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 400 })
  }

  const sectionKey = SECTION_NAME_TO_KEY[section.name ?? '']
  if (!sectionKey || !AiImportSectionKeySchema.safeParse(sectionKey).success) {
    return NextResponse.json(
      { error: 'Selected section is not supported by AI import yet.' },
      { status: 400 }
    )
  }

  const preprocess = preprocessAiImportDocument(body.document as never, sectionKey)
  if (preprocess.blocks.length === 0) {
    return NextResponse.json(
      {
        status: 'rejected',
        rejectionReason: 'No parsable text blocks found in the pasted document.',
        stems: [],
        extraction: null,
        warnings: [],
      },
      { status: 200 }
    )
  }

  const userPrompt = buildAiImportExtractionUserPrompt({
    sectionName: section.name ?? 'UCAT',
    sectionPrompt: getAiImportSectionPrompt(sectionKey),
    schemaDescription: RESPONSE_SCHEMA_DESCRIPTION,
    preprocessSummary: JSON.stringify(
      {
        ...preprocess.summary,
        expectedQuestionCountHint: body.expectedQuestionCount ?? null,
      },
      null,
      2
    ),
    sourceBlocks: stringifyAiImportSourceBlocks(preprocess.blocks),
  })

  try {
    let parsed: unknown = null
    let extractionParse:
      | ReturnType<typeof AiImportExtractResponseSchema.safeParse>
      | null = null
    let model = ''
    const maxAttempts = 3
    let completionBudget = getInitialCompletionBudget(preprocess.summary.estimatedQuestions)

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await callOpenAiJson({
        systemPrompt: AI_IMPORT_EXTRACT_SYSTEM_PROMPT,
        userPrompt,
        maxCompletionTokens: completionBudget,
      })
      model = response.model
      try {
        parsed = JSON.parse(response.content)
      } catch (error) {
        if (response.finishReason === 'length' && attempt < maxAttempts) {
          completionBudget = Math.min(12000, completionBudget + 2500)
          continue
        }
        throw error
      }

      extractionParse = AiImportExtractResponseSchema.safeParse(parsed)
      if (!extractionParse.success && response.finishReason === 'length' && attempt < maxAttempts) {
        completionBudget = Math.min(12000, completionBudget + 2500)
        continue
      }
      break
    }

    if (!extractionParse) {
      throw new Error('AI extract failed before schema parsing could complete.')
    }
    if (!extractionParse.success) {
      return NextResponse.json(
        {
          error: 'AI extract output schema mismatch',
          details: extractionParse.error.flatten(),
        },
        { status: 500 }
      )
    }

    const extraction = extractionParse.data
    const sourceBlockText = preprocess.blocks.map((block) => block.text).join('\n')
    applyDecisionMakingAnswerRepair({
      sectionKey,
      extraction,
      sourceText: sourceBlockText,
    })
    if (extraction.status === 'rejected') {
      return NextResponse.json(
        {
          status: 'rejected',
          rejectionReason: extraction.rejectionReason ?? 'The source does not look like valid UCAT content.',
          stems: [],
          extraction,
          warnings: extraction.globalIssues,
        },
        { status: 200 }
      )
    }

    const warnings = validateAiExtraction(
      extraction,
      sectionKey,
      body.expectedQuestionCount ?? preprocess.summary.estimatedQuestions
    )
    const stems = normalizeAiExtractionToDrafts({
      sectionId: body.sectionId,
      model,
      extraction,
    })

    return NextResponse.json({
      status: 'success',
      rejectionReason: null,
      stems,
      extraction,
      warnings,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'AI extract failed',
      },
      { status: 500 }
    )
  }
}
