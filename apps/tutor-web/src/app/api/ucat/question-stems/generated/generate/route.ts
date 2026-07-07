import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  callUcatAiJson,
  getUcatAiPromptLayers,
  resolveUcatAiConfig,
  UcatAiEmptyResponseError,
  UcatAiJsonParseError,
} from '@/features/ucat/shared/server/ucat-ai-client'
import {
  buildWriterPrompt,
  type AiGenerationBrief,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import {
  buildLocalPlan,
  correctAnswerPattern,
} from '@/features/ucat/questions/lib/ai-generation/local-plan'
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
  modelProfileId: z.string().uuid().nullable().optional(),
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
  question_stem_category_id?: string | null
  category_name?: string | null
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
    providerSort: 'throughput'
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
  runId?: string | null
  requestedStemCount: number
  sectionName: string | null
  selectedCategoryName: string | null
  sourceSampleIds: string[]
  promptLayerCount: number
  calls: GenerationDebugCall[]
  gateIssues: GenerationGateIssue[]
}

type GenerateBody = z.infer<typeof GenerateBodySchema>

type GenerationProgressEvent = {
  type: 'progress'
  step: 'setup' | 'sources' | 'generating' | 'gates' | 'drafts'
  message: string
  completedStems?: number
  totalStems?: number
  runId?: string | null
}

type EmitProgress = (event: GenerationProgressEvent) => void

type GenerationResult = {
  status: number
  payload: Record<string, unknown>
}

type GenerationActor = {
  userId: string | null
  name: string | null
  email: string | null
}

function generationActorFromUser(user: unknown): GenerationActor {
  if (!user || typeof user !== 'object') {
    return { userId: null, name: null, email: null }
  }
  const record = user as {
    id?: unknown
    email?: unknown
    user_metadata?: Record<string, unknown> | null
  }
  const metadata = record.user_metadata ?? {}
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : ''
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : ''
  const metadataName =
    typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name
      : typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name
        : [firstName, lastName].filter(Boolean).join(' ')

  return {
    userId: typeof record.id === 'string' ? record.id : null,
    name: metadataName.trim() || null,
    email: typeof record.email === 'string' ? record.email : null,
  }
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
    categoryName: stem.category_name ?? null,
    stemText: extractText(stem.stem_text).slice(0, 2400),
    questions: (stem.questions ?? []).slice(0, 4).map((question) => ({
      questionText: extractText((question.question_text ?? null) as Json).slice(0, 220),
      questionType: question.question_type ?? 'multiple_choice',
      answerExplanation: extractText((question.answer_explanation ?? null) as Json).slice(0, 700),
      tags: (question.tags ?? []).map((tag) => tag.name).filter(Boolean),
      options: (question.answer_options ?? []).slice(0, 5).map((option) => ({
        answerText: extractText((option.answer_text ?? null) as Json).slice(0, 100),
        ...(question.question_type === 'syllogism'
          ? { answerExplanation: extractText((option.answer_explanation ?? null) as Json).slice(0, 240) }
          : {}),
        isAnswer: !!option.is_answer,
      })),
    })),
  }
}

function normalizeVrParagraphs(stem: GeneratedStem, sectionName: string): GeneratedStem {
  if (sectionName !== 'Verbal Reasoning') return stem

  const existingParagraphs =
    typeof stem.stemText === 'string'
      ? stem.stemText
          .split(/\n{2,}|\r?\n/u)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      : stem.stemText
          .filter((block) => block.type === 'paragraph')
          .map((block) => block.type === 'paragraph' ? block.text.trim() : '')
          .filter(Boolean)
  if (existingParagraphs.length >= 2 && existingParagraphs.length <= 6) return stem
  if (existingParagraphs.length !== 1) return stem

  const sentences = existingParagraphs[0]
    .match(/[^.!?]+(?:[.!?]+["')\]]*|$)/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? []
  if (sentences.length < 4) return stem

  const targetParagraphCount = sentences.length >= 9 ? 3 : 2
  const paragraphSize = Math.ceil(sentences.length / targetParagraphCount)
  const paragraphs = Array.from({ length: targetParagraphCount }, (_, index) =>
    sentences.slice(index * paragraphSize, (index + 1) * paragraphSize).join(' ')
  ).filter(Boolean)

  return {
    ...stem,
    stemText: paragraphs.map((text) => ({ type: 'paragraph' as const, text })),
    warnings: [...stem.warnings, 'Passage paragraph breaks were normalized after generation.'],
  }
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

function selectCategoryNameForIndex(brief: AiGenerationBrief, index: number): string | null {
  if (brief.categoryName) return brief.categoryName
  const categories = brief.availableCategories ?? []
  if (categories.length === 0) return null
  return categories[index % categories.length]?.name ?? null
}

function briefForSingleStem(brief: AiGenerationBrief, index: number): AiGenerationBrief {
  const categoryName = selectCategoryNameForIndex(brief, index)
  const matchingExamples = brief.examples.filter((example) => {
    if (example.categoryName !== categoryName) return false
    if (normalizeLabel(categoryName) !== 'logical puzzles') return true
    const text = JSON.stringify(example).toLowerCase()
    return !/(?:probability|chance|likelihood|\d+%)/u.test(text)
  })
  const exampleStart = matchingExamples.length > 0 ? (index * 2) % matchingExamples.length : 0
  const examples = Array.from(
    { length: Math.min(2, matchingExamples.length) },
    (_, offset) => matchingExamples[(exampleStart + offset) % matchingExamples.length]
  ).filter((example): example is Record<string, unknown> => !!example)
  return {
    ...brief,
    categoryName,
    availableCategories: categoryName ? [] : brief.availableCategories,
    stemCount: 1,
    examples,
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

function isCapturedAiResponseError(
  error: unknown
): error is UcatAiJsonParseError | UcatAiEmptyResponseError {
  return error instanceof UcatAiJsonParseError || error instanceof UcatAiEmptyResponseError
}

async function currentTutorId(client: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await asAny(client).rpc('current_tutor_id')
  if (error || typeof data !== 'string') return null
  return data
}

async function createGenerationRun(params: {
  client: SupabaseClient<Database>
  body: GenerateBody
  modelProfileId: string | null
}): Promise<string | null> {
  const staffId = await currentTutorId(params.client)
  if (!staffId) return null

  const { data, error } = await asAny(params.client)
    .from('ucat_ai_generation_runs')
    .insert({
      section_id: params.body.sectionId,
      question_stem_category_id: params.body.categoryId ?? null,
      model_profile_id: params.modelProfileId,
      status: 'running',
      requested_stem_count: params.body.stemCount,
      created_by: staffId,
      updated_by: staffId,
    })
    .select('id')
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id as string
}

async function updateGenerationRun(params: {
  client: SupabaseClient<Database>
  runId: string | null | undefined
  status: 'completed' | 'failed'
  acceptedStemCount?: number
  discardedStemCount?: number
  errorMessage?: string | null
  debug: GenerationDebugInfo | null
}) {
  if (!params.runId) return
  const staffId = await currentTutorId(params.client)
  const payload: Record<string, unknown> = {
    status: params.status,
    accepted_stem_count: params.acceptedStemCount ?? 0,
    discarded_stem_count: params.discardedStemCount ?? 0,
    error_message: params.errorMessage ?? null,
    debug_payload: params.debug ?? null,
  }
  if (staffId) payload.updated_by = staffId

  await asAny(params.client)
    .from('ucat_ai_generation_runs')
    .update(payload)
    .eq('id', params.runId)
}

async function fetchSourceStems(
  client: SupabaseClient<Database>,
  body: z.infer<typeof GenerateBodySchema>
): Promise<SourceStem[]> {
  if (body.sourceMode === 'none') return []

  let query = asAny(client)
    .from('vtutor_ucat_question_stem_detail')
    .select('id,question_stem_category_id,category_name,stem_text,questions')
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
  const shuffled = [...source].sort(() => Math.random() - 0.5)
  if (body.sourceMode === 'selected') return shuffled.slice(0, 4)

  const samplesByCategory = new Map<string, SourceStem[]>()
  for (const stem of shuffled) {
    const key = stem.category_name ?? stem.question_stem_category_id ?? 'uncategorized'
    const samples = samplesByCategory.get(key) ?? []
    if (samples.length < 6) samples.push(stem)
    samplesByCategory.set(key, samples)
  }
  return Array.from(samplesByCategory.values()).flat()
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
  modelProfileId: string | null
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
      modelProfileId: params.modelProfileId,
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
      warnings: [...params.stem.warnings, ...params.warnings],
      ...params.metadata,
    } as Json,
  }
}

async function executeGeneration(
  client: SupabaseClient<Database>,
  body: GenerateBody,
  emitProgress: EmitProgress = () => undefined,
  actor: GenerationActor = { userId: null, name: null, email: null }
): Promise<GenerationResult> {
  let debug: GenerationDebugInfo | null = null

  try {
    emitProgress({
      type: 'progress',
      step: 'setup',
      message: 'Loading model profile and generation settings',
      completedStems: 0,
      totalStems: body.stemCount,
    })
    const config = await resolveUcatAiConfig(client, body.modelProfileId)
    const runId = await createGenerationRun({
      client,
      body,
      modelProfileId: config.modelProfile.id,
    })
    emitProgress({
      type: 'progress',
      step: 'setup',
      message: runId ? 'Generation run created' : 'Generation run started',
      completedStems: 0,
      totalStems: body.stemCount,
      runId,
    })

    if (body.stemCount > config.settings.max_requested_stems_per_run) {
      const message = `Generation runs are capped at ${config.settings.max_requested_stems_per_run} requested stems.`
      await updateGenerationRun({
        client,
        runId,
        status: 'failed',
        errorMessage: message,
        debug,
      })
      return { status: 400, payload: { error: message, debugRunId: runId } }
    }

    const { data: section, error: sectionError } = await asAny(client)
      .from('vtutor_ucat_sections')
      .select('id,name')
      .eq('id', body.sectionId)
      .maybeSingle()
    const sectionRow = section as { id: string; name: string | null } | null
    if (sectionError || !sectionRow) {
      await updateGenerationRun({
        client,
        runId,
        status: 'failed',
        errorMessage: 'Section not found',
        debug,
      })
      return { status: 400, payload: { error: 'Section not found', debugRunId: runId } }
    }

    const categoryChoices = await fetchSectionCategories(client, body.sectionId)
    const categoryIdByName = new Map(categoryChoices.map((category) => [normalizeLabel(category.name), category.id]))

    let categoryName: string | null = null
    if (body.categoryId) {
      const categoryRow = categoryChoices.find((category) => category.id === body.categoryId) ?? null
      if (!categoryRow) {
        await updateGenerationRun({
          client,
          runId,
          status: 'failed',
          errorMessage: 'Invalid category for selected section',
          debug,
        })
        return { status: 400, payload: { error: 'Invalid category for selected section', debugRunId: runId } }
      }
      categoryName = categoryRow.name
    }

    emitProgress({
      type: 'progress',
      step: 'sources',
      message: 'Selecting source examples and prompt layers',
      completedStems: 0,
      totalStems: body.stemCount,
      runId,
    })
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
    const examples = sourceSamples.map(compactStemForPrompt)
    const brief: AiGenerationBrief = {
      sectionName: sectionRow.name ?? 'UCAT',
      categoryName,
      availableCategories: body.categoryId ? [] : categoryChoices,
      stemCount: body.stemCount,
      difficultyTarget: body.difficultyTarget,
      timeBurdenTarget: body.timeBurdenTarget,
      targetTags,
      runInstructions: body.runInstructions ?? null,
      examples,
      promptLayers,
    }
    debug = {
      runId,
      requestedStemCount: body.stemCount,
      sectionName: sectionRow.name ?? null,
      selectedCategoryName: categoryName,
      sourceSampleIds: sourceSamples.map((sample) => sample.id),
      promptLayerCount: promptLayers.length,
      calls: [],
      gateIssues: [],
    }
    const activeDebug = debug

    let completedStemCalls = 0
    emitProgress({
      type: 'progress',
      step: 'generating',
      message: `Generating ${body.stemCount} stem${body.stemCount === 1 ? '' : 's'} in parallel`,
      completedStems: completedStemCalls,
      totalStems: body.stemCount,
      runId,
    })

    const generatedResults = await runWithConcurrency(
      Array.from({ length: body.stemCount }, (_, stemIndex) => async () => {
        const singleBrief = briefForSingleStem(brief, stemIndex)
        const systemPrompt = `${config.systemPrompts.base_system_prompt}\n\n${config.systemPrompts.writer_prompt}`
        const userPrompt = buildWriterPrompt({ ...singleBrief, plan: buildLocalPlan(singleBrief, stemIndex) })
        const sectionMinimumTokens = singleBrief.sectionName === 'Decision Making'
          ? 10_000
          : GENERATION_TOKEN_LIMITS.writer
        const maxCompletionTokens = Math.max(
          sectionMinimumTokens,
          config.modelProfile.max_completion_tokens
        )
        const startedAt = Date.now()
        const baseDebug = {
          stemIndex,
          categoryName: singleBrief.categoryName,
          operation: 'generation_write',
          request: {
            systemPrompt,
            userPrompt,
            maxCompletionTokens,
            timeoutMs: GENERATION_TIMEOUT_MS.writer,
            providerSort: 'throughput' as const,
          },
        }

        let writer
        try {
          writer = await callUcatAiJson({
            client,
            operation: 'generation_write',
            modelProfileId: body.modelProfileId,
            systemPrompt,
            userPrompt,
            temperature: Number(config.modelProfile.temperature),
            maxCompletionTokens,
            timeoutMs: GENERATION_TIMEOUT_MS.writer,
            providerSort: 'throughput',
            metadata: { section: singleBrief.sectionName, category: singleBrief.categoryName } as Json,
          })
        } catch (error) {
          activeDebug.calls.push({
            ...baseDebug,
            model: isCapturedAiResponseError(error) ? error.model : config.modelProfile.model,
            durationMs: Date.now() - startedAt,
            status: 'error',
            error: errorMessage(error),
            response:
              isCapturedAiResponseError(error)
                ? {
                    content: error.content,
                    finishReason: error.finishReason,
                    usage: error.usage,
                    contentLength: error.content.length,
                  }
                : undefined,
          })
          completedStemCalls += 1
          emitProgress({
            type: 'progress',
            step: 'generating',
            message: `Stem ${stemIndex + 1} failed during model generation`,
            completedStems: completedStemCalls,
            totalStems: body.stemCount,
            runId,
          })
          return null
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
        completedStemCalls += 1
        emitProgress({
          type: 'progress',
          step: 'generating',
          message: parsedWriter.success
            ? `Stem ${stemIndex + 1} returned and matched the schema`
            : `Stem ${stemIndex + 1} returned but did not match the schema`,
          completedStems: completedStemCalls,
          totalStems: body.stemCount,
          runId,
        })
        if (!parsedWriter.success) {
          return null
        }
        const stem = parsedWriter.data.stems[0] ?? null
        if (!stem) return null
        return normalizePlannedAnswerPositions(
          normalizeVrParagraphs(stem, singleBrief.sectionName),
          stemIndex
        )
      }),
      body.stemCount
    )
    const generatedStems = generatedResults.filter((stem): stem is GeneratedStem => !!stem)
    const failedCallCount = activeDebug.calls.filter((call) => call.status === 'error').length

    emitProgress({
      type: 'progress',
      step: 'gates',
      message: 'Running deterministic quality and structure gates',
      completedStems: generatedStems.length,
      totalStems: body.stemCount,
      runId,
    })
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
      const firstCallError = activeDebug.calls.find((call) => call.status === 'error')?.error
      const message = issues[0]?.message ?? firstCallError ?? 'No generated candidates passed blocking gates.'
      await updateGenerationRun({
        client,
        runId,
        status: 'failed',
        discardedStemCount: discarded.length + failedCallCount,
        errorMessage: message,
        debug,
      })
      return {
        status: 422,
        payload: {
          error: message,
          discardedCount: discarded.length + failedCallCount,
          issues,
          debug,
          debugRunId: runId,
        },
      }
    }

    emitProgress({
      type: 'progress',
      step: 'drafts',
      message: 'Preparing accepted stems for tutor review',
      completedStems: accepted.length,
      totalStems: body.stemCount,
      runId,
    })
    const stems = accepted.slice(0, body.stemCount).map((item, outputIndex) =>
      toDraft({
        stem: item.stem,
        body,
        warnings: issueMessages(item.issues),
        sampleStemIds: sourceSamples.map((sample) => sample.id),
        modelProfileId: config.modelProfile.id,
        providerId: config.provider.id,
        model: config.modelProfile.model,
        metadata: {
          outputIndex,
          debugRunId: runId,
          requestedStemCount: body.stemCount,
          discardedCount: discarded.length + failedCallCount,
          rewritten: item.rewritten,
          gateIssues: item.issues,
          systemPromptVersion: config.systemPrompts.prompt_version,
          generatedByUserId: actor.userId,
          generatedByName: actor.name,
          generatedByEmail: actor.email,
        },
        categoryIdByName,
      })
    )

    await updateGenerationRun({
      client,
      runId,
      status: 'completed',
      acceptedStemCount: stems.length,
      discardedStemCount: discarded.length + failedCallCount,
      debug,
    })
    return { status: 200, payload: { stems, discardedCount: discarded.length + failedCallCount, debug, debugRunId: runId } }
  } catch (error) {
    await updateGenerationRun({
      client,
      runId: debug?.runId,
      status: 'failed',
      errorMessage: errorMessage(error),
      debug,
    })
    return { status: 500, payload: { error: errorMessage(error), debug, debugRunId: debug?.runId ?? null } }
  }
}

function streamGenerationResponse(
  client: SupabaseClient<Database>,
  body: GenerateBody,
  actor: GenerationActor
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      void executeGeneration(client, body, emit, actor).then((result) => {
        emit({ type: result.status >= 400 ? 'error' : 'complete', status: result.status, ...result.payload })
        controller.close()
      }).catch((error) => {
        emit({ type: 'error', status: 500, error: errorMessage(error) })
        controller.close()
      })
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: GenerateBody
  try {
    body = GenerateBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid generation payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const client = access.userClient as unknown as SupabaseClient<Database>
  const userResult = await client.auth.getUser().catch(() => null)
  const actor = generationActorFromUser(userResult?.data?.user ?? null)
  if (request.headers.get('accept')?.includes('application/x-ndjson')) {
    return streamGenerationResponse(client, body, actor)
  }

  const result = await executeGeneration(client, body, undefined, actor)
  return NextResponse.json(result.payload, { status: result.status })
}
