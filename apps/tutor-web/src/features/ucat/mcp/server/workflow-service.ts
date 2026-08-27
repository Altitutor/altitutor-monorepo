import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyLearningModuleOperations,
  applyMockOperations,
  applyQuestionSetOperations,
  applyQuestionStemOperations,
  learningModuleDraftFromDetail,
  mockDraftFromDetail,
  questionSetDraftFromDetail,
  questionStemDraftFromDetail,
  toStemRpcQuestions,
  type LearningModuleDraft,
  type MockDraft,
  type QuestionSetDraft,
  type QuestionStemDraft,
} from '@/features/ucat/mcp/server/operations'
import type {
  AuditSelector,
  AuditTarget,
  AssessmentFindingRef,
  LearningModuleOperation,
  MockOperation,
  QuestionSetOperation,
  QuestionStemOperation,
} from '@/features/ucat/mcp/server/schemas'
import { decodeAuthoringRevision } from '@/features/ucat/mcp/server/revision'
import {
  getUcatMcpAggregate,
  getUcatMcpAggregates,
  getUcatMcpAiAssessment,
  updateUcatMcpLearningModule,
  updateUcatMcpMock,
  updateUcatMcpQuestionSet,
  updateUcatMcpQuestionStem,
  type UcatMcpAggregateType,
} from '@/features/ucat/mcp/server/service'
import {
  isUcatVisibilityBlockedError,
  ucatVisibilityBlockedFallbackMessage,
} from '@/features/ucat/shared/lifecycle-errors'
import { UcatAssessmentResponseSchema } from '@/features/ucat/questions/lib/ai-assessment/schema'
import { applyUcatAssessmentPatches } from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
import {
  formValuesToStemBundlePayload,
  stemDetailToFormValues,
} from '@/features/ucat/questions/lib/stem-editor-form'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { GeneratedContentBlockSchema } from '@/features/ucat/questions/lib/ai-generation/schema'
import { generatedVisualBlockToImageNodeServer } from '@/features/ucat/questions/lib/ai-generation/server-content-blocks'
import { enqueueUcatQuestionAssessmentPreparation } from '@/features/ucat/questions/server/ai-assessment/dispatcher'

type RpcResult = {
  data: unknown
  error: { message: string } | null
}

type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>
}

type ChangeSource = 'interactive_agent' | 'audit_run' | 'assessment' | 'recovery'
type ChangeOperation =
  | QuestionStemOperation
  | QuestionSetOperation
  | MockOperation
  | LearningModuleOperation

export type ChangeMetadata = {
  summary: string
  rationale?: string | null
  auditRunId?: string | null
  findingRefs?: AssessmentFindingRef[]
}

type PreparedChange = {
  baseSnapshot: Record<string, unknown>
  proposedSnapshot: Record<string, unknown>
}

type ChangeEffect =
  | { effect: 'applied'; aggregate: Record<string, unknown> }
  | { effect: 'staged'; changeId: string; change: Record<string, unknown> }

function isPublishedContentWriteError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes('Published content requires')
    || error.message.includes('live Learn folder requires')
}

async function applyEditableOrStage(input: {
  applyEditable: () => Promise<Record<string, unknown>>
  stagePublished: () => Promise<Record<string, unknown>>
}): Promise<ChangeEffect> {
  try {
    return { effect: 'applied', aggregate: await input.applyEditable() }
  } catch (error) {
    if (!isPublishedContentWriteError(error)) throw error
    const change = await input.stagePublished()
    if (typeof change.id !== 'string') {
      throw new Error('Published content change did not return an id')
    }
    return { effect: 'staged', changeId: change.id, change }
  }
}

type ChangeRow = {
  id: string
  target_type: UcatMcpAggregateType
  target_id: string
  status: 'pending' | 'applied' | 'rejected' | 'stale'
  source: ChangeSource
  audit_run_id: string | null
  base_revision: string
  resulting_revision: string | null
  base_snapshot: Record<string, unknown>
  proposed_snapshot: Record<string, unknown>
  operations: ChangeOperation[]
  summary: string
  rationale: string | null
  finding_refs: AssessmentFindingRef[]
  reverse_of_change_id: string | null
}

function rpcClient(client: SupabaseClient<Database>): RpcClient {
  return client as unknown as RpcClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} returned an invalid response`)
  return value
}

async function callRpc(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await rpcClient(client).rpc(name, args)
  if (error) {
    if (error.message.includes('mcp_stale_revision')) {
      throw new Error('The authoring revision is stale. Re-read the aggregate and retry.')
    }
    if (error.message.includes('audit_run_not_authorized_to_apply')) {
      throw new Error('This audit run is not authorised to apply published changes.')
    }
    if (isUcatVisibilityBlockedError(error.message)) {
      throw new Error(ucatVisibilityBlockedFallbackMessage(error.message))
    }
    throw new Error(error.message)
  }
  return requireRecord(data, name)
}

function stemSnapshot(draft: QuestionStemDraft): Record<string, unknown> {
  return {
    sectionId: draft.sectionId,
    categoryId: draft.categoryId,
    stemText: draft.stemText,
    accessScope: draft.accessScope,
    tutorSourceNote: draft.tutorSourceNote,
    questions: toStemRpcQuestions(draft),
  }
}

function setSnapshot(draft: QuestionSetDraft): Record<string, unknown> {
  return {
    name: draft.name,
    description: draft.description,
    timeLimitSeconds: draft.timeLimitSeconds,
    accessScope: draft.accessScope,
    sectionId: draft.sectionId,
    stemIds: draft.stemIds,
  }
}

function mockSnapshot(draft: MockDraft): Record<string, unknown> {
  return {
    name: draft.name,
    instructionsText: draft.instructionsText,
    accessScope: draft.accessScope,
    setIds: draft.setIds,
  }
}

function learningModuleSnapshot(draft: LearningModuleDraft): Record<string, unknown> {
  return {
    kind: draft.kind,
    title: draft.title,
    description: draft.description,
    sectionId: draft.sectionId,
    parentId: draft.parentId,
    index: draft.index,
    accessScope: draft.accessScope,
    iconKey: draft.iconKey,
    estimatedMinutes: draft.estimatedMinutes,
    studyPlanPriority: draft.studyPlanPriority,
    studyPlanCategoryIds: draft.studyPlanCategoryIds,
    studyPlanTagIds: draft.studyPlanTagIds,
    blocks: draft.blocks as unknown as Json,
  }
}

async function prepareChange(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  operations: ChangeOperation[],
): Promise<PreparedChange> {
  const current = await getUcatMcpAggregate(client, contentType, id)
  if (contentType === 'stem') {
    const before = questionStemDraftFromDetail(current)
    const after = applyQuestionStemOperations(before, operations as QuestionStemOperation[])
    return { baseSnapshot: stemSnapshot(before), proposedSnapshot: stemSnapshot(after) }
  }
  if (contentType === 'set') {
    const before = questionSetDraftFromDetail(current)
    const after = applyQuestionSetOperations(before, operations as QuestionSetOperation[])
    return { baseSnapshot: setSnapshot(before), proposedSnapshot: setSnapshot(after) }
  }
  if (contentType === 'mock') {
    const before = mockDraftFromDetail(current)
    const after = applyMockOperations(before, operations as MockOperation[])
    return { baseSnapshot: mockSnapshot(before), proposedSnapshot: mockSnapshot(after) }
  }
  const rawBlocks = Array.isArray(current.blocks) ? current.blocks : []
  const before = learningModuleDraftFromDetail(current, rawBlocks)
  const after = applyLearningModuleOperations(before, operations as LearningModuleOperation[])
  return {
    baseSnapshot: learningModuleSnapshot(before),
    proposedSnapshot: learningModuleSnapshot(after),
  }
}

function changeArgs(input: {
  changeId?: string | null
  contentType: UcatMcpAggregateType
  id: string
  revision: string
  prepared: PreparedChange
  operations: ChangeOperation[]
  metadata: ChangeMetadata
  source: ChangeSource
  reverseOfChangeId?: string | null
}) {
  return {
    p_existing_change_id: input.changeId ?? null,
    p_target_type: input.contentType,
    p_target_id: input.id,
    p_expected_updated_at: decodeAuthoringRevision(input.revision, input.id),
    p_base_snapshot: input.prepared.baseSnapshot,
    p_proposed_snapshot: input.prepared.proposedSnapshot,
    p_operations: input.operations,
    p_summary: input.metadata.summary,
    p_rationale: input.metadata.rationale ?? null,
    p_source: input.source,
    p_audit_run_id: input.metadata.auditRunId ?? null,
    p_finding_refs: input.metadata.findingRefs ?? [],
    p_reverse_of_change_id: input.reverseOfChangeId ?? null,
  }
}

export async function applyUcatMcpPublishedOperations(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
  operations: ChangeOperation[],
  metadata: ChangeMetadata,
): Promise<Record<string, unknown>> {
  const prepared = await prepareChange(client, contentType, id, operations)
  const source: ChangeSource = metadata.auditRunId ? 'audit_run' : 'interactive_agent'
  const result = await callRpc(client, 'tutor_ucat_mcp_apply_content_change', changeArgs({
    contentType,
    id,
    revision,
    prepared,
    operations,
    metadata,
    source,
  }))
  if (contentType === 'stem') {
    await requestAssessmentAfterStemChange(id)
  }
  return {
    ...await getUcatMcpAggregate(client, contentType, id),
    changeId: result.changeId,
  }
}

async function requestAssessmentAfterStemChange(
  stemId: string,
): Promise<void> {
  await enqueueUcatQuestionAssessmentPreparation({
    stemIds: [stemId],
    triggerKind: 'content_change',
  }).catch((error) => {
    console.error('Could not request UCAT AI assessment after MCP published stem update', error)
  })
}

export async function proposeUcatMcpContentChange(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
  operations: ChangeOperation[],
  metadata: ChangeMetadata,
): Promise<Record<string, unknown>> {
  const prepared = await prepareChange(client, contentType, id, operations)
  return callRpc(client, 'tutor_ucat_mcp_create_content_change', {
    p_target_type: contentType,
    p_target_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_base_snapshot: prepared.baseSnapshot,
    p_proposed_snapshot: prepared.proposedSnapshot,
    p_operations: operations,
    p_summary: metadata.summary,
    p_rationale: metadata.rationale ?? null,
    p_source: metadata.auditRunId ? 'audit_run' : 'interactive_agent',
    p_audit_run_id: metadata.auditRunId ?? null,
    p_finding_refs: metadata.findingRefs ?? [],
    p_reverse_of_change_id: null,
  })
}

export async function changeUcatMcpQuestionStem(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: QuestionStemOperation[],
  metadata: ChangeMetadata,
): Promise<ChangeEffect> {
  return applyEditableOrStage({
    applyEditable: () => updateUcatMcpQuestionStem(client, id, revision, operations),
    stagePublished: () => proposeUcatMcpContentChange(
      client,
      'stem',
      id,
      revision,
      operations,
      metadata,
    ),
  })
}

export async function changeUcatMcpQuestionSet(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: QuestionSetOperation[],
  metadata: ChangeMetadata,
): Promise<ChangeEffect> {
  return applyEditableOrStage({
    applyEditable: () => updateUcatMcpQuestionSet(client, id, revision, operations),
    stagePublished: () => proposeUcatMcpContentChange(
      client,
      'set',
      id,
      revision,
      operations,
      metadata,
    ),
  })
}

export async function changeUcatMcpMock(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: MockOperation[],
  metadata: ChangeMetadata,
): Promise<ChangeEffect> {
  return applyEditableOrStage({
    applyEditable: () => updateUcatMcpMock(client, id, revision, operations),
    stagePublished: () => proposeUcatMcpContentChange(
      client,
      'mock',
      id,
      revision,
      operations,
      metadata,
    ),
  })
}

export async function changeUcatMcpLearningModule(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: LearningModuleOperation[],
  metadata: ChangeMetadata,
): Promise<ChangeEffect> {
  return applyEditableOrStage({
    applyEditable: () => updateUcatMcpLearningModule(client, id, revision, operations),
    stagePublished: () => proposeUcatMcpContentChange(
      client,
      'learning_module',
      id,
      revision,
      operations,
      metadata,
    ),
  })
}

export async function getUcatMcpContentChanges(
  client: SupabaseClient<Database>,
  filters: {
    changeId?: string
    contentType?: UcatMcpAggregateType
    targetId?: string
    auditRunId?: string
    status?: 'pending' | 'applied' | 'rejected' | 'stale'
    offset?: number
    limit?: number
  },
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_get_content_changes', {
    p_change_id: filters.changeId ?? null,
    p_target_type: filters.contentType ?? null,
    p_target_id: filters.targetId ?? null,
    p_audit_run_id: filters.auditRunId ?? null,
    p_status: filters.status ?? null,
    p_offset: filters.offset ?? 0,
    p_limit: filters.limit ?? 50,
  })
}

async function getChange(
  client: SupabaseClient<Database>,
  changeId: string,
): Promise<ChangeRow> {
  const result = await getUcatMcpContentChanges(client, { changeId, limit: 1 })
  const items = Array.isArray(result.items) ? result.items : []
  const row = items[0]
  if (!isRecord(row)) throw new Error('Content change not found')
  return row as unknown as ChangeRow
}

export async function applyUcatMcpPendingChange(
  client: SupabaseClient<Database>,
  changeId: string,
): Promise<Record<string, unknown>> {
  const change = await getChange(client, changeId)
  if (change.status !== 'pending') throw new Error('Content change is not pending')
  const current = await getUcatMcpAggregate(client, change.target_type, change.target_id)
  const revision = typeof current.revision === 'string' ? current.revision : ''
  const result = await callRpc(client, 'tutor_ucat_mcp_apply_content_change', changeArgs({
    changeId,
    contentType: change.target_type,
    id: change.target_id,
    revision,
    prepared: {
      baseSnapshot: change.base_snapshot,
      proposedSnapshot: change.proposed_snapshot,
    },
    operations: change.operations,
    metadata: {
      summary: change.summary,
      rationale: change.rationale,
      auditRunId: change.audit_run_id,
      findingRefs: change.finding_refs,
    },
    source: change.source,
    reverseOfChangeId: change.reverse_of_change_id,
  }))
  if (change.target_type === 'stem') {
    await requestAssessmentAfterStemChange(change.target_id)
  }
  return {
    ...await getUcatMcpAggregate(client, change.target_type, change.target_id),
    changeId: result.changeId,
  }
}

export async function applyUcatMcpPendingChanges(
  client: SupabaseClient<Database>,
  changeIds: string[],
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown>[] = []
  for (const changeId of changeIds) {
    try {
      const result = await applyUcatMcpPendingChange(client, changeId)
      results.push({ changeId, status: 'applied', result })
    } catch (error) {
      results.push({
        changeId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Content change failed',
      })
    }
  }
  return {
    results,
    appliedCount: results.filter((result) => result.status === 'applied').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
  }
}

export async function rejectUcatMcpContentChange(
  client: SupabaseClient<Database>,
  changeId: string,
  reason?: string | null,
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_reject_content_change', {
    p_change_id: changeId,
    p_reason: reason ?? null,
  })
}

export async function restoreUcatMcpPublishedChange(
  client: SupabaseClient<Database>,
  changeId: string,
  summary: string,
  rationale?: string | null,
): Promise<Record<string, unknown>> {
  const original = await getChange(client, changeId)
  if (original.status !== 'applied' || !original.resulting_revision) {
    throw new Error('Only an applied content change can be restored')
  }
  const current = await getUcatMcpAggregate(client, original.target_type, original.target_id)
  const revision = typeof current.revision === 'string' ? current.revision : ''
  const currentPrepared = await prepareChange(client, original.target_type, original.target_id, [])
  const restorePrepared = {
    baseSnapshot: currentPrepared.baseSnapshot,
    proposedSnapshot: original.base_snapshot,
  }
  const operations = [{ type: 'restore_snapshot', changeId }] as unknown as ChangeOperation[]
  if (revision !== original.resulting_revision) {
    return callRpc(client, 'tutor_ucat_mcp_create_content_change', {
      p_target_type: original.target_type,
      p_target_id: original.target_id,
      p_expected_updated_at: decodeAuthoringRevision(revision, original.target_id),
      p_base_snapshot: restorePrepared.baseSnapshot,
      p_proposed_snapshot: restorePrepared.proposedSnapshot,
      p_operations: operations,
      p_summary: summary,
      p_rationale: rationale ?? null,
      p_source: 'recovery',
      p_audit_run_id: null,
      p_finding_refs: [],
      p_reverse_of_change_id: changeId,
    })
  }
  const result = await callRpc(client, 'tutor_ucat_mcp_apply_content_change', changeArgs({
    contentType: original.target_type,
    id: original.target_id,
    revision,
    prepared: restorePrepared,
    operations,
    metadata: { summary, rationale },
    source: 'recovery',
    reverseOfChangeId: changeId,
  }))
  return {
    ...await getUcatMcpAggregate(client, original.target_type, original.target_id),
    changeId: result.changeId,
  }
}

export async function createUcatMcpAuditRun(
  client: SupabaseClient<Database>,
  input: {
    idempotencyKey: string
    title: string
    brief?: string | null
    publishedWriteMode: 'proposal_only' | 'apply_valid_changes'
    selector: AuditSelector
    workflowId?: string | null
    workflowVersion?: string | null
  },
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_create_audit_run', {
    p_idempotency_key: input.idempotencyKey,
    p_title: input.title,
    p_brief: input.brief ?? null,
    p_published_write_mode: input.publishedWriteMode,
    p_selector: input.selector,
    p_workflow_id: input.workflowId ?? null,
    p_workflow_version: input.workflowVersion ?? null,
  })
}

export async function addUcatMcpAuditTargets(
  client: SupabaseClient<Database>,
  runId: string,
  targets: AuditTarget[],
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_add_audit_targets', {
    p_run_id: runId,
    p_targets: targets,
  })
}

export async function startUcatMcpAuditRun(
  client: SupabaseClient<Database>,
  runId: string,
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_start_audit_run', { p_run_id: runId })
}

export async function getUcatMcpAuditRun(
  client: SupabaseClient<Database>,
  runId: string,
  offset = 0,
  limit = 100,
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_get_audit_run', {
    p_run_id: runId,
    p_target_offset: offset,
    p_target_limit: limit,
  })
}

export async function listUcatMcpAuditRuns(
  client: SupabaseClient<Database>,
  input: {
    status?: 'selecting' | 'active' | 'completed' | 'cancelled'
    cursorCreatedAt?: string
    cursorId?: string
    limit?: number
  } = {},
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_list_audit_runs', {
    p_status: input.status ?? null,
    p_before_created_at: input.cursorCreatedAt ?? null,
    p_before_id: input.cursorId ?? null,
    p_limit: input.limit ?? 50,
  })
}

export async function claimUcatMcpAuditTargets(
  client: SupabaseClient<Database>,
  runId: string,
  limit: number,
  includeContent = false,
): Promise<Record<string, unknown>> {
  const claimed = await callRpc(client, 'tutor_ucat_mcp_claim_audit_targets', {
    p_run_id: runId,
    p_limit: limit,
  })
  if (!includeContent) return claimed

  const rawTargets = Array.isArray(claimed.targets) ? claimed.targets : []
  const targets: Array<{ contentType: UcatMcpAggregateType; id: string }> = []
  for (const target of rawTargets) {
    if (!isRecord(target)) continue
    const contentType = target.content_type
    const id = target.content_id
    if (
      (contentType !== 'learning_module'
        && contentType !== 'stem'
        && contentType !== 'set'
        && contentType !== 'mock')
      || typeof id !== 'string'
    ) {
      continue
    }
    targets.push({ contentType, id })
  }
  const reads = await getUcatMcpAggregates(client, targets)
  const readsByTarget = new Map(
    reads.items.map((read) => [`${read.contentType}:${read.id}`, read]),
  )
  return {
    ...claimed,
    targets: rawTargets.map((target) => {
      if (!isRecord(target)) return target
      const read = readsByTarget.get(`${target.content_type}:${target.content_id}`)
      if (!read) return target
      return read.ok
        ? { ...target, content: read.content }
        : { ...target, contentError: read.error }
    }),
    contentReadSummary: {
      requestedCount: reads.requestedCount,
      successCount: reads.successCount,
      errorCount: reads.errorCount,
    },
  }
}

export async function finishUcatMcpAuditTarget(
  client: SupabaseClient<Database>,
  input: {
    runId: string
    contentType: UcatMcpAggregateType
    contentId: string
    status: 'completed' | 'failed' | 'skipped' | 'pending'
    result?: 'updated' | 'unchanged' | 'suggest_delete' | 'suggest_split' | null
    claimedRevision?: string | null
    outcome?: Record<string, unknown> | null
    errorMessage?: string | null
  },
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_finish_audit_target', {
    p_run_id: input.runId,
    p_content_type: input.contentType,
    p_content_id: input.contentId,
    p_status: input.status,
    p_result: input.result ?? null,
    p_claimed_revision: input.claimedRevision ?? null,
    p_outcome: input.outcome ?? null,
    p_error_message: input.errorMessage ?? null,
  })
}

export async function completeUcatMcpAuditRun(
  client: SupabaseClient<Database>,
  runId: string,
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_complete_audit_run', { p_run_id: runId })
}

export async function cancelUcatMcpAuditRun(
  client: SupabaseClient<Database>,
  runId: string,
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_cancel_audit_run', { p_run_id: runId })
}

export async function recordUcatMcpAssessmentDecision(
  client: SupabaseClient<Database>,
  input: {
    runId: string
    stemId: string
    findingKey: string
    decision: 'dismissed' | 'acknowledged' | 'suggestion_rejected'
    reason?: string | null
  },
): Promise<Record<string, unknown>> {
  return callRpc(client, 'tutor_ucat_mcp_record_assessment_decision', {
    p_run_id: input.runId,
    p_stem_id: input.stemId,
    p_finding_key: input.findingKey,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
  })
}

export async function changeUcatMcpAssessmentSuggestion(
  client: SupabaseClient<Database>,
  input: {
    runId: string
    stemId: string
    findingKey: string
    summary: string
    rationale?: string | null
    auditRunId?: string | null
  },
): Promise<Record<string, unknown>> {
  const assessment = await getUcatMcpAiAssessment(client, input.stemId)
  const runs = Array.isArray(assessment.runs) ? assessment.runs : []
  const run = runs.find((candidate) => isRecord(candidate) && candidate.id === input.runId)
  if (!isRecord(run) || run.status !== 'completed') {
    throw new Error('Assessment run is unavailable')
  }
  const parsed = UcatAssessmentResponseSchema.safeParse(run.assessment_result)
  const finding = parsed.success
    ? parsed.data.findings.find((candidate) => candidate.key === input.findingKey)
    : null
  if (!finding?.suggestion) throw new Error('Assessment suggestion not found')

  const current = await getUcatMcpAggregate(client, 'stem', input.stemId)
  const revision = typeof current.revision === 'string' ? current.revision : ''
  const currentForm = stemDetailToFormValues(current as unknown as StemDetailRow)
  const nextForm = await applyUcatAssessmentPatches(
    currentForm,
    finding.suggestion.patches,
    {
      renderVisual: async (visual) => {
        const block = GeneratedContentBlockSchema.parse({ type: 'visual', ...visual })
        if (block.type !== 'visual') throw new Error('Invalid assessment visual suggestion')
        return generatedVisualBlockToImageNodeServer(block)
      },
    },
  )
  const payload = formValuesToStemBundlePayload(nextForm, input.stemId)
  const before = questionStemDraftFromDetail(current)
  const after: QuestionStemDraft = {
    sectionId: payload.sectionId,
    categoryId: payload.categoryId ?? null,
    stemText: payload.stemText,
    accessScope: payload.accessScope,
    tutorSourceNote: payload.tutorSourceNote ?? null,
    questions: payload.questions.map((question) => ({
      id: question.id,
      question_text: question.questionText,
      answer_explanation: question.answerExplanation ?? null,
      index: question.index,
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      response_type: question.responseType,
      answer_scheme: question.answerScheme,
      source_channel: question.sourceChannel ?? 'individual',
      ai_generation_metadata: question.aiGenerationMetadata ?? null,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option) => ({
        id: option.id,
        answer_text: option.answerText,
        answer_explanation: option.answerExplanation ?? null,
        index: option.index,
        answer_key_value: option.answerKeyValue,
      })),
    })),
  }
  const operations = [{
    type: 'assessment_suggestion',
    assessmentRunId: input.runId,
    findingKey: input.findingKey,
    patches: finding.suggestion.patches,
  }] as unknown as ChangeOperation[]
  const prepared = {
    baseSnapshot: stemSnapshot(before),
    proposedSnapshot: stemSnapshot(after),
  }
  const metadata: ChangeMetadata = {
    summary: input.summary,
    rationale: input.rationale,
    auditRunId: input.auditRunId,
    findingRefs: [{
      assessmentRunId: input.runId,
      findingKey: input.findingKey,
      appliedExactSuggestion: true,
    }],
  }

  if (current.status === 'published') {
    const change = await callRpc(client, 'tutor_ucat_mcp_create_content_change', {
      p_target_type: 'stem',
      p_target_id: input.stemId,
      p_expected_updated_at: decodeAuthoringRevision(revision, input.stemId),
      p_base_snapshot: prepared.baseSnapshot,
      p_proposed_snapshot: prepared.proposedSnapshot,
      p_operations: operations,
      p_summary: input.summary,
      p_rationale: input.rationale ?? null,
      p_source: 'assessment',
      p_audit_run_id: input.auditRunId ?? null,
      p_finding_refs: metadata.findingRefs ?? [],
      p_reverse_of_change_id: null,
    })
    if (typeof change.id !== 'string') {
      throw new Error('Assessment content change did not return an id')
    }
    return { effect: 'staged', changeId: change.id, change }
  }

  const result = await callRpc(client, 'tutor_ucat_mcp_apply_content_change', changeArgs({
    contentType: 'stem',
    id: input.stemId,
    revision,
    prepared,
    operations,
    metadata,
    source: 'assessment',
  }))
  await requestAssessmentAfterStemChange(input.stemId)
  return {
    effect: 'applied',
    aggregate: await getUcatMcpAggregate(client, 'stem', input.stemId),
    changeId: result.changeId,
  }
}
