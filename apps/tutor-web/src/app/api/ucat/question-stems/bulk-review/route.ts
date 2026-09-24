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
import {
  blindSolveUcatSnapshot,
  repairBulkImportUcatSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/run-background-assessment'
import { issueBulkImportReviewToken } from '@/features/ucat/questions/server/ai-assessment/bulk-import-review-token'
import {
  prepareBulkImportVerificationCandidate,
  reconcileBulkImportAiReview,
} from '@/features/ucat/questions/server/ai-assessment/bulk-import-pipeline'
import { UcatAiJsonParseError } from '@/features/ucat/shared/server/ucat-ai-client'

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
  concurrency: z.number().int().min(1).max(6).default(6),
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

function reviewFailureMessage(error: unknown): string {
  if (error instanceof UcatAiJsonParseError) {
    const completionTokens = error.usage?.completion_tokens ?? 0
    const reachedConfiguredLimit = Boolean(
      error.maxCompletionTokens
      && completionTokens >= error.maxCompletionTokens * 0.95
    )
    if (error.finishReason === 'length' || reachedConfiguredLimit) {
      return 'The AI review reached its structured-output limit before finishing. No draft changes were applied; retry this stem.'
    }
    return 'The AI review returned malformed structured data. No draft changes were applied; retry this stem.'
  }
  return error instanceof Error ? error.message : 'AI review failed.'
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
    const taskStartedAt = performance.now()
    const timings = {
      auditRepairMs: null as number | null,
      verificationPreparationMs: null as number | null,
      blindVerificationMs: null as number | null,
      reconciliationMs: null as number | null,
    }
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
          audit: previous.assessment,
          assessment: previous.assessment,
          blindSolution: previous.blindSolution,
          values: stem.values,
          appliedRepairs: [],
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
          timings: {
            totalMs: performance.now() - taskStartedAt,
            ...timings,
          },
        }
      }

      const targetQuestionIds = changed?.scopeType === 'questions'
        ? changed.questionIds
        : snapshot.questions.map((question) => question.id)
      let phaseStartedAt = performance.now()
      const result = await repairBulkImportUcatSnapshot({
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
        providerSort: 'latency',
        deferBlindSolve: true,
        signal: request.signal,
      })
      timings.auditRepairMs = performance.now() - phaseStartedAt
      let finalBlindProviderId = result.blindProviderId
      let finalBlindModel = result.blindModel
      phaseStartedAt = performance.now()
      const verificationCandidate = await prepareBulkImportVerificationCandidate({
        values: stem.values,
        audit: result.audit,
        repair: result.repair,
      })
      timings.verificationPreparationMs = performance.now() - phaseStartedAt
      let verificationSolution = result.blindSolution
      phaseStartedAt = performance.now()
      if (verificationCandidate.questionIds.length > 0) {
        const candidateSnapshot = buildDraftUcatAssessmentSnapshot({
          stemId: stem.id,
          values: verificationCandidate.values,
          sectionName: String(section.name ?? ''),
          sectionNumber: Number(section.section_number ?? 0),
          displayColumns: Number(section.display_columns ?? 1),
          categoryName: verificationCandidate.values.categoryId
            ? categories.get(verificationCandidate.values.categoryId) ?? null
            : null,
          tagNamesById: tagNames,
        })
        const verified = await blindSolveUcatSnapshot({
          client: admin,
          snapshot: candidateSnapshot,
          targetQuestionIds: verificationCandidate.questionIds,
          blindSolverModelProfileId: config.solver,
          metadata: {
            bulkImportDraftId: stem.id,
            targetQuestionIds: verificationCandidate.questionIds,
            promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
            combinedRepairVerification: true,
          },
          providerSort: 'latency',
          signal: request.signal,
        })
        verificationSolution = verified.solution
        finalBlindProviderId = verified.providerId
        finalBlindModel = verified.model
      }
      timings.blindVerificationMs = performance.now() - phaseStartedAt
      phaseStartedAt = performance.now()
      const reconciled = await reconcileBulkImportAiReview({
        values: stem.values,
        blindSolution: verificationSolution,
        preverifiedSemanticBlindSolution: verificationSolution,
        audit: result.audit,
        repair: result.repair,
      })
      timings.reconciliationMs = performance.now() - phaseStartedAt
      const finalValues = reconciled.values
      const finalSnapshot = buildDraftUcatAssessmentSnapshot({
        stemId: stem.id,
        values: finalValues,
        sectionName: String(section.name ?? ''),
        sectionNumber: Number(section.section_number ?? 0),
        displayColumns: Number(section.display_columns ?? 1),
        categoryName: finalValues.categoryId
          ? categories.get(finalValues.categoryId) ?? null
          : null,
        tagNamesById: tagNames,
      })
      const finalTargetQuestionIds = finalSnapshot.questions
        .filter((question) => targetQuestionIds.includes(question.id))
        .map((question) => question.id)
      const finalTargetQuestionIdSet = new Set(finalTargetQuestionIds)
      const scopedBlindSolution = {
        solutions: reconciled.blindSolution.solutions.filter(
          (solution) => finalTargetQuestionIdSet.has(solution.questionId)
        ),
      }
      const assessment = mergeScopedAssessment({
        previous: previous?.assessment ?? null,
        next: reconciled.assessment,
        changedQuestionIds: targetQuestionIds,
        sharedChanged: changed?.scopeType !== 'questions',
      })
      const blindSolution = mergeScopedBlindSolution({
        previous: previous?.blindSolution ?? null,
        next: scopedBlindSolution,
        changedQuestionIds: targetQuestionIds,
        sharedChanged: changed?.scopeType !== 'questions',
      })
      const provenance = {
        blindSolverModelProfileId: result.blindModel ? config.solver : null,
        assessmentModelProfileId: config.assessment,
        blindProviderId: finalBlindProviderId,
        blindModel: finalBlindModel,
        assessmentProviderId: result.assessmentProviderId,
        assessmentModel: result.assessmentModel,
      }
      return {
        id: stem.id,
        promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
        fingerprints: fingerprintUcatAssessmentSnapshot(finalSnapshot),
        audit: result.audit,
        assessment,
        blindSolution,
        values: finalValues,
        appliedRepairs: reconciled.appliedRepairs,
        provenance,
        reviewToken: issueBulkImportReviewToken({
          draftStemId: stem.id,
          promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
          fingerprints: fingerprintUcatAssessmentSnapshot(finalSnapshot),
          assessment,
          blindSolution,
          provenance,
        }),
        reused: false,
        error: null,
        timings: {
          totalMs: performance.now() - taskStartedAt,
          ...timings,
        },
      }
    } catch (error) {
      return {
        id: stem.id,
        promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
        fingerprints: null,
        audit: null,
        assessment: null,
        blindSolution: null,
        values: null,
        appliedRepairs: [],
        provenance: null,
        reviewToken: null,
        reused: false,
        error: reviewFailureMessage(error),
        timings: {
          totalMs: performance.now() - taskStartedAt,
          ...timings,
        },
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
