import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  callUcatAiJson,
  getUcatAiPromptLayers,
  resolveUcatAiConfig,
} from '@/features/ucat/shared/server/ucat-ai-client'
import {
  AiToolQuestionStemPayloadSchema,
  AiToolWriteQuestionResponseSchema,
  summarizeStemForAi,
  writtenQuestionToFormValue,
} from '@/features/ucat/questions/lib/ai-tools'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

const WriteQuestionBodySchema = z.object({
  stem: AiToolQuestionStemPayloadSchema,
  modelProfileId: z.string().uuid().nullable().optional(),
  instructions: z.string().trim().max(1200).nullable().optional(),
})

async function fetchPromptContext(client: SupabaseClient<Database>, stem: z.infer<typeof AiToolQuestionStemPayloadSchema>) {
  const asAny = client as SupabaseAny
  const [{ data: section }, { data: category }, { data: tags }] = await Promise.all([
    asAny.from('vtutor_ucat_sections').select('id,name').eq('id', stem.sectionId).maybeSingle(),
    stem.categoryId
      ? asAny.from('question_stem_categories').select('id,name').eq('id', stem.categoryId).maybeSingle()
      : Promise.resolve({ data: null }),
    (() => {
      const tagIds = Array.from(new Set(stem.questions.flatMap((question) => question.tagIds ?? [])))
      if (tagIds.length === 0) return Promise.resolve({ data: [] })
      return asAny.from('vtutor_ucat_question_tags').select('id,name').in('id', tagIds)
    })(),
  ])

  const tagRows = ((tags ?? []) as Array<{ id: string; name: string | null }>).filter((tag) => tag.id)
  const layers = await getUcatAiPromptLayers({
    client,
    sectionId: stem.sectionId,
    categoryId: stem.categoryId ?? null,
    tagIds: tagRows.map((tag) => tag.id),
  })

  return {
    sectionName: (section as { name?: string | null } | null)?.name ?? 'UCAT',
    categoryName: (category as { name?: string | null } | null)?.name ?? null,
    tags: tagRows.map((tag) => ({ id: tag.id, name: tag.name ?? 'Selected tag' })),
    promptLayers: layers.map((layer) => ({
      scopeType: layer.scope_type,
      promptText: layer.prompt_text,
      version: layer.prompt_version,
    })),
  }
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof WriteQuestionBodySchema>
  try {
    body = WriteQuestionBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid write-question payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  if (body.stem.questions.some((question) => question.questionType === 'syllogism')) {
    return NextResponse.json(
      { error: 'Write question is only available for multiple-choice stems.' },
      { status: 400 }
    )
  }

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const config = await resolveUcatAiConfig(client, body.modelProfileId ?? null)
    const promptContext = await fetchPromptContext(client, body.stem)
    const existingTagIds = Array.from(new Set(body.stem.questions.flatMap((question) => question.tagIds ?? [])))

    const systemPrompt = `${config.systemPrompts.base_system_prompt}

${config.systemPrompts.writer_prompt}

You are adding exactly one new multiple-choice question to an existing UCAT stem. Use the admin-managed prompt layers supplied in the user prompt.`

    const userPrompt = JSON.stringify(
      {
        task: 'Write one additional UCAT question for the existing stem.',
        section: promptContext.sectionName,
        category: promptContext.categoryName,
        tags: promptContext.tags,
        promptLayers: promptContext.promptLayers,
        tutorInstructions: body.instructions ?? null,
        existingStem: summarizeStemForAi(body.stem),
        requirements: [
          'Do not alter the shared stem.',
          'Do not duplicate an existing question or test exactly the same inference/calculation.',
          'Use the stem as the only source of facts.',
          'Return one question with answer options, exactly one selected correct answer, and a student-facing explanation.',
          'The explanation should teach how to solve the question and why the correct option is correct.',
          ...(promptContext.sectionName === 'Verbal Reasoning'
            ? [
                'In the explanation, cite the relevant passage paragraph number whenever quoting, paraphrasing, or relying on textual evidence, using the supplied stemParagraphs list.',
              ]
            : []),
          'Keep the option count and answer style consistent with the existing stem where possible.',
        ],
        outputShape: {
          questionText: 'new question text',
          answerExplanation: 'student-facing explanation',
          options: [
            { answerText: 'option A', isAnswer: true },
            { answerText: 'option B', isAnswer: false },
          ],
          rationale: 'brief tutor-facing note about what this question tests',
        },
      },
      null,
      2
    )

    const raw = await callUcatAiJson({
      client,
      operation: 'question_write',
      modelProfileId: body.modelProfileId ?? null,
      systemPrompt,
      userPrompt,
      temperature: 0.35,
      metadata: {
        sectionId: body.stem.sectionId,
        categoryId: body.stem.categoryId ?? null,
        existingQuestionCount: body.stem.questions.length,
        promptLayerCount: promptContext.promptLayers.length,
        hasTutorInstructions: !!body.instructions,
      } as Json,
    })

    const parse = AiToolWriteQuestionResponseSchema.safeParse(raw.parsed)
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Write-question output schema mismatch', details: parse.error.flatten() },
        { status: 500 }
      )
    }
    if (parse.data.options.filter((option) => option.isAnswer).length !== 1) {
      return NextResponse.json(
        { error: 'Write-question output must contain exactly one correct answer.' },
        { status: 500 }
      )
    }

    const aiGenerationMetadata = {
      source: 'ucat-ai-question-writing',
      generatedAt: new Date().toISOString(),
      model: raw.model,
      modelProfileId: raw.modelProfileId,
      providerId: raw.providerId,
      promptLayerCount: promptContext.promptLayers.length,
      operation: 'question_write',
      usage: raw.usage,
      finishReason: raw.finishReason,
      sectionId: body.stem.sectionId,
      categoryId: body.stem.categoryId ?? null,
      existingQuestionCount: body.stem.questions.length,
      tutorInstructions: body.instructions ?? null,
    } as Json

    return NextResponse.json({
      question: {
        ...writtenQuestionToFormValue(parse.data, existingTagIds),
        sourceChannel: 'ai_generation',
        aiGenerationMetadata,
      },
      rationale: parse.data.rationale ?? null,
      promptLayerCount: promptContext.promptLayers.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Question writing failed' },
      { status: 500 }
    )
  }
}
