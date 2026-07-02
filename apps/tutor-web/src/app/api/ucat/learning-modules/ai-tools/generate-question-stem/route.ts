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
import { generatedContentToProseMirror } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import {
  DifficultyTargetSchema,
  GeneratedCandidateResponseSchema,
  TimeBurdenTargetSchema,
  type GeneratedStem,
} from '@/features/ucat/questions/lib/ai-generation/schema'
import {
  buildLocalPlan,
  correctAnswerPattern,
} from '@/features/ucat/questions/lib/ai-generation/local-plan'
import {
  buildWriterPrompt,
  getAiGenerationSectionPrompt,
  sectionNameToAiGenerationKey,
  type AiGenerationBrief,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import {
  hasBlockingIssues,
  validateGeneratedStemCandidate,
} from '@/features/ucat/questions/lib/ai-generation/gates'
import {
  LessonAiBlockSchema,
  LessonAiModuleSchema,
  buildLessonAiContext,
} from '@/features/ucat/learning-modules/lib/lesson-ai'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any
}

const GenerateQuestionStemBodySchema = z.object({
  module: LessonAiModuleSchema,
  blocks: z.array(LessonAiBlockSchema).max(80),
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  targetTagIds: z.array(z.string().uuid()).default([]),
  difficultyTarget: DifficultyTargetSchema.default('mixed'),
  timeBurdenTarget: TimeBurdenTargetSchema.default('mixed'),
  targetIndex: z.number().int().min(0).max(80),
  targetPositionLabel: z.string().trim().max(240).nullable().optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  modelProfileId: z.string().uuid().nullable().optional(),
})

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/gu, ' ')
}

function difficultyToNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null
}

async function fetchSection(client: SupabaseClient<Database>, sectionId: string) {
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_sections')
    .select('id,name')
    .eq('id', sectionId)
    .maybeSingle()
  if (error || !data?.id) throw new Error('Section not found')
  return data as { id: string; name: string | null }
}

async function fetchSectionCategories(client: SupabaseClient<Database>, sectionId: string) {
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_stem_categories')
    .select('id,name,ucat_section_id')
    .eq('ucat_section_id', sectionId)
    .order('name')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ id: string; name: string | null }>).map((category) => ({
    id: category.id,
    name: category.name ?? 'Untitled category',
  }))
}

async function fetchTargetTags(client: SupabaseClient<Database>, tagIds: string[]) {
  if (tagIds.length === 0) return []
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_tags')
    .select('id,name')
    .in('id', tagIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ id: string; name: string | null }>).map((tag) => ({
    id: tag.id,
    name: tag.name ?? 'Untitled tag',
  }))
}

async function buildPromptLayers(params: {
  client: SupabaseClient<Database>
  sectionId: string
  sectionName: string
  categoryId: string | null
  categoryName: string | null
  availableCategories: Array<{ id: string; name: string }>
  tags: Array<{ id: string; name: string }>
}) {
  const layers = await getUcatAiPromptLayers({
    client: params.client,
    sectionId: params.sectionId,
    categoryId: params.categoryId,
    categoryIds: params.categoryId ? [] : params.availableCategories.map((category) => category.id),
    tagIds: params.tags.map((tag) => tag.id),
  })
  return layers.map((layer) => {
    const category = params.availableCategories.find((item) => item.id === layer.scope_id)
    const tag = params.tags.find((item) => item.id === layer.scope_id)
    return {
      scopeType: layer.scope_type,
      name:
        layer.scope_type === 'section'
          ? params.sectionName
          : layer.scope_type === 'stem_category'
            ? params.categoryName ?? category?.name ?? 'Selected category'
            : tag?.name ?? 'Selected tag',
      promptText: layer.prompt_text,
      version: layer.prompt_version,
    }
  })
}

function normalizePlannedAnswerPositions(stem: GeneratedStem, runIndex: number): GeneratedStem {
  const category = normalizeLabel(stem.categoryName)
  if (category !== 'reading comprehension' && category !== 'logical puzzles') return stem
  const desiredPositions = correctAnswerPattern(stem.categoryName ?? null, runIndex)
  return {
    ...stem,
    questions: stem.questions.map((question, questionIndex) => {
      const correctIndex = question.options.findIndex((option) => option.isAnswer)
      const desiredLabel = desiredPositions[questionIndex] ?? 'A'
      const desiredIndex = Math.max(0, Math.min(question.options.length - 1, desiredLabel.charCodeAt(0) - 65))
      if (correctIndex < 0 || correctIndex === desiredIndex) return question
      const options = [...question.options]
      const [correctOption] = options.splice(correctIndex, 1)
      if (!correctOption) return question
      options.splice(desiredIndex, 0, correctOption)
      return { ...question, options }
    }),
  }
}

function generatedStemToImportPayload(params: {
  stem: GeneratedStem
  sectionId: string
  categoryId: string | null
  modelProfileId: string | null
  providerId: string | null
  model: string
  metadata: Record<string, unknown>
}) {
  return {
    stemId: null,
    sectionId: params.sectionId,
    categoryId: params.categoryId,
    stemText: generatedContentToProseMirror(params.stem.stemText),
    isPrivate: true,
    sourceChannel: 'ai_generation',
    tutorSourceNote: null,
    questions: params.stem.questions.map((question, questionIndex) => ({
      index: questionIndex + 1,
      question_text: generatedContentToProseMirror(question.questionText),
      answer_explanation: question.answerExplanation
        ? generatedContentToProseMirror(question.answerExplanation)
        : null,
      difficulty: difficultyToNumber(question.estimatedDifficulty),
      time_burden_seconds: question.estimatedTimeBurdenSeconds ?? null,
      question_type: question.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice',
      source_channel: 'ai_generation',
      tag_ids: question.tagIds ?? [],
      ai_generation_metadata: {
        source: 'lesson-ai-question-stem-generation',
        generatedAt: new Date().toISOString(),
        modelProfileId: params.modelProfileId,
        providerId: params.providerId,
        model: params.model,
        operation: 'lesson_question_stem_generate',
        warnings: params.stem.warnings,
        ...params.metadata,
      } as Json,
      answer_options: question.options.map((option, optionIndex) => ({
        index: optionIndex + 1,
        answer_text: generatedContentToProseMirror(option.answerText),
        answer_explanation: option.answerExplanation
          ? generatedContentToProseMirror(option.answerExplanation)
          : null,
        is_answer: option.isAnswer,
      })),
    })),
    ai_generation_metadata: {
      source: 'lesson-ai-question-stem-generation',
      generatedAt: new Date().toISOString(),
      modelProfileId: params.modelProfileId,
      providerId: params.providerId,
      model: params.model,
      operation: 'lesson_question_stem_generate',
      warnings: params.stem.warnings,
      ...params.metadata,
    } as Json,
  }
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof GenerateQuestionStemBodySchema>
  try {
    body = GenerateQuestionStemBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid lesson question-stem generation payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const config = await resolveUcatAiConfig(client, body.modelProfileId ?? null)
    const section = await fetchSection(client, body.sectionId)
    const categories = await fetchSectionCategories(client, body.sectionId)
    const categoryIdByName = new Map(categories.map((category) => [normalizeLabel(category.name), category.id]))
    const categoryName = body.categoryId
      ? categories.find((category) => category.id === body.categoryId)?.name ?? null
      : null
    if (body.categoryId && !categoryName) {
      return NextResponse.json({ error: 'Invalid category for selected section' }, { status: 400 })
    }
    const targetTags = await fetchTargetTags(client, body.targetTagIds)
    const promptLayers = await buildPromptLayers({
      client,
      sectionId: body.sectionId,
      sectionName: section.name ?? 'UCAT',
      categoryId: body.categoryId ?? null,
      categoryName,
      availableCategories: categories,
      tags: targetTags,
    })
    const lessonContext = await buildLessonAiContext({
      client,
      module: body.module,
      blocks: body.blocks,
      targetIndex: body.targetIndex,
    })

    const brief: AiGenerationBrief = {
      sectionName: section.name ?? 'UCAT',
      categoryName,
      availableCategories: body.categoryId ? [] : categories,
      stemCount: 1,
      difficultyTarget: body.difficultyTarget,
      timeBurdenTarget: body.timeBurdenTarget,
      targetTags,
      runInstructions: JSON.stringify(
        {
          tutorInstructions: body.instructions ?? null,
          targetPosition: {
            index: body.targetIndex,
            label: body.targetPositionLabel ?? null,
          },
          lessonContext,
          requirement:
            'Generate a UCAT question stem that tests or reinforces the specific concept being taught at this lesson position. Do not write explanatory teaching text; write normal UCAT assessment content for tutor review.',
        },
        null,
        2
      ),
      examples: [],
      promptLayers,
    }

    const systemPrompt = `${config.systemPrompts.base_system_prompt}

${config.systemPrompts.writer_prompt}

${getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(section.name ?? null))}

Use the supplied lesson context only to choose the concept and difficulty fit. The generated assessment content must be self-contained and must not refer to the learning module, block numbers, lesson, tutor, or student. Return JSON only.`

    const raw = await callUcatAiJson({
      client,
      operation: 'lesson_question_stem_generate',
      modelProfileId: body.modelProfileId ?? null,
      systemPrompt,
      userPrompt: buildWriterPrompt({ ...brief, plan: buildLocalPlan(brief, 0) }),
      temperature: Number(config.modelProfile.temperature),
      maxCompletionTokens: Math.max(3000, config.modelProfile.max_completion_tokens),
      timeoutMs: 75_000,
      providerSort: 'throughput',
      metadata: {
        moduleId: body.module.moduleId ?? null,
        targetIndex: body.targetIndex,
        sectionId: body.sectionId,
        categoryId: body.categoryId ?? null,
        targetTagIds: body.targetTagIds,
        difficultyTarget: body.difficultyTarget,
        timeBurdenTarget: body.timeBurdenTarget,
        promptLayerCount: promptLayers.length,
        hasTutorInstructions: !!body.instructions,
      } as Json,
    })

    const parsed = GeneratedCandidateResponseSchema.safeParse(raw.parsed)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Lesson question-stem generation output schema mismatch', details: parsed.error.flatten() },
        { status: 500 }
      )
    }

    const generatedStem = normalizePlannedAnswerPositions(parsed.data.stems[0], 0)
    const gateIssues = validateGeneratedStemCandidate(generatedStem, 0, {
      sectionName: section.name ?? 'UCAT',
      categoryName,
      sourcePlainTexts: [],
    })
    if (hasBlockingIssues(gateIssues)) {
      return NextResponse.json(
        { error: gateIssues[0]?.message ?? 'Generated stem did not pass quality gates.', gateIssues },
        { status: 422 }
      )
    }

    const generatedCategoryId =
      generatedStem.categoryId ??
      body.categoryId ??
      categoryIdByName.get(normalizeLabel(generatedStem.categoryName)) ??
      null
    const importPayload = generatedStemToImportPayload({
      stem: generatedStem,
      sectionId: body.sectionId,
      categoryId: generatedCategoryId,
      modelProfileId: raw.modelProfileId,
      providerId: raw.providerId,
      model: raw.model,
      metadata: {
        lessonModuleId: body.module.moduleId ?? null,
        lessonTitle: body.module.title,
        targetIndex: body.targetIndex,
        targetPositionLabel: body.targetPositionLabel ?? null,
        tutorInstructions: body.instructions ?? null,
        gateIssues,
        promptLayerCount: promptLayers.length,
        usage: raw.usage,
        finishReason: raw.finishReason,
      },
    })

    const { data, error } = await asAny(client).rpc('tutor_ucat_bulk_upsert_generated_question_stem_bundles', {
      p_section_id: body.sectionId,
      p_stems: [importPayload],
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const stemId = Array.isArray(data) && typeof data[0] === 'string' ? data[0] : null
    if (!stemId) {
      return NextResponse.json({ error: 'Generated stem import did not return a stem id.' }, { status: 500 })
    }

    return NextResponse.json({
      stemId,
      summary: `Generated pending ${section.name ?? 'UCAT'} stem for tutor review.`,
      metadata: {
        source: 'lesson-ai',
        operation: 'lesson_question_stem_generate',
        generatedAt: new Date().toISOString(),
        modelProfileId: raw.modelProfileId,
        providerId: raw.providerId,
        model: raw.model,
        targetIndex: body.targetIndex,
        targetPositionLabel: body.targetPositionLabel ?? null,
        generatedCategoryId,
        generatedCategoryName: generatedStem.categoryName ?? null,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lesson question-stem generation failed' },
      { status: 500 }
    )
  }
}
