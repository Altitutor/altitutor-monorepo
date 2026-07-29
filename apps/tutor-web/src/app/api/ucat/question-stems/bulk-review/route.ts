import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { ucatQuestionStemSchema } from '@/features/ucat/questions/types/schema'
import {
  AI_ASSESSMENT_PROMPT_VERSION,
  BlindSolutionResponseSchema,
  UcatAssessmentResponseSchema,
  type BlindSolutionResponse,
  type UcatAssessmentResponse,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  changedAssessmentScope,
  fingerprintUcatAssessmentSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/content'
import { buildDraftUcatAssessmentSnapshot } from '@/features/ucat/questions/server/ai-assessment/draft-snapshot'
import { loadGenerationReviewConfig } from '@/features/ucat/questions/server/ai-assessment/dispatcher'
import { manualReviewEnvironment } from '@/features/ucat/questions/server/ai-assessment/environment'
import { runUcatFormatChecks } from '@/features/ucat/questions/server/ai-assessment/format-checks'
import { assessUcatQuestionSnapshot } from '@/features/ucat/questions/server/ai-assessment/run-background-assessment'
import { issueBulkImportReviewToken } from '@/features/ucat/questions/server/ai-assessment/bulk-import-review-token'

const FingerprintsSchema = z.object({
  content: z.string().min(1),
  shared: z.string().min(1),
  questions: z.record(z.string()),
})

const ReviewProvenanceSchema = z.object({
  blindSolverModelProfileId: z.string().uuid().nullable(),
  assessmentModelProfileId: z.string().uuid().nullable(),
  blindProviderId: z.string().uuid().nullable(),
  blindModel: z.string().nullable(),
  assessmentProviderId: z.string().uuid().nullable(),
  assessmentModel: z.string().nullable(),
})

const CachedReviewSchema = z.object({
  promptVersion: z.number().int(),
  fingerprints: FingerprintsSchema,
  assessment: UcatAssessmentResponseSchema,
  blindSolution: BlindSolutionResponseSchema,
  provenance: ReviewProvenanceSchema.nullable().optional(),
  reviewToken: z.string().min(1),
})

const BodySchema = z.object({
  stems: z.array(z.object({
    id: z.string().uuid(),
    values: ucatQuestionStemSchema,
    previous: CachedReviewSchema.nullable().optional(),
  })).min(1).max(50),
  concurrency: z.number().int().min(1).max(6).default(3),
})

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

function mergeScopedAssessment(params: {
  previous: UcatAssessmentResponse | null
  next: UcatAssessmentResponse
  changedQuestionIds: string[]
  sharedChanged: boolean
}): UcatAssessmentResponse {
  if (!params.previous || params.sharedChanged) return params.next
  const changed = new Set(params.changedQuestionIds)
  const keepCategory = (item: UcatAssessmentResponse['categories'][number]) =>
    item.scopeType === 'shared' || !item.questionId || !changed.has(item.questionId)
  const keepFinding = (item: UcatAssessmentResponse['findings'][number]) =>
    item.scopeType === 'shared' || !item.questionId || !changed.has(item.questionId)
  return {
    overallSummary: params.next.overallSummary,
    categories: [
      ...params.previous.categories.filter(keepCategory),
      ...params.next.categories,
    ],
    findings: [
      ...params.previous.findings.filter(keepFinding),
      ...params.next.findings,
    ],
  }
}

function mergeScopedBlindSolution(params: {
  previous: BlindSolutionResponse | null
  next: BlindSolutionResponse
  changedQuestionIds: string[]
  sharedChanged: boolean
}): BlindSolutionResponse {
  if (!params.previous || params.sharedChanged) return params.next
  const changed = new Set(params.changedQuestionIds)
  return {
    solutions: [
      ...params.previous.solutions.filter((solution) => !changed.has(solution.questionId)),
      ...params.next.solutions,
    ],
  }
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = []
  let cursor = 0
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor
      cursor += 1
      results[index] = await tasks[index]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
  return results
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  if (!manualReviewEnvironment().enabled) {
    return NextResponse.json({ error: 'UCAT AI review is disabled in this environment.' }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid bulk-review payload.', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  const sectionIds = [...new Set(parsed.data.stems.map((stem) => stem.values.sectionId))]
  const categoryIds = [...new Set(parsed.data.stems.flatMap((stem) => stem.values.categoryId ? [stem.values.categoryId] : []))]
  const tagIds = [...new Set(parsed.data.stems.flatMap((stem) => stem.values.questions.flatMap((question) => question.tagIds ?? [])))]
  const [sectionsResult, categoriesResult, tagsResult, config] = await Promise.all([
    asAny(admin).from('ucat_sections').select('id,name,section_number,display_columns').in('id', sectionIds),
    categoryIds.length > 0
      ? asAny(admin).from('question_stem_categories').select('id,name').in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
    tagIds.length > 0
      ? asAny(admin).from('question_tags').select('id,name').in('id', tagIds)
      : Promise.resolve({ data: [], error: null }),
    loadGenerationReviewConfig(admin),
  ])
  const metadataError = sectionsResult.error ?? categoriesResult.error ?? tagsResult.error
  if (metadataError) return NextResponse.json({ error: metadataError.message }, { status: 500 })
  if (!config.solver || !config.assessment) {
    return NextResponse.json({ error: 'UCAT AI review model profiles are not configured.' }, { status: 503 })
  }

  const sections = new Map<string, Record<string, unknown>>(
    (sectionsResult.data ?? []).map((row: Record<string, unknown>) => [String(row.id), row])
  )
  const categories = new Map<string, string>(
    (categoriesResult.data ?? []).map((row: Record<string, unknown>) => [
      String(row.id),
      String(row.name ?? ''),
    ])
  )
  const tagNames = new Map<string, string>(
    (tagsResult.data ?? []).map((row: Record<string, unknown>) => [
      String(row.id),
      String(row.name ?? ''),
    ])
  )

  const tasks = parsed.data.stems.map((stem) => async () => {
    try {
      const section = sections.get(stem.values.sectionId)
      if (!section) throw new Error('The UCAT section is unavailable.')
      const snapshot = buildDraftUcatAssessmentSnapshot({
        stemId: stem.id,
        values: stem.values,
        sectionName: String(section.name ?? ''),
        sectionNumber: Number(section.section_number ?? 0),
        displayColumns: Number(section.display_columns ?? 1),
        categoryName: stem.values.categoryId ? categories.get(stem.values.categoryId) ?? null : null,
        tagNamesById: tagNames,
      })
      const fingerprints = fingerprintUcatAssessmentSnapshot(snapshot)
      const previous = stem.previous?.promptVersion === AI_ASSESSMENT_PROMPT_VERSION ? stem.previous : null
      const changed = changedAssessmentScope(previous?.fingerprints ?? null, fingerprints)
      if (!changed && previous) {
        const provenance = previous.provenance ?? null
        return {
          id: stem.id,
          promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
          fingerprints,
          assessment: previous.assessment,
          blindSolution: previous.blindSolution,
          provenance,
          reviewToken: issueBulkImportReviewToken({
            draftStemId: stem.id,
            promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
            fingerprints,
            assessment: previous.assessment,
            blindSolution: previous.blindSolution,
            provenance,
          }),
          reused: true,
          error: null,
        }
      }

      const targetQuestionIds = changed?.scopeType === 'questions'
        ? changed.questionIds
        : snapshot.questions.map((question) => question.id)
      const result = await assessUcatQuestionSnapshot({
        client: admin,
        snapshot,
        targetQuestionIds,
        includeSharedAssessment: changed?.scopeType !== 'questions',
        formatChecks: runUcatFormatChecks(snapshot),
        blindSolverModelProfileId: config.solver,
        assessmentModelProfileId: config.assessment,
        metadata: {
          bulkImportDraftId: stem.id,
          targetQuestionIds,
          promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
        },
        signal: request.signal,
      })
      const assessment = mergeScopedAssessment({
        previous: previous?.assessment ?? null,
        next: result.assessment,
        changedQuestionIds: targetQuestionIds,
        sharedChanged: changed?.scopeType !== 'questions',
      })
      const blindSolution = mergeScopedBlindSolution({
        previous: previous?.blindSolution ?? null,
        next: result.blindSolution,
        changedQuestionIds: targetQuestionIds,
        sharedChanged: changed?.scopeType !== 'questions',
      })
      const provenance = {
        blindSolverModelProfileId: config.solver,
        assessmentModelProfileId: config.assessment,
        blindProviderId: result.blindProviderId,
        blindModel: result.blindModel,
        assessmentProviderId: result.assessmentProviderId,
        assessmentModel: result.assessmentModel,
      }
      return {
        id: stem.id,
        promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
        fingerprints,
        assessment,
        blindSolution,
        provenance,
        reviewToken: issueBulkImportReviewToken({
          draftStemId: stem.id,
          promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
          fingerprints,
          assessment,
          blindSolution,
          provenance,
        }),
        reused: false,
        error: null,
      }
    } catch (error) {
      return {
        id: stem.id,
        promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
        fingerprints: null,
        assessment: null,
        blindSolution: null,
        provenance: null,
        reviewToken: null,
        reused: false,
        error: error instanceof Error ? error.message : 'AI review failed.',
      }
    }
  })
  const results = await runWithConcurrency(tasks, parsed.data.concurrency)
  return NextResponse.json({
    results,
    reviewedCount: results.filter((result) => !result.error && !result.reused).length,
    reusedCount: results.filter((result) => result.reused).length,
    errorCount: results.filter((result) => result.error).length,
  })
}
