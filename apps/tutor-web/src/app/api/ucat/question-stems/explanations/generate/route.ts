import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  callUcatAiJson,
  getUcatAiPromptLayers,
  UcatAiEmptyResponseError,
  UcatAiJsonParseError,
} from '@/features/ucat/shared/server/ucat-ai-client'
import {
  AiToolExplanationResponseSchema,
  AiToolQuestionStemPayloadSchema,
  findMissingExplanations,
  type AiToolExplanationUpdate,
} from '@/features/ucat/questions/lib/ai-tools'
import {
  buildExplanationFillSystemPrompt,
  buildExplanationFillUserPrompt,
} from '@/features/ucat/questions/lib/ai-generation/explanation-prompts'

const StemInputSchema = AiToolQuestionStemPayloadSchema.extend({
  id: z.string().optional(),
  sectionName: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  questionIndices: z.array(z.number().int().nonnegative()).optional(),
})

const BodySchema = z.object({
  modelProfileId: z.string().uuid().nullable().optional(),
  stems: z.array(StemInputSchema).min(1).max(50),
  concurrency: z.number().int().min(1).max(8).optional(),
})

const EXPLANATION_TOKEN_LIMIT = 3500
const EXPLANATION_TIMEOUT_MS = 90_000
const DEFAULT_CONCURRENCY = 4

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
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
  return results
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const client = access.userClient as unknown as SupabaseClient<Database>

  const parsedBody = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid explanation generation payload' }, { status: 400 })
  }

  const { modelProfileId, stems, concurrency = DEFAULT_CONCURRENCY } = parsedBody.data

  const tasks = stems.map((stemInput, stemIndex) => async () => {
    const {
      id,
      sectionName,
      categoryName,
      questionIndices: requestedIndices,
      ...stem
    } = stemInput

    const missing = findMissingExplanations(stem)
    const questionIndices =
      requestedIndices && requestedIndices.length > 0
        ? requestedIndices.filter((index) => missing.some((target) => target.questionIndex === index))
        : [...new Set(missing.map((target) => target.questionIndex))]

    if (questionIndices.length === 0) {
      return {
        stemIndex,
        id: id ?? null,
        updates: [] as AiToolExplanationUpdate[],
        error: null as string | null,
      }
    }

    try {
      const promptLayers = await getUcatAiPromptLayers({
        client,
        tutorScoped: true,
        sectionId: stem.sectionId,
        categoryId: stem.categoryId ?? null,
        tagIds: stem.questions.flatMap((question) => question.tagIds ?? []),
      })

      const result = await callUcatAiJson({
        client,
        operation: 'answer_explanation_generate',
        modelProfileId,
        tutorScoped: true,
        systemPrompt: buildExplanationFillSystemPrompt({
          sectionName,
          promptLayers: promptLayers.map((layer) => layer.prompt_text),
        }),
        userPrompt: buildExplanationFillUserPrompt({
          stem,
          sectionName,
          categoryName,
          questionIndices,
        }),
        maxCompletionTokens: EXPLANATION_TOKEN_LIMIT,
        timeoutMs: EXPLANATION_TIMEOUT_MS,
        providerSort: 'throughput',
        metadata: {
          stemId: id ?? null,
          sectionId: stem.sectionId,
          categoryId: stem.categoryId ?? null,
          questionIndices,
        },
        signal: request.signal,
      })

      const parsed = AiToolExplanationResponseSchema.parse(result.parsed)
      const updates = parsed.updates
        .filter((update) => questionIndices.includes(update.questionIndex))

      return {
        stemIndex,
        id: id ?? null,
        updates,
        error: null as string | null,
      }
    } catch (error) {
      const message =
        error instanceof UcatAiJsonParseError || error instanceof UcatAiEmptyResponseError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to generate explanations'
      return {
        stemIndex,
        id: id ?? null,
        updates: [] as AiToolExplanationUpdate[],
        error: message,
      }
    }
  })

  const results = await runWithConcurrency(tasks, concurrency)

  return NextResponse.json({
    results,
    appliedStemCount: results.filter((result) => result.updates.length > 0).length,
    errorCount: results.filter((result) => result.error).length,
  })
}
