import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BlindSolutionResponse,
  UcatAssessmentPatch,
  UcatAssessmentResponse,
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import { buildDraftUcatAssessmentSnapshot } from './draft-snapshot'
import {
  prepareBulkImportVerificationCandidate,
  reconcileBulkImportAiReview,
} from './bulk-import-pipeline'
import {
  assessUcatQuestionSnapshot,
  blindSolveUcatSnapshot,
  repairBulkImportUcatSnapshot,
} from './run-background-assessment'
import { loadUcatAssessmentSnapshot } from './content'
import { runUcatFormatChecks } from './format-checks'

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

export class VerifiedAssessmentRepairStaleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VerifiedAssessmentRepairStaleError'
  }
}

function snapshotToFormValues(snapshot: UcatAssessmentSnapshot): UcatQuestionStemFormValues {
  return {
    sectionId: snapshot.sectionId,
    categoryId: snapshot.categoryId,
    stemText: snapshot.stemText,
    accessScope: snapshot.accessScope,
    status: snapshot.status,
    tutorSourceNote: snapshot.tutorSourceNote ?? null,
    questions: snapshot.questions.map((question) => ({
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: question.answerExplanation,
      difficulty: question.difficulty,
      timeBurdenSeconds: question.timeBurdenSeconds == null
        ? null
        : String(question.timeBurdenSeconds),
      tagIds: question.tagIds,
      sourceChannel: question.sourceChannel ?? snapshot.sourceChannel ?? null,
      aiGenerationMetadata: question.aiGenerationMetadata ?? null,
      options: question.options.map((option) => ({
        id: option.id,
        answerText: option.answerText,
        answerExplanation: option.answerExplanation,
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

function snapshotWithValues(
  original: UcatAssessmentSnapshot,
  values: UcatQuestionStemFormValues,
): UcatAssessmentSnapshot {
  const tagNamesById = new Map(
    original.questions.flatMap((question) => question.tagIds.map((id, index) => [
      id,
      question.tagNames[index] ?? id,
    ] as const)),
  )
  return {
    ...buildDraftUcatAssessmentSnapshot({
      stemId: original.stemId,
      values,
      sectionName: original.sectionName,
      sectionNumber: original.sectionNumber,
      displayColumns: original.displayColumns,
      categoryName: original.categoryName,
      tagNamesById,
    }),
    status: original.status,
    sourceChannel: original.sourceChannel,
    statusChangedAt: original.statusChangedAt,
    statusChangedBy: original.statusChangedBy,
    updatedBy: original.updatedBy,
    updatedAt: original.updatedAt,
    tutorSourceNote: original.tutorSourceNote,
  }
}

function contentSnapshot(
  values: UcatQuestionStemFormValues,
  knownQuestionIds?: ReadonlySet<string>,
  knownOptionIds?: ReadonlySet<string>,
): Record<string, unknown> {
  return {
    sectionId: values.sectionId,
    categoryId: values.categoryId ?? null,
    stemText: values.stemText,
    accessScope: values.accessScope,
    tutorSourceNote: values.tutorSourceNote ?? null,
    questions: values.questions.map((question, questionIndex) => ({
      id: !knownQuestionIds || (question.id && knownQuestionIds.has(question.id))
        ? question.id ?? null
        : null,
      index: questionIndex + 1,
      question_text: question.questionText,
      answer_explanation: question.answerExplanation ?? null,
      difficulty: question.difficulty ?? null,
      time_burden_seconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
      question_type: question.questionType,
      source_channel: question.sourceChannel ?? null,
      ai_generation_metadata: question.aiGenerationMetadata ?? null,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option, optionIndex) => ({
        id: !knownOptionIds || (option.id && knownOptionIds.has(option.id))
          ? option.id ?? null
          : null,
        index: optionIndex + 1,
        answer_text: option.answerText,
        answer_explanation: option.answerExplanation ?? null,
        is_answer: option.isAnswer,
      })),
    })) as unknown as Json,
  }
}

async function applyVerifiedRepair(params: {
  client: SupabaseClient<Database>
  runId: string
  snapshot: UcatAssessmentSnapshot
  before: UcatQuestionStemFormValues
  after: UcatQuestionStemFormValues
  appliedRepairs: string[]
  findingKeys: string[]
}): Promise<void> {
  if (!params.snapshot.updatedAt) {
    throw new Error('The saved stem revision is unavailable for verified repair.')
  }
  const knownQuestionIds = new Set(params.snapshot.questions.map((question) => question.id))
  const knownOptionIds = new Set(
    params.snapshot.questions.flatMap((question) => question.options.map((option) => option.id)),
  )
  const operations = [{
    type: 'verified_assessment_repair',
    assessmentRunId: params.runId,
    repairs: params.appliedRepairs,
  }]
  const findingRefs = params.findingKeys.map((findingKey) => ({
    assessmentRunId: params.runId,
    findingKey,
    appliedExactSuggestion: true,
  }))
  const rpc = params.client as unknown as RpcClient
  const { error } = await rpc.rpc('service_ucat_apply_verified_assessment_repair', {
    p_run_id: params.runId,
    p_expected_updated_at: params.snapshot.updatedAt,
    p_base_snapshot: contentSnapshot(params.before),
    p_proposed_snapshot: contentSnapshot(
      params.after,
      knownQuestionIds,
      knownOptionIds,
    ),
    p_operations: operations,
    p_summary: params.appliedRepairs.join(' ') || 'Applied verified AI assessment repair.',
    p_rationale: 'The background reviewer proposed a bounded repair and the patch-specific verifier confirmed it was safe to apply.',
    p_finding_refs: findingRefs,
  })
  if (!error) return
  if (error.message.includes('assessment_repair_stale_revision')
    || error.message.includes('assessment_repair_run_not_current')) {
    throw new VerifiedAssessmentRepairStaleError(error.message)
  }
  throw new Error(error.message)
}

export type VerifiedBackgroundAssessmentResult = {
  snapshot: UcatAssessmentSnapshot
  assessment: UcatAssessmentResponse
  blindSolution: BlindSolutionResponse
  blindProviderId: string | null
  blindModel: string | null
  assessmentProviderId: string | null
  assessmentModel: string
  appliedRepairs: string[]
}

function patchQuestionId(
  patch: UcatAssessmentPatch,
  snapshot: UcatAssessmentSnapshot,
): string | null {
  if ('questionId' in patch) return patch.questionId
  if ('target' in patch && patch.target.id) {
    if (patch.target.kind === 'question') return patch.target.id
    if (patch.target.kind === 'option') {
      return snapshot.questions.find((question) => (
        question.options.some((option) => option.id === patch.target.id)
      ))?.id ?? null
    }
  }
  if (patch.operation === 'set_metadata' && patch.targetKind === 'question') return patch.targetId
  return null
}

/**
 * Saved-content automation is deliberately narrower than interactive authoring.
 * A patch must either be independently verified answer correction, or directly
 * address one of the deterministic readiness failures captured for this run.
 */
export function backgroundRepairPatchAllowed(params: {
  patch: UcatAssessmentPatch
  snapshot: UcatAssessmentSnapshot
  formatChecks: UcatFormatCheck[]
}): boolean {
  const patch = params.patch
  if (patch.operation === 'set_answer_key' || patch.operation === 'replace_option_and_key') {
    return true
  }
  const questionId = patchQuestionId(patch, params.snapshot)
  if (patch.operation === 'set_metadata' && patch.targetKind === 'question') {
    const question = params.snapshot.questions.find((item) => item.id === patch.targetId)
    if (!question) return false
    if (patch.field === 'difficulty') {
      return (question.difficulty == null || question.difficulty === 0)
        && typeof patch.after === 'number'
        && patch.after > 0
        && patch.after <= 1
    }
    if (patch.field === 'time_burden_seconds') {
      return (question.timeBurdenSeconds == null || question.timeBurdenSeconds <= 0)
        && typeof patch.after === 'number'
        && Number.isInteger(patch.after)
        && patch.after > 0
    }
    if (patch.field === 'tag_ids') {
      return question.tagIds.length === 0
        && Array.isArray(patch.after)
        && patch.after.length > 0
        && patch.after.every((tagId) => typeof tagId === 'string')
    }
  }
  const relevantCodes = params.formatChecks
    .filter((check) => check.severity === 'error')
    .filter((check) => questionId
      ? check.questionId === questionId
      : check.scopeType === 'shared')
    .map((check) => check.code)
  if (relevantCodes.length === 0) return false
  if (patch.operation === 'set_text' && patch.target.field === 'answer_explanation') {
    return relevantCodes.some((code) => code.includes('missing_') && code.includes('explanation'))
  }
  if (patch.operation === 'insert_option'
    || patch.operation === 'remove_option'
    || patch.operation === 'reorder_options') {
    return relevantCodes.some((code) => code.includes('option'))
  }
  if (patch.operation === 'replace_text' || patch.operation === 'set_rich_content') {
    return relevantCodes.includes('literal_rich_text_syntax')
      || relevantCodes.some((code) => code.includes('instruction'))
  }
  if (patch.operation === 'set_text' && patch.target.field === 'question_text') {
    return relevantCodes.some((code) => code.includes('instruction'))
  }
  if (patch.operation === 'set_metadata') {
    return (patch.field === 'category_id' && relevantCodes.some((code) => code.includes('category')))
      || (patch.field === 'question_type' && relevantCodes.some((code) => code.includes('question_type')))
  }
  return false
}

export async function runVerifiedBackgroundAssessment(params: {
  client: SupabaseClient<Database>
  runId: string
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeSharedAssessment: boolean
  formatChecks: UcatFormatCheck[]
  blindSolverModelProfileId: string | null
  assessmentModelProfileId: string | null
}): Promise<VerifiedBackgroundAssessmentResult> {
  const values = snapshotToFormValues(params.snapshot)
  const repairResult = await repairBulkImportUcatSnapshot({
    client: params.client,
    snapshot: params.snapshot,
    targetQuestionIds: params.targetQuestionIds,
    includeSharedAssessment: params.includeSharedAssessment,
    formatChecks: params.formatChecks,
    blindSolverModelProfileId: params.blindSolverModelProfileId,
    assessmentModelProfileId: params.assessmentModelProfileId,
    providerSort: 'throughput',
    deferBlindSolve: true,
    metadata: {
      assessmentRunId: params.runId,
      stemId: params.snapshot.stemId,
      verifiedBackgroundRepair: true,
    },
  })
  const repair = {
    ...repairResult.repair,
    repairs: repairResult.repair.repairs.flatMap((candidate) => {
      const patches = candidate.patches.filter((patch) => backgroundRepairPatchAllowed({
        patch,
        snapshot: params.snapshot,
        formatChecks: params.formatChecks,
      }))
      if (patches.length === 0) return []
      return [{
        ...candidate,
        patches,
        resolvedFindingKeys: patches.length === candidate.patches.length
          ? candidate.resolvedFindingKeys
          : [],
      }]
    }),
  }
  const verificationCandidate = await prepareBulkImportVerificationCandidate({
    values,
    audit: repairResult.audit,
    repair,
  })
  let verificationSolution = repairResult.blindSolution
  let blindProviderId = repairResult.blindProviderId
  let blindModel = repairResult.blindModel
  if (verificationCandidate.questionIds.length > 0) {
    const candidateSnapshot = snapshotWithValues(params.snapshot, verificationCandidate.values)
    const verified = await blindSolveUcatSnapshot({
      client: params.client,
      snapshot: candidateSnapshot,
      targetQuestionIds: verificationCandidate.questionIds,
      blindSolverModelProfileId: params.blindSolverModelProfileId,
      providerSort: 'throughput',
      metadata: {
        assessmentRunId: params.runId,
        stemId: params.snapshot.stemId,
        verifiedBackgroundRepairCandidate: true,
      },
    })
    verificationSolution = verified.solution
    blindProviderId = verified.providerId
    blindModel = verified.model
  }
  const reconciled = await reconcileBulkImportAiReview({
    values,
    audit: repairResult.audit,
    repair,
    blindSolution: verificationSolution,
    preverifiedSemanticBlindSolution: verificationSolution,
  })
  const changed = JSON.stringify(reconciled.values) !== JSON.stringify(values)
  if (!changed) {
    return {
      snapshot: params.snapshot,
      assessment: reconciled.assessment,
      blindSolution: reconciled.blindSolution,
      blindProviderId,
      blindModel,
      assessmentProviderId: repairResult.assessmentProviderId,
      assessmentModel: repairResult.assessmentModel,
      appliedRepairs: [],
    }
  }

  const appliedRepairSet = new Set(reconciled.appliedRepairs)
  const findingKeys = repair.repairs
    .filter((repair) => appliedRepairSet.has(repair.summary))
    .flatMap((repair) => repair.resolvedFindingKeys)
  await applyVerifiedRepair({
    client: params.client,
    runId: params.runId,
    snapshot: params.snapshot,
    before: values,
    after: reconciled.values,
    appliedRepairs: reconciled.appliedRepairs,
    findingKeys,
  })
  const savedSnapshot = await loadUcatAssessmentSnapshot(params.client, params.snapshot.stemId)
  if (!savedSnapshot) throw new Error('The repaired stem could not be reloaded.')

  // Keep the same durable run, but assess the saved post-repair revision so the
  // tutor never opens a review whose findings describe the pre-repair content.
  const finalTargetQuestionIds = savedSnapshot.questions
    .filter((question) => params.targetQuestionIds.includes(question.id))
    .map((question) => question.id)
  const finalAssessment = await assessUcatQuestionSnapshot({
    client: params.client,
    snapshot: savedSnapshot,
    targetQuestionIds: finalTargetQuestionIds,
    includeSharedAssessment: params.includeSharedAssessment,
    formatChecks: runUcatFormatChecks(savedSnapshot),
    blindSolverModelProfileId: params.blindSolverModelProfileId,
    assessmentModelProfileId: params.assessmentModelProfileId,
    providerSort: 'throughput',
    metadata: {
      assessmentRunId: params.runId,
      stemId: params.snapshot.stemId,
      postVerifiedRepairAssessment: true,
    },
  })
  return {
    snapshot: savedSnapshot,
    assessment: finalAssessment.assessment,
    blindSolution: finalAssessment.blindSolution,
    blindProviderId: finalAssessment.blindProviderId,
    blindModel: finalAssessment.blindModel,
    assessmentProviderId: finalAssessment.assessmentProviderId,
    assessmentModel: finalAssessment.assessmentModel,
    appliedRepairs: reconciled.appliedRepairs,
  }
}
