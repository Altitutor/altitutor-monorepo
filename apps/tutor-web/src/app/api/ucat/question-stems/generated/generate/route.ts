import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

const GenerateBodySchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  sourceMode: z.enum(['random', 'selected']),
  sourceStemIds: z.array(z.string().uuid()).optional(),
  stemCount: z.number().int().min(1).max(50),
})

type SourceStem = {
  id: string
  stem_text: Json | null
  questions: Array<{
    question_text?: Json | null
    question_type?: 'multiple_choice' | 'syllogism'
    answer_options?: Array<{
      answer_text?: Json | null
      is_answer?: boolean
    }>
  }> | null
}

type GeneratedStemRaw = {
  stemText: string
  questions: Array<{
    questionText: string
    questionType: 'multiple_choice' | 'syllogism'
    answerExplanation?: string | null
    options: Array<{
      answerText: string
      answerExplanation?: string | null
      isAnswer: boolean
    }>
  }>
}

function plainTextToDoc(text: string): Json {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

function extractText(value: Json | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map((item) => extractText(item as Json)).filter(Boolean).join(' ').trim()
  const record = value as Record<string, Json>
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.content)) {
    return record.content.map((item) => extractText(item as Json)).filter(Boolean).join(' ').trim()
  }
  return Object.values(record).map((item) => extractText(item)).filter(Boolean).join(' ').trim()
}

function compactStemForPrompt(stem: SourceStem): Record<string, unknown> {
  return {
    stemText: extractText(stem.stem_text).slice(0, 1600),
    questions: (stem.questions ?? []).slice(0, 5).map((question) => ({
      questionText: extractText((question.question_text ?? null) as Json).slice(0, 800),
      questionType: question.question_type ?? 'multiple_choice',
      options: (question.answer_options ?? []).slice(0, 6).map((option) => ({
        answerText: extractText((option.answer_text ?? null) as Json).slice(0, 250),
        isAnswer: !!option.is_answer,
      })),
    })),
  }
}

async function generateWithOpenAI(params: {
  sectionName: string
  categoryName: string | null
  stemCount: number
  sourceSamples: SourceStem[]
}): Promise<GeneratedStemRaw[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const model = process.env.UCAT_AI_GENERATION_MODEL ?? 'gpt-4o-mini'
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'

  const samplePayload = params.sourceSamples.map(compactStemForPrompt)
  const systemPrompt = [
    'You generate high-quality UCAT question stems.',
    'Return only valid JSON matching the required schema.',
    'Each generated stem must include at least one question.',
    'For multiple_choice questions, include 4-6 options and exactly one option with isAnswer=true.',
    'For syllogism questions, include options/statements with isAnswer mapping to Yes(true)/No(false).',
    'Do not copy existing stems verbatim; create distinct scenarios with similar difficulty.',
  ].join(' ')

  const userPrompt = JSON.stringify(
    {
      task: 'Generate UCAT question stems from samples',
      section: params.sectionName,
      category: params.categoryName,
      stemCount: params.stemCount,
      examples: samplePayload,
      outputShape: {
        stems: [
          {
            stemText: 'string',
            questions: [
              {
                questionText: 'string',
                questionType: 'multiple_choice|syllogism',
                answerExplanation: 'string|null',
                options: [
                  {
                    answerText: 'string',
                    answerExplanation: 'string|null',
                    isAnswer: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    null,
    2
  )

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI generation failed: ${text}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI generation returned empty response')
  }

  const parsed = JSON.parse(content) as { stems?: GeneratedStemRaw[] }
  if (!Array.isArray(parsed.stems) || parsed.stems.length === 0) {
    throw new Error('AI generation returned no stems')
  }
  return parsed.stems
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof GenerateBodySchema>
  try {
    body = GenerateBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid generation payload', details: error instanceof Error ? error.message : undefined },
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

  let categoryName: string | null = null
  if (body.categoryId) {
    const { data: category, error: categoryError } = await client
      .from('vtutor_ucat_question_stem_categories')
      .select('id,name,ucat_section_id')
      .eq('id', body.categoryId)
      .maybeSingle()
    if (categoryError || !category || category.ucat_section_id !== body.sectionId) {
      return NextResponse.json({ error: 'Invalid category for selected section' }, { status: 400 })
    }
    categoryName = category.name ?? null
  }

  let sourceQuery = client
    .from('vtutor_ucat_question_stem_detail')
    .select('id,stem_text,questions')
    .eq('section_id', body.sectionId)
    .filter('approval_status', 'eq', 'approved')
    .is('deleted_at', null)

  if (body.categoryId) {
    sourceQuery = sourceQuery.eq('question_stem_category_id', body.categoryId)
  }

  if (body.sourceMode === 'selected') {
    if (!body.sourceStemIds || body.sourceStemIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one source stem' }, { status: 400 })
    }
    sourceQuery = sourceQuery.in('id', body.sourceStemIds)
  } else {
    sourceQuery = sourceQuery.limit(50)
  }

  const { data: sourceRows, error: sourceError } = await sourceQuery
  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 400 })
  }

  const source = ((sourceRows ?? []) as unknown as SourceStem[]).filter((row) => row.id)
  if (source.length === 0) {
    return NextResponse.json(
      { error: 'No approved source stems found for this section/category selection' },
      { status: 400 }
    )
  }

  const sampleSize = Math.min(6, source.length)
  const shuffled = [...source].sort(() => Math.random() - 0.5)
  const samples = shuffled.slice(0, sampleSize)

  try {
    const generated = await generateWithOpenAI({
      sectionName: section.name ?? 'UCAT',
      categoryName,
      stemCount: body.stemCount,
      sourceSamples: samples,
    })

    const stems = generated.slice(0, body.stemCount).map((stem, stemIndex) => ({
      sectionId: body.sectionId,
      categoryId: body.categoryId ?? null,
      stemText: plainTextToDoc(stem.stemText.trim()),
      isPrivate: true,
      questions: (stem.questions ?? []).map((question, questionIndex) => ({
        index: questionIndex + 1,
        questionText: plainTextToDoc(question.questionText.trim()),
        answerExplanation:
          question.answerExplanation && question.answerExplanation.trim().length > 0
            ? plainTextToDoc(question.answerExplanation.trim())
            : null,
        difficulty: null,
        timeBurdenSeconds: null,
        questionType: question.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice',
        tagIds: [],
        options: (question.options ?? []).map((option, optionIndex) => ({
          index: optionIndex + 1,
          answerText: plainTextToDoc(option.answerText.trim()),
          answerExplanation:
            option.answerExplanation && option.answerExplanation.trim().length > 0
              ? plainTextToDoc(option.answerExplanation.trim())
              : null,
          isAnswer: !!option.isAnswer,
        })),
      })),
      aiGenerationMetadata: {
        source: 'openai',
        generatedAt: new Date().toISOString(),
        sampleStemIds: samples.map((item) => item.id),
        sectionId: body.sectionId,
        categoryId: body.categoryId ?? null,
        requestedStemCount: body.stemCount,
        outputIndex: stemIndex,
      } as Json,
    }))

    return NextResponse.json({ stems })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate stems',
      },
      { status: 500 }
    )
  }
}
