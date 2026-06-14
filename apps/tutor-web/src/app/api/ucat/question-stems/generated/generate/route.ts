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
  buildCriticPrompt,
  buildPlanningPrompt,
  buildRewriterPrompt,
  buildWriterPrompt,
  type AiGenerationBrief,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import {
  CriticResponseSchema,
  DifficultyTargetSchema,
  GeneratedCandidateResponseSchema,
  TimeBurdenTargetSchema,
  type CriticIssue,
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

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
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
    stemText: extractText(stem.stem_text).slice(0, 2200),
    questions: (stem.questions ?? []).slice(0, 6).map((question) => ({
      questionText: extractText((question.question_text ?? null) as Json).slice(0, 900),
      questionType: question.question_type ?? 'multiple_choice',
      answerExplanation: extractText((question.answer_explanation ?? null) as Json).slice(0, 600),
      tags: (question.tags ?? []).map((tag) => tag.name).filter(Boolean),
      options: (question.answer_options ?? []).slice(0, 6).map((option) => ({
        answerText: extractText((option.answer_text ?? null) as Json).slice(0, 300),
        answerExplanation: extractText((option.answer_explanation ?? null) as Json).slice(0, 300),
        isAnswer: !!option.is_answer,
      })),
    })),
  }
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

function criticIssuesToGateIssues(issues: CriticIssue[]): GenerationGateIssue[] {
  return issues.map((issue) => ({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    stemIndex: issue.stemIndex ?? 0,
    questionIndex: issue.questionIndex ?? undefined,
  }))
}

function issueMessages(issues: GenerationGateIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.questionIndex == null ? issue.message : `Q${issue.questionIndex + 1}: ${issue.message}`)
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
  const sampleSize = Math.min(6, source.length)
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
  tags: Array<{ id: string; name: string }>
}): Promise<AiGenerationBrief['promptLayers']> {
  const layers = await getUcatAiPromptLayers({
    client: params.client,
    sectionId: params.sectionId,
    categoryId: params.categoryId,
    tagIds: params.tags.map((tag) => tag.id),
  })
  return layers.map((layer) => {
    const tag = params.tags.find((item) => item.id === layer.scope_id)
    return {
      scopeType: layer.scope_type,
      name:
        layer.scope_type === 'section'
          ? params.sectionName
          : layer.scope_type === 'stem_category'
            ? params.categoryName ?? 'Selected category'
            : tag?.name ?? 'Selected tag',
      promptText: layer.prompt_text,
      version: layer.prompt_version,
    }
  })
}

async function criticPass(params: {
  client: SupabaseClient<Database>
  profileId?: string | null
  systemPrompt: string
  brief: AiGenerationBrief
  candidates: GeneratedStem[]
}): Promise<GenerationGateIssue[]> {
  const result = await callUcatAiJson({
    client: params.client,
    operation: 'generation_critic',
    profileId: params.profileId,
    systemPrompt: params.systemPrompt,
    userPrompt: buildCriticPrompt({ ...params.brief, candidates: params.candidates }),
    temperature: 0.1,
    metadata: { section: params.brief.sectionName, category: params.brief.categoryName } as Json,
  })
  const parsed = CriticResponseSchema.safeParse(result.parsed)
  if (!parsed.success) {
    return [
      {
        severity: 'warning',
        code: 'critic_schema_mismatch',
        message: 'AI critic output could not be parsed; deterministic gates still passed.',
        stemIndex: 0,
      },
    ]
  }
  return criticIssuesToGateIssues(parsed.data.issues)
}

async function rewriteCandidate(params: {
  client: SupabaseClient<Database>
  profileId?: string | null
  systemPrompt: string
  brief: AiGenerationBrief
  candidate: GeneratedStem
  issues: GenerationGateIssue[]
}): Promise<GeneratedStem | null> {
  const result = await callUcatAiJson({
    client: params.client,
    operation: 'generation_rewrite',
    profileId: params.profileId,
    systemPrompt: params.systemPrompt,
    userPrompt: buildRewriterPrompt({ ...params.brief, candidate: params.candidate, issues: params.issues }),
    temperature: 0.3,
    metadata: { section: params.brief.sectionName, category: params.brief.categoryName } as Json,
  })
  const parsed = GeneratedCandidateResponseSchema.safeParse(result.parsed)
  if (!parsed.success) return null
  return parsed.data.stems[0] ?? null
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
}) {
  return {
    sectionId: params.body.sectionId,
    categoryId: params.stem.categoryId ?? params.body.categoryId ?? null,
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
        categoryId: params.body.categoryId ?? null,
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

    let categoryName: string | null = null
    if (body.categoryId) {
      const { data: category, error: categoryError } = await asAny(client)
        .from('vtutor_ucat_question_stem_categories')
        .select('id,name,ucat_section_id')
        .eq('id', body.categoryId)
        .maybeSingle()
      const categoryRow = category as { id: string; name: string | null; ucat_section_id: string | null } | null
      if (categoryError || !categoryRow || categoryRow.ucat_section_id !== body.sectionId) {
        return NextResponse.json({ error: 'Invalid category for selected section' }, { status: 400 })
      }
      categoryName = categoryRow.name ?? null
    }

    const sourceSamples = await fetchSourceStems(client, body)
    const targetTags = await fetchTargetTags(client, body.targetTagIds)
    const promptLayers = await buildPromptLayers({
      client,
      sectionId: body.sectionId,
      sectionName: sectionRow.name ?? 'UCAT',
      categoryId: body.categoryId ?? null,
      categoryName,
      tags: targetTags,
    })
    const candidateCount = Math.min(config.profile.candidates_per_stem, config.settings.max_candidates_per_stem)
    const examples = sourceSamples.map(compactStemForPrompt)
    const brief: AiGenerationBrief = {
      sectionName: sectionRow.name ?? 'UCAT',
      categoryName,
      stemCount: body.stemCount,
      candidateCount,
      difficultyTarget: body.difficultyTarget,
      timeBurdenTarget: body.timeBurdenTarget,
      targetTags,
      runInstructions: body.runInstructions ?? null,
      examples,
      promptLayers,
    }

    const planner = await callUcatAiJson({
      client,
      operation: 'generation_plan',
      profileId: body.profileId,
      systemPrompt: `${config.profile.base_system_prompt}\n\n${config.profile.planner_prompt}`,
      userPrompt: buildPlanningPrompt(brief),
      temperature: Math.max(0.3, Number(config.profile.temperature)),
      metadata: { section: brief.sectionName, category: brief.categoryName } as Json,
    })

    const writer = await callUcatAiJson({
      client,
      operation: 'generation_write',
      profileId: body.profileId,
      systemPrompt: `${config.profile.base_system_prompt}\n\n${config.profile.writer_prompt}`,
      userPrompt: buildWriterPrompt({ ...brief, plan: planner.parsed }),
      temperature: Number(config.profile.temperature),
      metadata: { section: brief.sectionName, category: brief.categoryName } as Json,
    })

    const parsedWriter = GeneratedCandidateResponseSchema.safeParse(writer.parsed)
    if (!parsedWriter.success) {
      return NextResponse.json(
        { error: 'AI generation output schema mismatch', details: parsedWriter.error.flatten() },
        { status: 500 }
      )
    }

    const sourcePlainTexts = [...sourceSamples.map(sourcePlainText), ...(await fetchBankComparisonTexts(client, body.sectionId))]
    const accepted: Array<{ stem: GeneratedStem; issues: GenerationGateIssue[]; rewritten: boolean }> = []
    const discarded: Array<{ issues: GenerationGateIssue[]; rewritten: boolean }> = []

    for (const [candidateIndex, candidate] of parsedWriter.data.stems.entries()) {
      let issues = validateGeneratedStemCandidate(candidate, candidateIndex, {
        sectionName: brief.sectionName,
        categoryName,
        sourcePlainTexts,
      })
      const criticIssues = await criticPass({
        client,
        profileId: body.profileId,
        systemPrompt: `${config.profile.base_system_prompt}\n\n${config.profile.critic_prompt}`,
        brief,
        candidates: [candidate],
      })
      issues = [...issues, ...criticIssues]

      let finalStem = candidate
      let rewritten = false
      if (hasBlockingIssues(issues)) {
        const rewrittenStem = await rewriteCandidate({
          client,
          profileId: body.profileId,
          systemPrompt: `${config.profile.base_system_prompt}\n\n${config.profile.rewriter_prompt}`,
          brief,
          candidate,
          issues,
        })
        if (rewrittenStem) {
          rewritten = true
          finalStem = rewrittenStem
          issues = validateGeneratedStemCandidate(finalStem, candidateIndex, {
            sectionName: brief.sectionName,
            categoryName,
            sourcePlainTexts,
          })
          const rewrittenCriticIssues = await criticPass({
            client,
            profileId: body.profileId,
            systemPrompt: `${config.profile.base_system_prompt}\n\n${config.profile.critic_prompt}`,
            brief,
            candidates: [finalStem],
          })
          issues = [...issues, ...rewrittenCriticIssues]
        }
      }

      if (hasBlockingIssues(issues)) discarded.push({ issues, rewritten })
      else accepted.push({ stem: finalStem, issues, rewritten })
      if (accepted.length >= body.stemCount) break
    }

    if (accepted.length === 0) {
      return NextResponse.json(
        {
          error: 'No generated candidates passed blocking gates.',
          discardedCount: discarded.length,
          issues: discarded.flatMap((item) => item.issues).slice(0, 10),
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
      })
    )

    return NextResponse.json({ stems, discardedCount: discarded.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate stems' },
      { status: 500 }
    )
  }
}
