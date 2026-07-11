import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'
import type { Json } from '@altitutor/shared'
import { getServiceRoleClient } from '../src/shared/lib/supabase/service-role'
import {
  callUcatAiJson,
  getUcatAiPromptLayers,
  resolveUcatAiConfig,
} from '../src/features/ucat/shared/server/ucat-ai-client'
import { buildLocalPlan } from '../src/features/ucat/questions/lib/ai-generation/local-plan'
import {
  buildWriterPrompt,
  type AiGenerationBrief,
} from '../src/features/ucat/questions/lib/ai-generation/prompts'
import {
  GeneratedCandidateResponseSchema,
  type GeneratedStem,
} from '../src/features/ucat/questions/lib/ai-generation/schema'
import {
  validateGeneratedStemCandidate,
} from '../src/features/ucat/questions/lib/ai-generation/gates'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

type SourceStem = {
  id: string
  category_name?: string | null
  stem_text: Json | null
  questions: Array<{
    question_text?: Json | null
    answer_explanation?: Json | null
    question_type?: 'multiple_choice' | 'syllogism'
    tags?: Array<{ name?: string | null }> | null
    answer_options?: Array<{
      answer_text?: Json | null
      answer_explanation?: Json | null
      is_answer?: boolean
    }>
  }> | null
}

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index >= 0 ? process.argv[index + 1] : null
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

function optionalArg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? null : null
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

function compactStem(stem: SourceStem): Record<string, unknown> {
  return {
    id: stem.id,
    categoryName: stem.category_name ?? null,
    stemText: extractText(stem.stem_text).slice(0, 2400),
    questions: (stem.questions ?? []).slice(0, 4).map((question) => ({
      questionText: extractText(question.question_text).slice(0, 220),
      questionType: question.question_type ?? 'multiple_choice',
      answerExplanation: extractText(question.answer_explanation).slice(0, 700),
      tags: (question.tags ?? []).map((tag) => tag.name).filter(Boolean),
      options: (question.answer_options ?? []).slice(0, 5).map((option) => ({
        answerText: extractText(option.answer_text).slice(0, 100),
        ...(question.question_type === 'syllogism'
          ? { answerExplanation: extractText(option.answer_explanation).slice(0, 240) }
          : {}),
        isAnswer: !!option.is_answer,
      })),
    })),
  }
}

function sourceText(stem: SourceStem): string {
  return [
    extractText(stem.stem_text),
    ...(stem.questions ?? []).flatMap((question) => [
      extractText(question.question_text),
      ...(question.answer_options ?? []).map((option) => extractText(option.answer_text)),
    ]),
  ].filter(Boolean).join('\n')
}

function assetSummary(stem: GeneratedStem) {
  const values: unknown[] = [
    stem.stemText,
    ...stem.questions.flatMap((question) => [
      question.questionText,
      question.answerExplanation,
      ...question.options.flatMap((option) => [option.answerText, option.answerExplanation]),
    ]),
  ]
  const blocks = values.flatMap((value) => Array.isArray(value) ? value : [])
  return {
    tables: blocks.filter((block) => block && typeof block === 'object' && 'type' in block && block.type === 'table').length,
    visuals: blocks
      .filter((block) => block && typeof block === 'object' && 'type' in block && block.type === 'visual')
      .map((block) => block && typeof block === 'object' && 'visualType' in block ? String(block.visualType) : 'unknown'),
  }
}

async function main() {
  const sectionName = arg('section')
  const categoryName = arg('category')
  const modelProfileName = arg('model')
  const outputPath = optionalArg('output') ?? process.env.UCAT_BENCHMARK_OUTPUT ?? '/tmp/ucat-generation-benchmark.jsonl'
  const client = getServiceRoleClient()

  const { data: section, error: sectionError } = await client
    .from('ucat_sections')
    .select('id,name')
    .eq('name', sectionName)
    .maybeSingle()
  if (sectionError) throw new Error(`Unable to load section: ${sectionError.message}`)
  if (!section) {
    const { data: availableSections } = await client.from('ucat_sections').select('id,name').limit(20)
    throw new Error(`Section not found: ${sectionName}. Available: ${JSON.stringify(availableSections)}`)
  }
  if (!section.id) throw new Error(`Section has no id: ${sectionName}`)
  const sectionId = section.id

  const { data: category, error: categoryError } = await client
    .from('question_stem_categories')
    .select('id,name,ucat_section_id')
    .eq('ucat_section_id', sectionId)
    .eq('name', categoryName)
    .maybeSingle()
  if (categoryError || !category) throw new Error(`Category not found: ${categoryName}`)
  if (!category.id) throw new Error(`Category has no id: ${categoryName}`)
  const categoryId = category.id

  const { data: profile, error: profileError } = await client
    .from('ucat_ai_generation_model_profiles')
    .select('id,name')
    .eq('name', modelProfileName)
    .eq('is_enabled', true)
    .maybeSingle()
  if (profileError || !profile) throw new Error(`Model profile not found: ${modelProfileName}`)

  const { data: sourceData, error: sourceError } = await client
    .from('question_stems')
    .select('id,stem_text')
    .eq('section_id', sectionId)
    .eq('question_stem_category_id', categoryId)
    .eq('approval_status', 'approved')
    .is('deleted_at', null)
    .limit(12)
  if (sourceError) throw sourceError

  const sourceIds = (sourceData ?? []).map((source) => source.id)
  const { data: questionData, error: questionError } = sourceIds.length > 0
    ? await client
        .from('ucat_questions')
        .select('id,question_stem_id,question_text,answer_explanation,question_type,index')
        .in('question_stem_id', sourceIds)
        .is('deleted_at', null)
        .order('index')
    : { data: [], error: null }
  if (questionError) throw questionError

  const questionIds = (questionData ?? []).map((question) => question.id)
  const { data: optionData, error: optionError } = questionIds.length > 0
    ? await client
        .from('question_answer_options')
        .select('question_id,answer_text,answer_explanation,is_answer,index')
        .in('question_id', questionIds)
        .is('deleted_at', null)
        .order('index')
    : { data: [], error: null }
  if (optionError) throw optionError

  let sources: SourceStem[] = (sourceData ?? []).map((source) => ({
    id: source.id,
    category_name: categoryName,
    stem_text: source.stem_text,
    questions: (questionData ?? [])
      .filter((question) => question.question_stem_id === source.id)
      .map((question) => ({
        question_text: question.question_text,
        answer_explanation: question.answer_explanation,
        question_type: question.question_type,
        answer_options: (optionData ?? [])
          .filter((option) => option.question_id === question.id)
          .map((option) => ({
            answer_text: option.answer_text,
            answer_explanation: option.answer_explanation,
            is_answer: option.is_answer,
          })),
      })),
  }))
  if (categoryName === 'Logical Puzzles') {
    sources = sources.filter((source) => !/(?:probability|chance|likelihood|\d+%)/iu.test(sourceText(source)))
  }
  sources = sources.slice(0, 2)

  const layers = await getUcatAiPromptLayers({
    client,
    sectionId,
    categoryId,
  })
  const brief: AiGenerationBrief = {
    sectionName,
    categoryName,
    availableCategories: [],
    stemCount: 1,
    difficultyTarget: 'mixed',
    timeBurdenTarget: 'mixed',
    targetTags: [],
    runInstructions: 'Benchmark run. Produce a near-publishable tutor-review draft.',
    examples: sources.map(compactStem),
    promptLayers: layers.map((layer) => ({
      scopeType: layer.scope_type,
      name: layer.scope_type === 'section' ? sectionName : categoryName,
      promptText: layer.prompt_text,
      version: layer.prompt_version,
    })),
  }

  const config = await resolveUcatAiConfig(client, profile.id)
  const systemPrompt = `${config.systemPrompts.base_system_prompt}\n\n${config.systemPrompts.writer_prompt}`
  const userPrompt = buildWriterPrompt({ ...brief, plan: buildLocalPlan(brief, 0) })
  const startedAt = Date.now()
  let record: Record<string, unknown>

  try {
    const result = await callUcatAiJson({
      client,
      operation: 'generation_benchmark',
      modelProfileId: profile.id,
      systemPrompt,
      userPrompt,
      temperature: Number(config.modelProfile.temperature),
      maxCompletionTokens: Math.max(3000, config.modelProfile.max_completion_tokens),
      timeoutMs: 120_000,
      providerSort: 'throughput',
      metadata: { benchmark: true, section: sectionName, category: categoryName } as Json,
    })
    const parsed = GeneratedCandidateResponseSchema.safeParse(result.parsed)
    const stem = parsed.success ? parsed.data.stems[0] : null
    const issues = stem
      ? validateGeneratedStemCandidate(stem, 0, {
          sectionName,
          categoryName,
          sourceComparisonSources: sources.map((source) => ({
            id: source.id,
            text: sourceText(source),
          })),
        })
      : []
    record = {
      timestamp: new Date().toISOString(),
      sectionName,
      categoryName,
      modelProfileName,
      model: result.model,
      durationMs: Date.now() - startedAt,
      finishReason: result.finishReason,
      usage: result.usage,
      schemaValid: parsed.success,
      schemaError: parsed.success ? null : parsed.error.flatten(),
      gateIssues: issues,
      assetSummary: stem ? assetSummary(stem) : null,
      systemPrompt,
      userPrompt,
      rawResponse: result.content,
      parsedResponse: parsed.success ? parsed.data : result.parsed,
    }
  } catch (error) {
    record = {
      timestamp: new Date().toISOString(),
      sectionName,
      categoryName,
      modelProfileName,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      rawResponse: error && typeof error === 'object' && 'content' in error ? error.content : null,
    }
  }

  await appendFile(outputPath, `${JSON.stringify(record)}\n`, 'utf8')
  const usage = record.usage as Record<string, unknown> | undefined
  console.log(JSON.stringify({
    sectionName,
    categoryName,
    modelProfileName,
    durationMs: record.durationMs,
    schemaValid: record.schemaValid ?? false,
    gateIssues: record.gateIssues ?? [],
    assetSummary: record.assetSummary ?? null,
    totalTokens: usage?.total_tokens ?? null,
    cost: usage?.cost ?? null,
    error: record.error ?? null,
    outputPath,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
