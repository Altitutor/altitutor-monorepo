import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  callUcatAiJson,
  UcatAiBudgetExceededError,
} from '@/features/ucat/shared/server/ucat-ai-client'
import {
  BlindSolutionResponseSchema,
  parseBulkImportAuditRepairResponse,
  UcatAssessmentResponseSchema,
  UcatFormatCheckSchema,
  type UcatAssessmentCategory,
  type BlindSolutionResponse,
  type BulkImportRepairResponse,
  type UcatAssessmentPatch,
  type UcatAssessmentResponse,
  type UcatAssessmentSnapshot,
  type UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  compactUcatAssessmentSnapshot,
  fingerprintUcatAssessmentSnapshot,
  loadUcatAssessmentSnapshot,
} from './content'
import { syncUcatCatalogAiReviewStatusesBestEffort } from './persist-catalog-status'
import {
  ASSESSMENT_SYSTEM_PROMPT,
  BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT,
  BLIND_SOLVER_SYSTEM_PROMPT,
  buildAssessmentUserPrompt,
  buildBulkImportAuditRepairUserPrompt,
  buildBlindSolverUserPrompt,
} from './prompts'
import { buildVisualEvidence } from './visual-evidence'
import { normalizeBlindSolutionSelections } from './normalize-blind-solution'
import {
  BULK_IMPORT_AI_CALL_OPTIONS,
  chunkBulkImportAuditQuestionIds,
  runConditionalBulkImportReview,
} from './bulk-import-pipeline'
import { runUcatFormatChecks } from './format-checks'
import {
  promptWithStructuredOutputRetry,
  runWithStructuredOutputRetry,
} from './structured-output-retry'
import { bindAssessmentSetTextBeforesToSnapshot, normalizeDuplicateAssessmentFindingKeys } from './normalize-assessment'

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type RunRow = {
  id: string
  cycle_id: string
  stem_id: string
  status: string
  scope_type: 'full' | 'questions'
  target_question_ids: string[]
  content_fingerprint: string
  content_snapshot: UcatAssessmentSnapshot
  format_checks: unknown
  blind_solver_model_profile_id: string | null
  assessment_model_profile_id: string | null
  blind_solution: unknown
  requested_at: string
  attempt_count: number
  started_at: string | null
}

const QUESTION_CATEGORIES: UcatAssessmentCategory[] = [
  'presentation_integrity',
  'ucat_suitability',
  'difficulty_timing',
  'answer_correctness_fairness',
  'explanation_quality',
]

const SHARED_CATEGORIES: UcatAssessmentCategory[] = [
  'presentation_integrity',
  'ucat_suitability',
]

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

async function loadAvailableQuestionTags(
  client: SupabaseClient<Database>,
  sectionId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await asAny(client)
    .from('question_tags')
    .select('id,name')
    .eq('ucat_section_id', sectionId)
    .order('name')
  if (error) throw error
  return (data ?? []).flatMap((row: { id?: unknown; name?: unknown }) =>
    typeof row.id === 'string' && typeof row.name === 'string'
      ? [{ id: row.id, name: row.name }]
      : []
  )
}

function withCompleteCategoryCoverage(params: {
  assessment: UcatAssessmentResponse
  targetQuestionIds: string[]
  includeShared: boolean
}): UcatAssessmentResponse {
  const categories = [...params.assessment.categories]
  const seen = new Set(categories.map((result) => `${result.scopeType}:${result.questionId ?? ''}:${result.category}`))
  const addMissing = (scopeType: 'shared' | 'question', questionId: string | null, category: UcatAssessmentCategory) => {
    const key = `${scopeType}:${questionId ?? ''}:${category}`
    if (seen.has(key)) return
    categories.push({
      scopeType,
      questionId,
      category,
      rating: 'unreviewable',
      confidence: 0,
      summary: 'The reviewer did not return an assessment for this category.',
      evidence: [],
    })
    seen.add(key)
  }
  if (params.includeShared) SHARED_CATEGORIES.forEach((category) => addMissing('shared', null, category))
  params.targetQuestionIds.forEach((questionId) => {
    QUESTION_CATEGORIES.forEach((category) => addMissing('question', questionId, category))
  })
  return { ...params.assessment, categories }
}

function assertBlindSolutionTargets(params: {
  solution: BlindSolutionResponse
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
}) {
  const targets = new Set(params.targetQuestionIds)
  const byQuestion = new Map(params.snapshot.questions.map((question) => [question.id, question]))
  if (params.solution.solutions.length !== targets.size) {
    throw new Error('Blind solver did not return exactly one solution for each target question')
  }
  const seen = new Set<string>()
  for (const solution of params.solution.solutions) {
    const question = byQuestion.get(solution.questionId)
    if (!question || !targets.has(solution.questionId) || seen.has(solution.questionId)) {
      throw new Error('Blind solver returned an unknown or duplicate question ID')
    }
    seen.add(solution.questionId)
    const optionIds = new Set(question.options.map((option) => option.id))
    if (solution.selectedOptionId && !optionIds.has(solution.selectedOptionId)) {
      throw new Error('Blind solver returned an option ID outside its question')
    }
    if (question.questionType === 'syllogism') {
      const returned = solution.syllogismAnswers.map((answer) => answer.optionId)
      if (returned.length !== optionIds.size || new Set(returned).size !== optionIds.size || returned.some((id) => !optionIds.has(id))) {
        throw new Error('Blind solver did not answer every syllogism statement exactly once')
      }
    }
  }
}

export function reusableBlindSolutionForScope(params: {
  existing: unknown
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
}): BlindSolutionResponse | null {
  const parsed = BlindSolutionResponseSchema.safeParse(params.existing)
  if (!parsed.success) return null
  const normalized = normalizeBlindSolutionSelections(parsed.data, params.snapshot)
  const normalizedByQuestionId = new Map(
    normalized.solutions.map((solution) => [solution.questionId, solution])
  )
  if (parsed.data.solutions.some((solution) => (
    solution.selectedOptionId
    && normalizedByQuestionId.get(solution.questionId)?.selectedOptionId !== solution.selectedOptionId
  ))) {
    return null
  }
  try {
    assertBlindSolutionTargets({
      solution: normalized,
      snapshot: params.snapshot,
      targetQuestionIds: params.targetQuestionIds,
    })
    return normalized
  } catch {
    return null
  }
}

function patchTargetsCurrentScope(params: {
  patch: UcatAssessmentPatch
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: Set<string>
  includeShared: boolean
}) {
  const optionQuestion = new Map(
    params.snapshot.questions.flatMap((question) => question.options.map((option) => [option.id, question.id] as const)),
  )
  const textTargetAllowed = (target: { kind: 'stem' | 'question' | 'option'; id?: string | null }) => {
    if (target.kind === 'stem') return params.includeShared
    if (!target.id) return false
    return target.kind === 'question'
      ? params.targetQuestionIds.has(target.id)
      : params.targetQuestionIds.has(optionQuestion.get(target.id) ?? '')
  }
  const patch = params.patch
  switch (patch.operation) {
    case 'replace_text':
    case 'set_text':
    case 'set_rich_content':
    case 'update_visual_spec':
      return textTargetAllowed(patch.target)
    case 'set_answer_key': {
      const question = params.snapshot.questions.find((item) => item.id === patch.questionId)
      const currentCorrectOptionId = question?.options.find((option) => option.isAnswer)?.id ?? null
      return Boolean(
        question
        && question.questionType === 'multiple_choice'
        && params.targetQuestionIds.has(question.id)
        && currentCorrectOptionId === patch.currentCorrectOptionId
        && question.options.some((option) => option.id === patch.correctOptionId),
      )
    }
    case 'replace_option_and_key': {
      const question = params.snapshot.questions.find((item) => item.id === patch.questionId)
      const option = question?.options.find((item) => item.id === patch.optionId)
      return Boolean(
        question
        && question.questionType === 'multiple_choice'
        && params.targetQuestionIds.has(question.id)
        && optionQuestion.get(patch.optionId) === question.id
        && option?.answerTextPlain.trim() === patch.beforeAnswerText.trim(),
      )
    }
    case 'replace_question':
    case 'remove_question':
    case 'insert_option':
    case 'reorder_options':
      return params.targetQuestionIds.has(patch.questionId)
    case 'remove_option':
      return params.targetQuestionIds.has(patch.questionId)
        && optionQuestion.get(patch.optionId) === patch.questionId
    case 'insert_question':
      return params.includeShared
        && (patch.afterQuestionId == null || params.snapshot.questions.some((question) => question.id === patch.afterQuestionId))
    case 'set_metadata':
      return patch.targetKind === 'stem'
        ? params.includeShared && patch.targetId === params.snapshot.stemId
        : params.targetQuestionIds.has(patch.targetId)
  }
}

function assertAssessmentTargets(params: {
  assessment: UcatAssessmentResponse
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeShared: boolean
}) {
  const targets = new Set(params.targetQuestionIds)
  const scopeAllowed = (scopeType: 'shared' | 'question', questionId?: string | null) =>
    scopeType === 'shared' ? params.includeShared : Boolean(questionId && targets.has(questionId))
  if (params.assessment.categories.some((result) => !scopeAllowed(result.scopeType, result.questionId))) {
    throw new Error('Assessment returned a category outside the requested scope')
  }
  const findingKeys = new Set<string>()
  for (const finding of params.assessment.findings) {
    if (!scopeAllowed(finding.scopeType, finding.questionId)) {
      throw new Error('Assessment returned a finding outside the requested scope')
    }
    if (findingKeys.has(finding.key)) {
      throw new Error('Assessment returned a duplicate finding key')
    }
    findingKeys.add(finding.key)
    if (finding.suggestion?.patches.some((patch) => !patchTargetsCurrentScope({
      patch,
      snapshot: params.snapshot,
      targetQuestionIds: targets,
      includeShared: params.includeShared,
    }))) {
      throw new Error('Assessment returned a suggestion outside the requested scope')
    }
  }
}

function enforceUnreviewableVisuals(params: {
  assessment: UcatAssessmentResponse
  unavailable: Array<{ label: string; inspectable: boolean; error: string | null }>
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeShared: boolean
}): UcatAssessmentResponse {
  const unavailable = params.unavailable.filter((item) => !item.inspectable)
  if (unavailable.length === 0) return params.assessment
  const categories = [...params.assessment.categories]
  const findings = [...params.assessment.findings]
  const optionQuestion = new Map(
    params.snapshot.questions.flatMap((question) => question.options.map((option) => [option.id, question.id] as const)),
  )
  const target = new Set(params.targetQuestionIds)

  for (const item of unavailable) {
    const questionMatch = item.label.match(/^question:([0-9a-f-]{36}):/iu)
    const optionMatch = item.label.match(/^option:([0-9a-f-]{36}):/iu)
    const questionId = questionMatch?.[1]
      ?? (optionMatch?.[1] ? optionQuestion.get(optionMatch[1]) : null)
      ?? null
    const scopeType = questionId && target.has(questionId) ? 'question' as const : 'shared' as const
    if (scopeType === 'shared' && !params.includeShared) {
      for (const targetQuestionId of params.targetQuestionIds) {
        const replacement: UcatAssessmentResponse['categories'][number] = {
          scopeType: 'question',
          questionId: targetQuestionId,
          category: 'presentation_integrity',
          rating: 'unreviewable',
          confidence: 1,
          summary: 'A potentially relevant shared visual could not be inspected.',
          evidence: [item.label, item.error ?? 'Image unavailable'],
        }
        const existingIndex = categories.findIndex((result) =>
          result.scopeType === replacement.scopeType
          && result.questionId === replacement.questionId
          && result.category === replacement.category)
        if (existingIndex >= 0) categories[existingIndex] = replacement
        else categories.push(replacement)
      }
    } else {
      const replacement: UcatAssessmentResponse['categories'][number] = {
        scopeType,
        questionId: scopeType === 'question' ? questionId : null,
        category: 'presentation_integrity',
        rating: 'unreviewable',
        confidence: 1,
        summary: 'A visual could not be inspected.',
        evidence: [item.label, item.error ?? 'Image unavailable'],
      }
      const existingIndex = categories.findIndex((result) =>
        result.scopeType === replacement.scopeType
        && result.questionId === replacement.questionId
        && result.category === replacement.category)
      if (existingIndex >= 0) categories[existingIndex] = replacement
      else categories.push(replacement)
    }
    const alreadyReported = findings.some((finding) =>
      finding.category === 'presentation_integrity'
      && finding.rating === 'unreviewable'
      && finding.scopeType === scopeType
      && (finding.questionId ?? null) === (scopeType === 'question' ? questionId : null))
    if (!alreadyReported) {
      findings.push({
        key: `visual_unreviewable:${item.label}`,
        scopeType,
        questionId: scopeType === 'question' ? questionId : null,
        category: 'presentation_integrity',
        rating: 'unreviewable',
        confidence: 1,
        title: 'Visual could not be inspected',
        detail: 'The reviewer could not inspect a supplied visual, so visual accuracy and fairness cannot be confirmed.',
        evidence: [item.label, item.error ?? 'Image unavailable'],
        recommendedAction: 'review',
        suggestion: null,
      })
    }
  }
  return { ...params.assessment, categories, findings }
}

export type UcatSnapshotAssessmentResult = {
  assessment: UcatAssessmentResponse
  blindSolution: BlindSolutionResponse
  blindProviderId: string | null
  blindModel: string | null
  assessmentProviderId: string | null
  assessmentModel: string
}

export type BulkImportSnapshotRepairResult = {
  audit: UcatAssessmentResponse
  repair: BulkImportRepairResponse
  blindSolution: BlindSolutionResponse
  blindProviderId: string | null
  blindModel: string | null
  auditProviderId: string | null
  auditModel: string
  assessmentProviderId: string | null
  assessmentModel: string
}

export async function blindSolveUcatSnapshot(params: {
  client: SupabaseClient<Database>
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  blindSolverModelProfileId: string | null
  metadata?: Record<string, unknown>
  signal?: AbortSignal
  providerSort?: 'price' | 'throughput' | 'latency'
}): Promise<{
  solution: BlindSolutionResponse
  providerId: string | null
  model: string
}> {
  const visualEvidence = await buildVisualEvidence({
    client: params.client,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeExplanations: false,
  })
  const prompt = buildBlindSolverUserPrompt({
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    visualAvailability: visualEvidence.availability,
  })
  const result = await runWithStructuredOutputRetry(async (retry) => {
    const attemptedPrompt = promptWithStructuredOutputRetry(prompt, retry)
    const call = await callUcatAiJson({
      client: params.client,
      operation: 'question_assessment_blind_solve',
      modelProfileId: params.blindSolverModelProfileId,
      systemPrompt: BLIND_SOLVER_SYSTEM_PROMPT,
      userPrompt: attemptedPrompt,
      userContentParts: [
        { type: 'text', text: attemptedPrompt },
        ...visualEvidence.parts,
      ],
      temperature: 0,
      maxCompletionTokens: BULK_IMPORT_AI_CALL_OPTIONS.blind.maxCompletionTokens,
      timeoutMs: BULK_IMPORT_AI_CALL_OPTIONS.blind.timeoutMs,
      providerSort: params.providerSort ?? 'throughput',
      reasoningEffort: BULK_IMPORT_AI_CALL_OPTIONS.blind.reasoningEffort,
      metadata: { ...(params.metadata ?? {}), structuredOutputAttempt: retry.attempt } as Json,
      signal: params.signal,
    })
    const solution = normalizeBlindSolutionSelections(
      BlindSolutionResponseSchema.parse(call.parsed),
      params.snapshot,
    )
    assertBlindSolutionTargets({
      solution,
      snapshot: params.snapshot,
      targetQuestionIds: params.targetQuestionIds,
    })
    return { call, solution }
  })
  return {
    solution: result.solution,
    providerId: result.call.providerId,
    model: result.call.model,
  }
}

export async function repairBulkImportUcatSnapshot(params: {
  client: SupabaseClient<Database>
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeSharedAssessment: boolean
  formatChecks: UcatFormatCheck[]
  blindSolverModelProfileId: string | null
  assessmentModelProfileId: string | null
  metadata?: Record<string, unknown>
  signal?: AbortSignal
  providerSort?: 'price' | 'throughput' | 'latency'
  deferBlindSolve?: boolean
}): Promise<BulkImportSnapshotRepairResult> {
  const providerSort = params.providerSort ?? 'throughput'
  const assessmentVisualEvidencePromise = buildVisualEvidence({
    client: params.client,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeExplanations: true,
  })
  const availableQuestionTagsPromise = loadAvailableQuestionTags(
    params.client,
    params.snapshot.sectionId,
  )

  const conditionalReview = await runConditionalBulkImportReview({
    auditAndRepair: async () => {
      const [assessmentVisualEvidence, availableQuestionTags] = await Promise.all([
        assessmentVisualEvidencePromise,
        availableQuestionTagsPromise,
      ])
      const chunks = chunkBulkImportAuditQuestionIds(params.targetQuestionIds)
      const calls = await Promise.all(chunks.map(async (targetQuestionIds, chunkIndex) => {
        const includeSharedAssessment = params.includeSharedAssessment && chunkIndex === 0
        const targetSet = new Set(targetQuestionIds)
        const prompt = buildBulkImportAuditRepairUserPrompt({
          snapshot: params.snapshot,
          targetQuestionIds,
          includeSharedAssessment,
          formatChecks: params.formatChecks.filter((check) => (
            check.scopeType === 'shared' ? includeSharedAssessment : Boolean(check.questionId && targetSet.has(check.questionId))
          )),
          availableQuestionTags,
          visualAvailability: assessmentVisualEvidence.availability,
        })
        const { call, response } = await runWithStructuredOutputRetry(async (retry) => {
          const attemptedPrompt = promptWithStructuredOutputRetry(prompt, retry)
          const call = await callUcatAiJson({
            client: params.client,
            operation: 'question_assessment_bulk_review_directives',
            modelProfileId: params.assessmentModelProfileId,
            systemPrompt: BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT,
            userPrompt: attemptedPrompt,
            userContentParts: [
              { type: 'text', text: attemptedPrompt },
              ...assessmentVisualEvidence.parts,
            ],
            temperature: 0,
            maxCompletionTokens: BULK_IMPORT_AI_CALL_OPTIONS.auditRepair.maxCompletionTokens
              + (retry.attempt * 3_000),
            timeoutMs: BULK_IMPORT_AI_CALL_OPTIONS.auditRepair.timeoutMs,
            providerSort,
            reasoningEffort: BULK_IMPORT_AI_CALL_OPTIONS.auditRepair.reasoningEffort,
            metadata: {
              ...(params.metadata ?? {}),
              auditChunkIndex: chunkIndex,
              auditChunkCount: chunks.length,
              targetQuestionIds,
              structuredOutputAttempt: retry.attempt,
            } as Json,
            signal: params.signal,
          })
          const response = parseBulkImportAuditRepairResponse(call.parsed)
          assertAssessmentTargets({
            assessment: response.audit,
            snapshot: params.snapshot,
            targetQuestionIds,
            includeShared: includeSharedAssessment,
          })
          if (response.repair.repairs.some((repair) => repair.patches.some((patch) =>
            !patchTargetsCurrentScope({
              patch,
              snapshot: params.snapshot,
              targetQuestionIds: targetSet,
              includeShared: includeSharedAssessment,
            })
          ))) {
            throw new Error('Bulk repair returned a patch outside the requested scope')
          }
          const auditFindingKeys = new Set(response.audit.findings.map((finding) => finding.key))
          if (response.repair.repairs.some((repair) =>
            repair.resolvedFindingKeys.some((key) => !auditFindingKeys.has(key))
          )) {
            throw new Error('Bulk repair referenced an unknown audit finding key')
          }
          return { call, response }
        })
        if (chunks.length === 1) return { call, response }
        const keyPrefix = `chunk:${targetQuestionIds[0]}:`
        const prefixKey = (key: string) => `${keyPrefix}${key}`
        return {
          call,
          response: {
            audit: {
              ...response.audit,
              findings: response.audit.findings.map((finding) => ({
                ...finding,
                key: prefixKey(finding.key),
              })),
            },
            repair: {
              ...response.repair,
              repairs: response.repair.repairs.map((repair) => ({
                ...repair,
                resolvedFindingKeys: repair.resolvedFindingKeys.map(prefixKey),
              })),
              unresolvedFindings: response.repair.unresolvedFindings.map((finding) => ({
                ...finding,
                key: prefixKey(finding.key),
              })),
            },
          },
        }
      }))
      const response = {
        audit: {
          overallSummary: calls.map(({ response: item }) => item.audit.overallSummary).join(' '),
          categories: calls.flatMap(({ response: item }) => item.audit.categories),
          findings: calls.flatMap(({ response: item }) => item.audit.findings),
        },
        repair: {
          overallSummary: calls.map(({ response: item }) => item.repair.overallSummary).join(' '),
          repairs: calls.flatMap(({ response: item }) => item.repair.repairs),
          unresolvedFindings: calls.flatMap(({ response: item }) => item.repair.unresolvedFindings),
        },
      }
      const firstCall = calls[0]?.call
      if (!firstCall) throw new Error('Bulk review had no question scope to audit')
      return {
        response,
        providerId: firstCall.providerId,
        model: firstCall.model,
      }
    },
    blindSolve: (blindQuestionIds) => params.deferBlindSolve
      ? Promise.resolve({
          solution: { solutions: [] } as BlindSolutionResponse,
          providerId: null,
          model: '',
        })
      : blindSolveUcatSnapshot({
        client: params.client,
        snapshot: params.snapshot,
        targetQuestionIds: blindQuestionIds,
        blindSolverModelProfileId: params.blindSolverModelProfileId,
        metadata: {
          ...params.metadata,
          conditionalBlindVerification: true,
          targetQuestionIds: blindQuestionIds,
        },
        signal: params.signal,
        providerSort,
      }),
  })
  const auditRepair = conditionalReview.auditRepair
  const blindSolution = conditionalReview.blindSolution ?? {
    solution: { solutions: [] },
    providerId: null,
    model: null,
  }
  const assessmentVisualEvidence = await assessmentVisualEvidencePromise
  let audit = withCompleteCategoryCoverage({
    assessment: auditRepair.response.audit,
    targetQuestionIds: params.targetQuestionIds,
    includeShared: params.includeSharedAssessment,
  })
  audit = enforceUnreviewableVisuals({
    assessment: audit,
    unavailable: assessmentVisualEvidence.availability,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeShared: params.includeSharedAssessment,
  })
  return {
    audit,
    repair: auditRepair.response.repair,
    blindSolution: blindSolution.solution,
    blindProviderId: blindSolution.providerId,
    blindModel: blindSolution.model,
    auditProviderId: auditRepair.providerId,
    auditModel: auditRepair.model,
    assessmentProviderId: auditRepair.providerId,
    assessmentModel: auditRepair.model,
  }
}

/**
 * Shared assessment seam for durable saved-stem jobs and ephemeral bulk-import
 * drafts. Persistence and queue ownership deliberately stay with the caller.
 */
export async function assessUcatQuestionSnapshot(params: {
  client: SupabaseClient<Database>
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeSharedAssessment: boolean
  formatChecks: UcatFormatCheck[]
  blindSolverModelProfileId: string | null
  assessmentModelProfileId: string | null
  existingBlindSolution?: unknown
  metadata?: Record<string, unknown>
  signal?: AbortSignal
  providerSort?: 'price' | 'throughput' | 'latency'
}): Promise<UcatSnapshotAssessmentResult> {
  const assessmentVisualEvidencePromise = buildVisualEvidence({
    client: params.client,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeExplanations: true,
  })
  const availableQuestionTagsPromise = loadAvailableQuestionTags(
    params.client,
    params.snapshot.sectionId,
  )
  let blindSolution = reusableBlindSolutionForScope({
    existing: params.existingBlindSolution,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
  })
  let blindProviderId: string | null = null
  let blindModel: string | null = null

  if (!blindSolution) {
    const blindVisualEvidence = await buildVisualEvidence({
      client: params.client,
      snapshot: params.snapshot,
      targetQuestionIds: params.targetQuestionIds,
      includeExplanations: false,
    })
    const blindPrompt = buildBlindSolverUserPrompt({
      snapshot: params.snapshot,
      targetQuestionIds: params.targetQuestionIds,
      visualAvailability: blindVisualEvidence.availability,
    })
    const blindResult = await runWithStructuredOutputRetry(async (retry) => {
      const attemptedPrompt = promptWithStructuredOutputRetry(blindPrompt, retry)
      const call = await callUcatAiJson({
        client: params.client,
        operation: 'question_assessment_blind_solve',
        modelProfileId: params.blindSolverModelProfileId,
        systemPrompt: BLIND_SOLVER_SYSTEM_PROMPT,
        userPrompt: attemptedPrompt,
        userContentParts: [
          { type: 'text', text: attemptedPrompt },
          ...blindVisualEvidence.parts,
        ],
        temperature: 0,
        maxCompletionTokens: 4_000,
        timeoutMs: 180_000,
        providerSort: params.providerSort ?? 'throughput',
        reasoningEffort: 'medium',
        metadata: {
          ...(params.metadata ?? {}),
          structuredOutputAttempt: retry.attempt,
        } as Json,
        signal: params.signal,
      })
      const solution = normalizeBlindSolutionSelections(
        BlindSolutionResponseSchema.parse(call.parsed),
        params.snapshot,
      )
      assertBlindSolutionTargets({
        solution,
        snapshot: params.snapshot,
        targetQuestionIds: params.targetQuestionIds,
      })
      return { call, solution }
    })
    blindSolution = blindResult.solution
    blindProviderId = blindResult.call.providerId
    blindModel = blindResult.call.model
  }
  assertBlindSolutionTargets({
    solution: blindSolution,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
  })

  const [assessmentVisualEvidence, availableQuestionTags] = await Promise.all([
    assessmentVisualEvidencePromise,
    availableQuestionTagsPromise,
  ])
  const assessmentPrompt = buildAssessmentUserPrompt({
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeSharedAssessment: params.includeSharedAssessment,
    blindSolution,
    formatChecks: params.formatChecks,
    availableQuestionTags,
    visualAvailability: assessmentVisualEvidence.availability,
  })
  const assessmentResult = await runWithStructuredOutputRetry(async (retry) => {
    const attemptedPrompt = promptWithStructuredOutputRetry(assessmentPrompt, retry)
    const call = await callUcatAiJson({
      client: params.client,
      operation: 'question_assessment_moderate',
      modelProfileId: params.assessmentModelProfileId,
      systemPrompt: ASSESSMENT_SYSTEM_PROMPT,
      userPrompt: attemptedPrompt,
      userContentParts: [
        { type: 'text', text: attemptedPrompt },
        ...assessmentVisualEvidence.parts,
      ],
      temperature: 0,
      maxCompletionTokens: 8_000 + (retry.attempt * 2_000),
      timeoutMs: 240_000,
      providerSort: params.providerSort ?? 'throughput',
      reasoningEffort: 'medium',
      metadata: {
        ...(params.metadata ?? {}),
        structuredOutputAttempt: retry.attempt,
      } as Json,
      signal: params.signal,
    })
    const response = normalizeDuplicateAssessmentFindingKeys(
      UcatAssessmentResponseSchema.parse(call.parsed),
    )
    assertAssessmentTargets({
      assessment: response,
      snapshot: params.snapshot,
      targetQuestionIds: params.targetQuestionIds,
      includeShared: params.includeSharedAssessment,
    })
    return { call, response }
  })
  let assessment = assessmentResult.response
  assessment = withCompleteCategoryCoverage({
    assessment,
    targetQuestionIds: params.targetQuestionIds,
    includeShared: params.includeSharedAssessment,
  })
  assessment = enforceUnreviewableVisuals({
    assessment,
    unavailable: assessmentVisualEvidence.availability,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeShared: params.includeSharedAssessment,
  })
  assessment = bindAssessmentSetTextBeforesToSnapshot(assessment, params.snapshot)
  return {
    assessment,
    blindSolution,
    blindProviderId,
    blindModel,
    assessmentProviderId: assessmentResult.call.providerId,
    assessmentModel: assessmentResult.call.model,
  }
}

async function currentSnapshotForRun(
  client: SupabaseClient<Database>,
  run: RunRow,
): Promise<UcatAssessmentSnapshot | null> {
  const [snapshot, cycleResult] = await Promise.all([
    loadUcatAssessmentSnapshot(client, run.stem_id),
    asAny(client)
      .from('ucat_ai_question_assessment_cycles')
      .select('is_current')
      .eq('id', run.cycle_id)
      .maybeSingle(),
  ])
  if (!snapshot || cycleResult.error || cycleResult.data?.is_current !== true) return null
  return fingerprintUcatAssessmentSnapshot(snapshot).content === run.content_fingerprint ? snapshot : null
}

async function notifyCriticalAfterPublication(params: {
  client: SupabaseClient<Database>
  run: RunRow
  assessment: UcatAssessmentResponse
}) {
  if (!params.assessment.findings.some((finding) => finding.rating === 'critical')) return
  const { data: stem, error } = await asAny(params.client)
    .from('question_stems')
    .select('status,status_changed_at,status_changed_by')
    .eq('id', params.run.stem_id)
    .maybeSingle()
  if (error || stem?.status !== 'published' || !stem.status_changed_by || !stem.status_changed_at) return
  if (new Date(stem.status_changed_at) <= new Date(params.run.requested_at)) return

  await asAny(params.client).from('notifications').upsert({
    staff_id: stem.status_changed_by,
    notification_type: 'ucat.ai_assessment.critical_after_publish',
    app_scope: 'staff_web',
    title: 'AI review found a critical concern',
    body: 'A background AI review found a critical concern in a question that was published while the review was running.',
    action_url: `/ucat/questions/${params.run.stem_id}?aiReview=1`,
    dedupe_key: `ucat-ai-assessment-critical:${params.run.id}`,
    priority: 'critical',
    read_at: null,
    dismissed_at: null,
    metadata: {
      assessmentRunId: params.run.id,
      stemId: params.run.stem_id,
    },
  }, { onConflict: 'dedupe_key' })
}

export async function runBackgroundUcatQuestionAssessment(
  input: { runId: string },
): Promise<{ runId: string; status: string }> {
  const admin = getServiceRoleClient()
  const { data, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('*')
    .eq('id', input.runId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('UCAT AI assessment run not found')
  const run = data as RunRow
  try {
    return await runBackgroundUcatQuestionAssessmentInner(admin, run)
  } finally {
    await syncUcatCatalogAiReviewStatusesBestEffort(admin, [run.stem_id])
  }
}

async function runBackgroundUcatQuestionAssessmentInner(
  admin: SupabaseClient<Database>,
  run: RunRow,
): Promise<{ runId: string; status: string }> {
  if (['completed', 'superseded', 'format_blocked'].includes(run.status)) {
    return { runId: run.id, status: run.status }
  }

  const runningIsStale = run.status === 'running'
    && (!run.started_at || Date.now() - new Date(run.started_at).getTime() > 9 * 60_000)
  if (run.status === 'running' && !runningIsStale) {
    return { runId: run.id, status: 'running' }
  }

  const startedAt = new Date().toISOString()
  const { data: claimed, error: runningError } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .update({
      status: 'running',
      attempt_count: (run.attempt_count ?? 0) + 1,
      started_at: startedAt,
      completed_at: null,
      error_message: null,
    })
    .eq('id', run.id)
    .eq('attempt_count', run.attempt_count ?? 0)
    .select('id')
    .maybeSingle()
  if (runningError) throw runningError
  if (!claimed?.id) return { runId: run.id, status: 'running' }

  const snapshot = await currentSnapshotForRun(admin, run)
  if (!snapshot) {
    await asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .update({ status: 'superseded', completed_at: new Date().toISOString() })
      .eq('id', run.id)
    return { runId: run.id, status: 'superseded' }
  }

  const targetQuestionIds = run.target_question_ids.filter((id) => snapshot.questions.some((question) => question.id === id))
  if (targetQuestionIds.length === 0) throw new Error('Assessment run has no current target questions')
  const includeSharedAssessment = run.scope_type === 'full'
  const formatChecks = UcatFormatCheckSchema.array().parse(run.format_checks ?? [])

  try {
    const { runVerifiedBackgroundAssessment } = await import('./verified-background-repair')
    const result = await runVerifiedBackgroundAssessment({
      client: admin,
      runId: run.id,
      snapshot,
      targetQuestionIds,
      includeSharedAssessment,
      formatChecks,
      blindSolverModelProfileId: run.blind_solver_model_profile_id,
      assessmentModelProfileId: run.assessment_model_profile_id,
    })
    const currentSnapshot = await loadUcatAssessmentSnapshot(admin, run.stem_id)
    const finalFingerprints = fingerprintUcatAssessmentSnapshot(result.snapshot)
    if (!currentSnapshot
      || fingerprintUcatAssessmentSnapshot(currentSnapshot).content !== finalFingerprints.content) {
      await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .update({ status: 'superseded', completed_at: new Date().toISOString() })
        .eq('id', run.id)
      return { runId: run.id, status: 'superseded' }
    }

    const { error: completionError } = await asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .update({
        status: 'completed',
        content_fingerprint: finalFingerprints.content,
        shared_fingerprint: finalFingerprints.shared,
        question_fingerprints: finalFingerprints.questions,
        content_snapshot: compactUcatAssessmentSnapshot(result.snapshot) as unknown as Json,
        format_checks: runUcatFormatChecks(result.snapshot) as unknown as Json,
        blind_solution: result.blindSolution as unknown as Json,
        blind_solver_provider_id: result.blindProviderId,
        blind_solver_model: result.blindModel,
        assessment_result: result.assessment as unknown as Json,
        assessment_provider_id: result.assessmentProviderId,
        assessment_model: result.assessmentModel,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', run.id)
    if (completionError) throw completionError
    await notifyCriticalAfterPublication({ client: admin, run, assessment: result.assessment })
    return { runId: run.id, status: 'completed' }
  } catch (error) {
    if (error instanceof Error && error.name === 'VerifiedAssessmentRepairStaleError') {
      await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .update({ status: 'superseded', completed_at: new Date().toISOString() })
        .eq('id', run.id)
      return { runId: run.id, status: 'superseded' }
    }
    if (error instanceof UcatAiBudgetExceededError) {
      const { error: deferError } = await asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .update({
          status: 'deferred',
          deferred_until: error.resetAt.toISOString(),
          error_message: error.message,
          queue_message_id: null,
        })
        .eq('id', run.id)
      if (deferError) throw deferError
      return { runId: run.id, status: 'deferred' }
    }
    throw error
  }
}
