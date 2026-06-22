import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  callUcatAiJson,
  getUcatAiPromptLayers,
  resolveUcatAiConfig,
  UcatAiJsonParseError,
} from '@/features/ucat/shared/server/ucat-ai-client'
import {
  buildWriterPrompt,
  type AiGenerationBrief,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import {
  DifficultyTargetSchema,
  GeneratedCandidateResponseSchema,
  TimeBurdenTargetSchema,
  type GeneratedStem,
} from '@/features/ucat/questions/lib/ai-generation/schema'
import { generatedContentToProseMirror } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import {
  hasBlockingIssues,
  validateGeneratedStemCandidate,
  type GenerationGateIssue,
} from '@/features/ucat/questions/lib/ai-generation/gates'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

const GenerateBodySchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  profileId: z.string().uuid().nullable().optional(),
  sourceMode: z.enum(['none', 'random', 'selected']).default('none'),
  sourceStemIds: z.array(z.string().uuid()).optional(),
  stemCount: z.number().int().min(1).max(50),
  difficultyTarget: DifficultyTargetSchema.default('mixed'),
  timeBurdenTarget: TimeBurdenTargetSchema.default('mixed'),
  targetTagIds: z.array(z.string().uuid()).default([]),
  runInstructions: z.string().trim().max(2000).nullable().optional(),
})

const GENERATION_TOKEN_LIMITS = {
  writer: 3000,
} as const

const GENERATION_TIMEOUT_MS = {
  writer: 75_000,
} as const

type SourceStem = {
  id: string
  stem_text: Json | null
  questions: Array<{
    question_text?: Json | null
    answer_explanation?: Json | null
    question_type?: 'multiple_choice' | 'syllogism'
    tags?: Array<{ id?: string | null; name?: string | null }> | null
    answer_options?: Array<{
      answer_text?: Json | null
      answer_explanation?: Json | null
      is_answer?: boolean
    }>
  }> | null
}

type StemCategoryChoice = {
  id: string
  name: string
}

type GenerationDebugCall = {
  stemIndex: number
  categoryName: string | null
  operation: string
  model: string | null
  durationMs: number
  status: 'ok' | 'error'
  error?: string
  request: {
    systemPrompt: string
    userPrompt: string
    maxCompletionTokens: number
    timeoutMs: number
  }
  response?: {
    content: string
    finishReason: string | null
    usage: unknown
    contentLength: number
  }
  parsedSummary?: {
    stemCount: number
    categories: Array<string | null>
    questionCounts: number[]
  }
}

type GenerationDebugInfo = {
  requestedStemCount: number
  sectionName: string | null
  selectedCategoryName: string | null
  sourceSampleIds: string[]
  promptLayerCount: number
  calls: GenerationDebugCall[]
  gateIssues: GenerationGateIssue[]
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractText(value: Json | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => extractText(item as Json)).filter(Boolean).join(' ').trim()
  const record = value as Record<string, Json>
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.content)) return record.content.map((item) => extractText(item as Json)).filter(Boolean).join(' ').trim()
  return Object.values(record).map((item) => extractText(item)).filter(Boolean).join(' ').trim()
}

function compactStemForPrompt(stem: SourceStem): Record<string, unknown> {
  return {
    id: stem.id,
    stemText: extractText(stem.stem_text).slice(0, 900),
    questions: (stem.questions ?? []).slice(0, 4).map((question) => ({
      questionText: extractText((question.question_text ?? null) as Json).slice(0, 240),
      questionType: question.question_type ?? 'multiple_choice',
      tags: (question.tags ?? []).map((tag) => tag.name).filter(Boolean),
      options: (question.answer_options ?? []).slice(0, 5).map((option) => ({
        answerText: extractText((option.answer_text ?? null) as Json).slice(0, 120),
        isAnswer: !!option.is_answer,
      })),
    })),
  }
}

function buildLocalPlan(brief: AiGenerationBrief): Record<string, unknown> {
  const categories =
    brief.categoryName || !brief.availableCategories?.length
      ? []
      : brief.availableCategories.map((category) => category.name)
  return {
    plans: Array.from({ length: brief.stemCount }, (_, index) => ({
      stemIndex: index,
      candidateIndex: 0,
      categoryName: brief.categoryName ?? categories[index % Math.max(1, categories.length)] ?? null,
      difficultyTarget: brief.difficultyTarget === 'mixed' ? ['easy', 'medium', 'hard'][index % 3] : brief.difficultyTarget,
      timeBurdenTarget: brief.timeBurdenTarget === 'mixed' ? ['low', 'medium', 'high'][index % 3] : brief.timeBurdenTarget,
      notes: 'Create a distinct official-style UCAT item; do not copy source examples.',
    })),
  }
}

function selectCategoryNameForIndex(brief: AiGenerationBrief, index: number): string | null {
  if (brief.categoryName) return brief.categoryName
  const categories = brief.availableCategories ?? []
  if (categories.length === 0) return null
  return categories[index % categories.length]?.name ?? null
}

function briefForSingleStem(brief: AiGenerationBrief, index: number): AiGenerationBrief {
  const categoryName = selectCategoryNameForIndex(brief, index)
  return {
    ...brief,
    categoryName,
    availableCategories: categoryName ? [] : brief.availableCategories,
    stemCount: 1,
    promptLayers: brief.promptLayers.filter((layer) => {
      if (layer.scopeType === 'stem_category') return layer.name === categoryName
      return true
    }),
  }
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await tasks[currentIndex]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

function sourcePlainText(stem: SourceStem): string {
  return [
    extractText(stem.stem_text),
    ...(stem.questions ?? []).flatMap((question) => [
      extractText((question.question_text ?? null) as Json),
      ...(question.answer_options ?? []).map((option) => extractText((option.answer_text ?? null) as Json)),
    ]),
  ]
    .filter(Boolean)
    .join('\n')
}

function difficultyToNumber(value: number | null | undefined, target: string | undefined): number | null {
  if (typeof value === 'number') return value
  if (target === 'easy') return 0.25
  if (target === 'medium') return 0.55
  if (target === 'hard') return 0.82
  return null
}

function issueMessages(issues: GenerationGateIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.questionIndex == null ? issue.message : `Q${issue.questionIndex + 1}: ${issue.message}`)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown generation error'
}

async function fetchSourceStems(
  client: SupabaseClient<Database>,
  body: z.infer<typeof GenerateBodySchema>
): Promise<SourceStem[]> {
  if (body.sourceMode === 'none') return []

  let query = asAny(client)
    .from('vtutor_ucat_question_stem_detail')
    .select('id,stem_text,questions')
    .eq('section_id', body.sectionId)
    .filter('approval_status', 'eq', 'approved')
    .is('deleted_at', null)

  if (body.categoryId) query = query.eq('question_stem_category_id', body.categoryId)

  if (body.sourceMode === 'selected') {
    if (!body.sourceStemIds || body.sourceStemIds.length === 0) {
      throw new Error('Please select at least one source stem, or choose no source examples.')
    }
    query = query.in('id', body.sourceStemIds)
  } else {
    query = query.limit(50)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const source = ((data ?? []) as unknown as SourceStem[]).filter((row) => row.id)
  const sampleSize = Math.min(2, source.length)
  return [...source].sort(() => Math.random() - 0.5).slice(0, sampleSize)
}

async function fetchTargetTags(client: SupabaseClient<Database>, tagIds: string[]) {
  if (tagIds.length === 0) return []
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_tags')
    .select('id,name')
    .in('id', tagIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<{ id: string; name: string | null }>).map((tag) => ({
    id: tag.id,
    name: tag.name ?? 'Untitled tag',
  }))
}

async function fetchSectionCategories(
  client: SupabaseClient<Database>,
  sectionId: string
): Promise<StemCategoryChoice[]> {
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_stem_categories')
    .select('id,name,ucat_section_id')
    .eq('ucat_section_id', sectionId)
    .order('name')
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<{ id: string; name: string | null }>).map((category) => ({
    id: category.id,
    name: category.name ?? 'Untitled category',
  }))
}

async function fetchBankComparisonTexts(client: SupabaseClient<Database>, sectionId: string): Promise<string[]> {
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_stem_detail')
    .select('id,stem_text,questions')
    .eq('section_id', sectionId)
    .filter('approval_status', 'eq', 'approved')
    .is('deleted_at', null)
    .limit(300)
  if (error) return []
  return ((data ?? []) as unknown as SourceStem[]).map(sourcePlainText).filter((text) => text.trim().length > 0)
}

async function buildPromptLayers(params: {
  client: SupabaseClient<Database>
  sectionId: string
  sectionName: string
  categoryId: string | null
  categoryName: string | null
  availableCategories: StemCategoryChoice[]
  tags: Array<{ id: string; name: string }>
}): Promise<AiGenerationBrief['promptLayers']> {
  const layers = await getUcatAiPromptLayers({
    client: params.client,
    sectionId: params.sectionId,
    categoryId: params.categoryId,
    categoryIds: params.categoryId ? [] : params.availableCategories.map((category) => category.id),
    tagIds: params.tags.map((tag) => tag.id),
  })
  return layers.map((layer) => {
    const tag = params.tags.find((item) => item.id === layer.scope_id)
    const category = params.availableCategories.find((item) => item.id === layer.scope_id)
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

function toDraft(params: {
  stem: GeneratedStem
  body: z.infer<typeof GenerateBodySchema>
  warnings: string[]
  sampleStemIds: string[]
  profileId: string | null
  providerId: string | null
  model: string
  metadata: Record<string, unknown>
  categoryIdByName: Map<string, string>
}) {
  const generatedCategoryId =
    params.stem.categoryId ??
    params.body.categoryId ??
    params.categoryIdByName.get(normalizeLabel(params.stem.categoryName)) ??
    null

  return {
    sectionId: params.body.sectionId,
    categoryId: generatedCategoryId,
    stemText: generatedContentToProseMirror(params.stem.stemText),
    isPrivate: true,
    questions: params.stem.questions.map((question, questionIndex) => ({
      index: questionIndex + 1,
      questionText: generatedContentToProseMirror(question.questionText),
      answerExplanation: question.answerExplanation ? generatedContentToProseMirror(question.answerExplanation) : null,
      difficulty: difficultyToNumber(question.estimatedDifficulty, question.difficultyTarget),
      timeBurdenSeconds: question.estimatedTimeBurdenSeconds ?? null,
      questionType: question.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice',
      tagIds: question.tagIds?.length ? question.tagIds : params.body.targetTagIds,
      options: question.options.map((option, optionIndex) => ({
        index: optionIndex + 1,
        answerText: generatedContentToProseMirror(option.answerText),
        answerExplanation: option.answerExplanation ? generatedContentToProseMirror(option.answerExplanation) : null,
        isAnswer: !!option.isAnswer,
      })),
    })),
    aiGenerationMetadata: {
      source: 'ucat-ai-generation',
      generatedAt: new Date().toISOString(),
      sampleStemIds: params.sampleStemIds,
      profileId: params.profileId,
      providerId: params.providerId,
      model: params.model,
      generationBrief: {
        sectionId: params.body.sectionId,
        categoryId: generatedCategoryId,
        requestedCategoryId: params.body.categoryId ?? null,
        generatedCategoryName: params.stem.categoryName ?? null,
        difficultyTarget: params.body.difficultyTarget,
        timeBurdenTarget: params.body.timeBurdenTarget,
        targetTagIds: params.body.targetTagIds,
        runInstructions: params.body.runInstructions ?? null,
      },
      warnings: params.warnings,
      ...params.metadata,
    } as Json,
  }
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
  let debug: GenerationDebugInfo | null = null

  try {
    const config = await resolveUcatAiConfig(client, body.profileId)
    if (body.stemCount > config.settings.max_requested_stems_per_run) {
      return NextResponse.json(
        { error: `Generation runs are capped at ${config.settings.max_requested_stems_per_run} requested stems.` },
        { status: 400 }
      )
    }

    const { data: section, error: sectionError } = await asAny(client)
      .from('vtutor_ucat_sections')
      .select('id,name')
      .eq('id', body.sectionId)
      .maybeSingle()
    const sectionRow = section as { id: string; name: string | null } | null
    if (sectionError || !sectionRow) return NextResponse.json({ error: 'Section not found' }, { status: 400 })

    const categoryChoices = await fetchSectionCategories(client, body.sectionId)
    const categoryIdByName = new Map(categoryChoices.map((category) => [normalizeLabel(category.name), category.id]))

    let categoryName: string | null = null
    if (body.categoryId) {
      const categoryRow = categoryChoices.find((category) => category.id === body.categoryId) ?? null
      if (!categoryRow) {
        return NextResponse.json({ error: 'Invalid category for selected section' }, { status: 400 })
      }
      categoryName = categoryRow.name
    }

    const sourceSamples = await fetchSourceStems(client, body)
    const targetTags = await fetchTargetTags(client, body.targetTagIds)
    const promptLayers = await buildPromptLayers({
      client,
      sectionId: body.sectionId,
      sectionName: sectionRow.name ?? 'UCAT',
      categoryId: body.categoryId ?? null,
      categoryName,
      availableCategories: categoryChoices,
      tags: targetTags,
    })
    const candidateCount = 1
    const examples = sourceSamples.map(compactStemForPrompt)
    const brief: AiGenerationBrief = {
      sectionName: sectionRow.name ?? 'UCAT',
      categoryName,
      availableCategories: body.categoryId ? [] : categoryChoices,
      stemCount: body.stemCount,
      candidateCount,
      difficultyTarget: body.difficultyTarget,
      timeBurdenTarget: body.timeBurdenTarget,
      targetTags,
      runInstructions: body.runInstructions ?? null,
      examples,
      promptLayers,
    }
    debug = {
      requestedStemCount: body.stemCount,
      sectionName: sectionRow.name ?? null,
      selectedCategoryName: categoryName,
      sourceSampleIds: sourceSamples.map((sample) => sample.id),
      promptLayerCount: promptLayers.length,
      calls: [],
      gateIssues: [],
    }
    const activeDebug = debug

    const generatedResults = await runWithConcurrency(
      Array.from({ length: body.stemCount }, (_, stemIndex) => async () => {
        const singleBrief = briefForSingleStem(brief, stemIndex)
        const systemPrompt = `${config.profile.base_system_prompt}\n\n${config.profile.writer_prompt}`
        const userPrompt = buildWriterPrompt({ ...singleBrief, plan: buildLocalPlan(singleBrief) })
        const startedAt = Date.now()
        const baseDebug = {
          stemIndex,
          categoryName: singleBrief.categoryName,
          operation: 'generation_write',
          request: {
            systemPrompt,
            userPrompt,
            maxCompletionTokens: GENERATION_TOKEN_LIMITS.writer,
            timeoutMs: GENERATION_TIMEOUT_MS.writer,
          },
        }

        let writer
        try {
          writer = await callUcatAiJson({
            client,
            operation: 'generation_write',
            profileId: body.profileId,
            systemPrompt,
            userPrompt,
            temperature: Number(config.profile.temperature),
            maxCompletionTokens: GENERATION_TOKEN_LIMITS.writer,
            timeoutMs: GENERATION_TIMEOUT_MS.writer,
            metadata: { section: singleBrief.sectionName, category: singleBrief.categoryName } as Json,
          })
        } catch (error) {
          activeDebug.calls.push({
            ...baseDebug,
            model: error instanceof UcatAiJsonParseError ? error.model : config.profile.model,
            durationMs: Date.now() - startedAt,
            status: 'error',
            error: errorMessage(error),
            response:
              error instanceof UcatAiJsonParseError
                ? {
                    content: error.content,
                    finishReason: error.finishReason,
                    usage: error.usage,
                    contentLength: error.content.length,
                  }
                : undefined,
          })
          throw error
        }

        const parsedWriter = GeneratedCandidateResponseSchema.safeParse(writer.parsed)
        activeDebug.calls.push({
          ...baseDebug,
          model: writer.model,
          durationMs: Date.now() - startedAt,
          status: parsedWriter.success ? 'ok' : 'error',
          error: parsedWriter.success ? undefined : 'Generated JSON did not match the expected stem schema.',
          response: {
            content: writer.content,
            finishReason: writer.finishReason,
            usage: writer.usage,
            contentLength: writer.content.length,
          },
          parsedSummary: parsedWriter.success
            ? {
                stemCount: parsedWriter.data.stems.length,
                categories: parsedWriter.data.stems.map((stem) => stem.categoryName ?? null),
                questionCounts: parsedWriter.data.stems.map((stem) => stem.questions.length),
              }
            : undefined,
        })
        if (!parsedWriter.success) {
          throw new Error(`AI generation output schema mismatch for stem ${stemIndex + 1}`)
        }
        return parsedWriter.data.stems[0] ?? null
      }),
      2
    )
    const generatedStems = generatedResults.filter((stem): stem is GeneratedStem => !!stem)

    const sourcePlainTexts = [...sourceSamples.map(sourcePlainText), ...(await fetchBankComparisonTexts(client, body.sectionId))]
    const accepted: Array<{ stem: GeneratedStem; issues: GenerationGateIssue[]; rewritten: boolean }> = []
    const discarded: Array<{ issues: GenerationGateIssue[]; rewritten: boolean }> = []

    for (const [candidateIndex, candidate] of generatedStems.entries()) {
      const issues = validateGeneratedStemCandidate(candidate, candidateIndex, {
        sectionName: brief.sectionName,
        categoryName,
        sourcePlainTexts,
      })

      activeDebug.gateIssues.push(...issues)

      if (hasBlockingIssues(issues)) discarded.push({ issues, rewritten: false })
      else accepted.push({ stem: candidate, issues, rewritten: false })
      if (accepted.length >= body.stemCount) break
    }

    if (accepted.length === 0) {
      const issues = discarded.flatMap((item) => item.issues).slice(0, 10)
      return NextResponse.json(
        {
          error: issues[0]?.message ?? 'No generated candidates passed blocking gates.',
          discardedCount: discarded.length,
          issues,
          debug,
        },
        { status: 422 }
      )
    }

    const stems = accepted.slice(0, body.stemCount).map((item, outputIndex) =>
      toDraft({
        stem: item.stem,
        body,
        warnings: issueMessages(item.issues),
        sampleStemIds: sourceSamples.map((sample) => sample.id),
        profileId: config.profile.id,
        providerId: config.provider.id,
        model: config.profile.model,
        metadata: {
          outputIndex,
          requestedStemCount: body.stemCount,
          candidatesPerStem: candidateCount,
          discardedCount: discarded.length,
          rewritten: item.rewritten,
          gateIssues: item.issues,
          profileVersion: config.profile.profile_version,
        },
        categoryIdByName,
      })
    )

    return NextResponse.json({ stems, discardedCount: discarded.length, debug })
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), debug },
      { status: 500 }
    )
  }
}
