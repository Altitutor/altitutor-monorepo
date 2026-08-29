import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  isUcatVisibilityBlockedError,
  isUcatVisibilityBlockedMessage,
  parseUcatLifecycleBlockers,
  ucatVisibilityBlockedFallbackMessage,
  type UcatVisibilityContentType,
} from '@/features/ucat/shared/lifecycle-errors'
import {
  applyLearningModuleOperations,
  applyMockOperations,
  applyQuestionSetOperations,
  applyQuestionStemOperations,
  blockFromInput,
  learningModuleDraftFromDetail,
  mockDraftFromDetail,
  questionFromInput,
  questionSetDraftFromDetail,
  questionStemDraftFromDetail,
  reindexBlocks,
  reindexQuestions,
  toRichTextJson,
  toStemRpcQuestions,
  type LearningModuleDraft,
  type MockDraft,
  type QuestionSetDraft,
  type QuestionStemDraft,
} from '@/features/ucat/mcp/server/operations'
import type {
  LearningModuleBlockInput,
  LearningModuleOperation,
  MockOperation,
  QuestionInput,
  QuestionSetOperation,
  QuestionStemOperation,
} from '@/features/ucat/mcp/server/schemas'
import {
  decodeAuthoringRevision,
  encodeAuthoringRevision,
} from '@/features/ucat/mcp/server/revision'
import {
  buildMcpStemSearchRpcArgs,
  type QuestionCatalogFilterFields,
} from '@/features/ucat/mcp/server/catalog-filters'
import { enqueueUcatQuestionAssessmentPreparation } from '@/features/ucat/questions/server/ai-assessment/dispatcher'

export type UcatMcpAggregateType = 'learning_module' | 'stem' | 'set' | 'mock'
export type UcatMcpStatus = 'draft' | 'in_review' | 'published'
export type UcatMcpAccessScope = 'public' | 'private'

type RpcResult = {
  data: unknown
  error: { message: string } | null
}

type UcatMcpRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>
}

type MutationResult = {
  id: string
  status: UcatMcpStatus
  revision: string
}

type SearchInput = QuestionCatalogFilterFields & {
  contentType: UcatMcpAggregateType
  query?: string
  status?: UcatMcpStatus
  statuses?: UcatMcpStatus[]
  accessScope?: UcatMcpAccessScope
  sectionId?: string
  categoryId?: string
  includeDeleted?: boolean
  offset?: number
  limit?: number
}

type CreateQuestionStemInput = {
  sectionId: string
  categoryId?: string | null
  stemText: string | Record<string, unknown>
  accessScope: UcatMcpAccessScope
  tutorSourceNote?: string | null
  questions: QuestionInput[]
}

type CreateQuestionSetInput = {
  authoringNote?: string | null
  description: string | Record<string, unknown>
  timingMode: 'pace' | 'fixed' | 'untimed'
  paceMultiplier?: number | null
  fixedTimeLimitSeconds?: number | null
  setFormat: 'full_section' | 'partial_section'
  accessScope: UcatMcpAccessScope
  sectionId: string
  referenceBlueprintId: string
  stemIds: string[]
}

type CreateMockInput = {
  authoringNote?: string | null
  instructionsText?: string | Record<string, unknown> | null
  accessScope: UcatMcpAccessScope
  blueprintId: string
}

type CreateLearningModuleInput = {
  kind: 'folder' | 'lesson'
  title: string
  description?: string | null
  sectionId?: string | null
  parentId?: string | null
  index?: number
  accessScope: UcatMcpAccessScope
  iconKey?: string
  estimatedMinutes?: number | null
  studyPlanPriority?: 'essential' | 'recommended' | 'optional' | 'excluded'
  studyPlanCategoryIds?: string[]
  studyPlanTagIds?: string[]
  blocks?: LearningModuleBlockInput[]
}

function rpcClient(client: SupabaseClient<Database>): UcatMcpRpcClient {
  return client as unknown as UcatMcpRpcClient
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireRow(
  data: unknown,
  error: { message: string } | null,
  label: string,
): Record<string, unknown> {
  if (error) throw new Error(error.message)
  if (!isRecord(data)) throw new Error(`${label} not found`)
  return data
}

function updatedAtOf(row: Record<string, unknown>): string {
  if (typeof row.updated_at !== 'string') {
    throw new Error('Aggregate does not expose an authoring revision')
  }
  return row.updated_at
}

function withRevision(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : null
  if (!id) throw new Error('Aggregate id is missing')
  return {
    ...row,
    revision: encodeAuthoringRevision(id, updatedAtOf(row)),
  }
}

function richTextSearchValue(value: unknown): string {
  if (typeof value === 'string') return value
  return proseMirrorToPlainText(value as Json) ?? ''
}

function referencedFileIds(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((child) => referencedFileIds(child, output))
    return output
  }
  if (!isRecord(value)) return output
  for (const [key, child] of Object.entries(value)) {
    if (
      (key === 'fileId' || key === 'file_id')
      && typeof child === 'string'
      && child
    ) {
      output.add(child)
    } else {
      referencedFileIds(child, output)
    }
  }
  return output
}

async function referencedFiles(
  client: SupabaseClient<Database>,
  aggregate: Record<string, unknown>,
): Promise<unknown[]> {
  const ids = [...referencedFileIds(aggregate)]
  if (ids.length === 0) return []
  const { data, error } = await client
    .from('vtutor_files')
    .select('id,filename,mimetype,size_bytes,bucket,storage_path,external_url,metadata,created_at')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function getLearningModule(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const [moduleResult, blocksResult, categoriesResult, tagsResult] = await Promise.all([
    client.from('vtutor_ucat_learning_modules').select('*').eq('id', id).maybeSingle(),
    client
      .from('vtutor_ucat_learning_module_blocks')
      .select('*')
      .eq('learning_module_id', id)
      .order('index'),
    client
      .from('vtutor_ucat_learning_module_question_stem_categories')
      .select('question_stem_category_id')
      .eq('learning_module_id', id),
    client
      .from('vtutor_ucat_learning_module_question_tags')
      .select('question_tag_id')
      .eq('learning_module_id', id),
  ])
  const learningModule = requireRow(moduleResult.data, moduleResult.error, 'Learning module')
  if (blocksResult.error) throw new Error(blocksResult.error.message)
  if (categoriesResult.error) throw new Error(categoriesResult.error.message)
  if (tagsResult.error) throw new Error(tagsResult.error.message)

  const aggregate = withRevision({
    ...learningModule,
    study_plan_category_ids: (categoriesResult.data ?? [])
      .map((row) => row.question_stem_category_id)
      .filter((value): value is string => typeof value === 'string'),
    study_plan_tag_ids: (tagsResult.data ?? [])
      .map((row) => row.question_tag_id)
      .filter((value): value is string => typeof value === 'string'),
    blocks: blocksResult.data ?? [],
  })
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getStem(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_ucat_question_stem_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const aggregate = withRevision(requireRow(data, error, 'Question stem'))
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getSet(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_ucat_question_set_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const aggregate = withRevision(requireRow(data, error, 'Question set'))
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

async function getMock(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_ucat_mock_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  const aggregate = withRevision(requireRow(data, error, 'Mock exam'))
  return {
    ...aggregate,
    referencedFiles: await referencedFiles(client, aggregate),
  }
}

export async function getUcatMcpAggregate(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
): Promise<Record<string, unknown>> {
  if (contentType === 'learning_module') return getLearningModule(client, id)
  if (contentType === 'stem') return getStem(client, id)
  if (contentType === 'set') return getSet(client, id)
  return getMock(client, id)
}

export type UcatMcpAggregateTarget = {
  contentType: UcatMcpAggregateType
  id: string
}

type UcatMcpAggregateReadResult = UcatMcpAggregateTarget & (
  | { ok: true; content: Record<string, unknown> }
  | { ok: false; error: string }
)

export async function getUcatMcpAggregates(
  client: SupabaseClient<Database>,
  targets: UcatMcpAggregateTarget[],
): Promise<{
  items: UcatMcpAggregateReadResult[]
  requestedCount: number
  successCount: number
  errorCount: number
}> {
  const items: UcatMcpAggregateReadResult[] = new Array(targets.length)
  const concurrency = 4
  for (let offset = 0; offset < targets.length; offset += concurrency) {
    const chunk = targets.slice(offset, offset + concurrency)
    await Promise.all(chunk.map(async (target, chunkIndex) => {
      try {
        items[offset + chunkIndex] = {
          ...target,
          ok: true,
          content: await getUcatMcpAggregate(client, target.contentType, target.id),
        }
      } catch (error) {
        items[offset + chunkIndex] = {
          ...target,
          ok: false,
          error: error instanceof Error ? error.message : 'UCAT content read failed',
        }
      }
    }))
  }
  const successCount = items.filter((item) => item.ok).length
  return {
    items,
    requestedCount: items.length,
    successCount,
    errorCount: items.length - successCount,
  }
}

function matchesQuery(row: Record<string, unknown>, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  const values = [
    row.title,
    row.name,
    row.description,
    row.stem_text,
    row.section_name,
    row.category_name,
  ]
  return values.some((value) => richTextSearchValue(value).toLocaleLowerCase().includes(needle))
}

function searchSummary(
  contentType: UcatMcpAggregateType,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : ''
  const updatedAt = updatedAtOf(row)
  return {
    contentType,
    id,
    title: contentType === 'learning_module'
      ? row.title
      : contentType === 'mock'
        ? row.name
        : richTextSearchValue(row.name ?? row.stem_text).slice(0, 240),
    kind: row.kind ?? undefined,
    status: row.status,
    accessScope: row.access_scope,
    sectionId: row.ucat_section_id ?? row.section_id ?? null,
    sectionName: row.section_name ?? null,
    categoryId: row.question_stem_category_id ?? null,
    categoryName: row.category_name ?? null,
    deletedAt: row.deleted_at ?? null,
    updatedAt,
    revision: encodeAuthoringRevision(id, updatedAt),
  }
}

function stemCatalogSearchSummary(row: Record<string, unknown>): Record<string, unknown> {
  const id = typeof row.id === 'string' ? row.id : ''
  const updatedAt = updatedAtOf(row)
  return {
    contentType: 'stem',
    id,
    title: richTextSearchValue(row.stem_text).slice(0, 240),
    status: row.status,
    accessScope: row.access_scope,
    sectionId: row.section_id ?? null,
    sectionName: row.section_name ?? null,
    categoryId: row.question_stem_category_id ?? null,
    categoryName: row.category_name ?? null,
    deletedAt: row.deleted_at ?? null,
    updatedAt,
    revision: encodeAuthoringRevision(id, updatedAt),
    auditMemberships: row.audit_memberships ?? [],
  }
}

async function searchUcatMcpQuestionStemsViaCatalog(
  client: SupabaseClient<Database>,
  input: SearchInput,
): Promise<Record<string, unknown>> {
  const limit = Math.min(input.limit ?? 25, 100)
  const offset = input.offset ?? 0
  const page = Math.floor(offset / limit) + 1
  const rpcArgs = buildMcpStemSearchRpcArgs(input, { page, pageSize: limit })
  const { data, error } = await rpcClient(client).rpc(
    'tutor_ucat_mcp_search_question_stems',
    rpcArgs as Record<string, unknown>,
  )
  if (error) throw new Error(error.message)

  const payload = isRecord(data) ? data : { items: [], total: 0 }
  const items = Array.isArray(payload.items) ? payload.items : []
  const total = typeof payload.total === 'number' ? payload.total : items.length
  const nextOffset = offset + items.length < total ? offset + items.length : null

  return {
    items: items
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => stemCatalogSearchSummary(item)),
    nextOffset,
    matchedCount: total,
    truncatedSource: false,
  }
}

export async function searchUcatMcpContent(
  client: SupabaseClient<Database>,
  input: SearchInput,
): Promise<Record<string, unknown>> {
  const fetchLimit = 500
  let rows: Record<string, unknown>[] = []

  if (input.contentType === 'stem') {
    return searchUcatMcpQuestionStemsViaCatalog(client, input)
  }

  if (input.contentType === 'learning_module') {
    let query = client
      .from('vtutor_ucat_learning_modules')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)
    if (input.status) query = query.eq('status', input.status)
    if (input.accessScope) query = query.eq('access_scope', input.accessScope)
    if (input.sectionId) query = query.eq('ucat_section_id', input.sectionId)
    if (!input.includeDeleted) query = query.is('deleted_at', null)
    const result = await query
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []) as unknown as Record<string, unknown>[]
  } else if (input.contentType === 'set') {
    let query = client
      .from('vtutor_ucat_question_sets')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)
    if (input.status) query = query.eq('status', input.status)
    if (input.accessScope) query = query.eq('access_scope', input.accessScope)
    if (!input.includeDeleted) query = query.is('deleted_at', null)
    const result = await query
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []) as unknown as Record<string, unknown>[]
  } else {
    let query = client
      .from('vtutor_ucat_mocks')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)
    if (input.status) query = query.eq('status', input.status)
    if (input.accessScope) query = query.eq('access_scope', input.accessScope)
    if (!input.includeDeleted) query = query.is('deleted_at', null)
    const result = await query
    if (result.error) throw new Error(result.error.message)
    rows = (result.data ?? []) as unknown as Record<string, unknown>[]
  }

  const filtered = input.query
    ? rows.filter((row) => matchesQuery(row, input.query ?? ''))
    : rows
  const offset = input.offset ?? 0
  const limit = Math.min(input.limit ?? 25, 100)
  const page = filtered.slice(offset, offset + limit)
  const nextOffset = offset + page.length < filtered.length ? offset + page.length : null
  return {
    items: page.map((row) => searchSummary(input.contentType, row)),
    nextOffset,
    matchedCount: filtered.length,
    truncatedSource: rows.length === fetchLimit,
  }
}

export async function getUcatMcpReferenceData(
  client: SupabaseClient<Database>,
): Promise<Record<string, unknown>> {
  const [sections, categories, tags, modelProfiles, skillTrainers] = await Promise.all([
    client.from('vtutor_ucat_sections').select('*').order('section_number'),
    client.from('vtutor_ucat_question_stem_categories').select('*').order('name'),
    client.from('vtutor_ucat_question_tags').select('*').order('name'),
    client
      .from('vtutor_ucat_ai_generation_model_profiles')
      .select('id,name,model,is_enabled,is_default,created_at,updated_at')
      .eq('is_enabled', true)
      .order('name'),
    client
      .from('vtutor_ucat_skill_trainers')
      .select(
        'id,key,name,description,ucat_section_id,section_name,section_number,is_enabled,item_count,approved_active_item_count',
      )
      .eq('is_enabled', true)
      .order('sort_order'),
  ])
  for (const result of [sections, categories, tags, modelProfiles, skillTrainers]) {
    if (result.error) throw new Error(result.error.message)
  }
  return {
    sections: sections.data ?? [],
    categories: categories.data ?? [],
    tags: tags.data ?? [],
    generationModelProfiles: modelProfiles.data ?? [],
    skillTrainers: skillTrainers.data ?? [],
  }
}

async function callMutation(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>,
): Promise<MutationResult> {
  const { data, error } = await rpcClient(client).rpc(name, args)
  if (error) {
    if (error.message.includes('mcp_stale_revision')) {
      throw new Error('The authoring revision is stale. Re-read the aggregate and reconcile your operations.')
    }
    if (error.message.includes('mcp_published_content_read_only')) {
      throw new Error('Published content requires a dedicated published-change tool.')
    }
    if (error.message.includes('mcp_live_learning_folder_read_only')) {
      throw new Error('This live Learn folder requires a dedicated published-learning-module change tool.')
    }
    if (error.message.includes('delete_blocked_by_dependency')) {
      throw new Error('This content is still used by another active UCAT aggregate or session and cannot be deleted.')
    }
    if (error.message.includes('status_blocked_by_attachment')) {
      throw new Error('This learning module is attached to a session and cannot be deleted.')
    }
    if (isUcatVisibilityBlockedError(error.message)) {
      throw new Error(ucatVisibilityBlockedFallbackMessage(error.message))
    }
    if (error.message.includes('mcp_content_already_deleted')) {
      throw new Error('This content is already deleted. Re-read search results before retrying.')
    }
    if (error.message.includes('mcp_content_not_deleted')) {
      throw new Error('This content is not deleted. Re-read search results before retrying.')
    }
    throw new Error(error.message)
  }
  if (!isRecord(data) || typeof data.id !== 'string') {
    throw new Error('Authoring mutation returned an invalid result')
  }
  return data as MutationResult
}

const NIL_AUTHORING_ID = '00000000-0000-0000-0000-000000000000'

async function throwEnrichedVisibilityError(
  client: SupabaseClient<Database>,
  error: unknown,
  options: {
    contentType: UcatVisibilityContentType
    contentId: string
    accessScope: 'public' | 'private'
    memberIds?: string[]
  },
): Promise<never> {
  const message = error instanceof Error ? error.message : ''
  if (!isUcatVisibilityBlockedMessage(message)) throw error
  const { data } = await rpcClient(client).rpc('tutor_ucat_content_visibility_blockers', {
    p_content_type: options.contentType,
    p_content_id: options.contentId,
    p_access_scope: options.accessScope,
    p_member_ids: options.memberIds ?? null,
  })
  const blockers = parseUcatLifecycleBlockers(data)
  const extraCount = Math.max(0, blockers.length - 1)
  const extra = extraCount > 0
    ? ` There ${extraCount === 1 ? 'is' : 'are'} ${extraCount} more blocker${extraCount === 1 ? '' : 's'}.`
    : ''
  throw new Error((blockers[0]?.message ?? ucatVisibilityBlockedFallbackMessage(message)) + extra)
}

async function callMutationWithVisibility(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>,
  visibility: {
    contentType: UcatVisibilityContentType
    contentId: string
    accessScope: 'public' | 'private'
    memberIds?: string[]
  },
): Promise<MutationResult> {
  try {
    return await callMutation(client, name, args)
  } catch (error) {
    return throwEnrichedVisibilityError(client, error, visibility)
  }
}

export async function recordUcatMcpAuxiliaryActivity(
  client: SupabaseClient<Database>,
  input: {
    entityType: 'ucat_ai_generation_runs' | 'files' | 'ucat_ai_question_assessments'
    entityId: string
    toolName:
      | 'start_question_generation'
      | 'generate_ucat_image'
      | 'revise_ucat_image'
      | 'request_question_ai_assessment'
    operationKinds: string[]
  },
): Promise<void> {
  const { error } = await rpcClient(client).rpc(
    'tutor_ucat_mcp_record_auxiliary_activity',
    {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_tool_name: input.toolName,
      p_operation_kinds: input.operationKinds,
    },
  )
  if (error) throw new Error(error.message)
}

function operationKinds(operations: Array<{ type: string }>): string[] {
  return [...new Set(operations.map((operation) => operation.type))]
}

export async function createUcatMcpQuestionStem(
  client: SupabaseClient<Database>,
  input: CreateQuestionStemInput,
): Promise<Record<string, unknown>> {
  const questions = input.questions.map(questionFromInput)
  reindexQuestions(questions)
  const draft: QuestionStemDraft = {
    sectionId: input.sectionId,
    categoryId: input.categoryId ?? null,
    stemText: toRichTextJson(input.stemText) ?? {},
    accessScope: input.accessScope,
    tutorSourceNote: input.tutorSourceNote ?? null,
    questions,
  }
  const metadata = {
    source: 'codex_mcp',
    generatedAt: new Date().toISOString(),
  }
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_stem_bundle', {
    p_stem_id: null,
    p_expected_updated_at: null,
    p_section_id: draft.sectionId,
    p_question_stem_category_id: draft.categoryId,
    p_stem_text: draft.stemText,
    p_access_scope: draft.accessScope,
    p_questions: toStemRpcQuestions(draft),
    p_source_channel: 'ai_generation',
    p_tutor_source_note: draft.tutorSourceNote,
    p_ai_generation_metadata: metadata,
    p_operation_kinds: ['create'],
  }, {
    contentType: 'stem',
    contentId: NIL_AUTHORING_ID,
    accessScope: draft.accessScope,
  })
  return getStem(client, result.id)
}

export async function updateUcatMcpQuestionStem(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: QuestionStemOperation[],
): Promise<Record<string, unknown>> {
  const current = await getStem(client, id)
  const draft = applyQuestionStemOperations(questionStemDraftFromDetail(current), operations)
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_stem_bundle', {
    p_stem_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_section_id: draft.sectionId,
    p_question_stem_category_id: draft.categoryId,
    p_stem_text: draft.stemText,
    p_access_scope: draft.accessScope,
    p_questions: toStemRpcQuestions(draft),
    p_source_channel: 'ai_generation',
    p_tutor_source_note: draft.tutorSourceNote,
    p_ai_generation_metadata: null,
    p_operation_kinds: operationKinds(operations),
  }, {
    contentType: 'stem',
    contentId: id,
    accessScope: draft.accessScope,
  })
  const updated = await getStem(client, result.id)
  if (updated.status === 'in_review') {
    await enqueueUcatQuestionAssessmentPreparation({
      stemIds: [id],
      triggerKind: 'content_change',
    }).catch((error) => {
      console.error('Could not request UCAT AI assessment after MCP stem update', error)
    })
  }
  return updated
}

export async function createUcatMcpQuestionSet(
  client: SupabaseClient<Database>,
  input: CreateQuestionSetInput,
): Promise<Record<string, unknown>> {
  const draft: QuestionSetDraft = {
    authoringNote: input.authoringNote ?? null,
    description: toRichTextJson(input.description) ?? {},
    timingMode: input.timingMode,
    paceMultiplier: input.paceMultiplier ?? null,
    fixedTimeLimitSeconds: input.fixedTimeLimitSeconds ?? null,
    setFormat: input.setFormat,
    accessScope: input.accessScope,
    sectionId: input.sectionId,
    referenceBlueprintId: input.referenceBlueprintId,
    stemIds: [...input.stemIds],
  }
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_set', {
    p_set_id: null,
    p_expected_updated_at: null,
    p_authoring_note: draft.authoringNote,
    p_description: draft.description,
    p_timing_mode: draft.timingMode,
    p_pace_multiplier: draft.paceMultiplier,
    p_fixed_time_limit_seconds: draft.fixedTimeLimitSeconds,
    p_set_format: draft.setFormat,
    p_access_scope: draft.accessScope,
    p_stem_ids: draft.stemIds,
    p_section_id: draft.sectionId,
    p_reference_blueprint_id: draft.referenceBlueprintId,
    p_operation_kinds: ['create'],
  }, {
    contentType: 'set',
    contentId: NIL_AUTHORING_ID,
    accessScope: draft.accessScope,
    memberIds: draft.stemIds,
  })
  return getSet(client, result.id)
}

export async function updateUcatMcpQuestionSet(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: QuestionSetOperation[],
): Promise<Record<string, unknown>> {
  const current = await getSet(client, id)
  const draft = applyQuestionSetOperations(questionSetDraftFromDetail(current), operations)
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_question_set', {
    p_set_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_authoring_note: draft.authoringNote,
    p_description: draft.description,
    p_timing_mode: draft.timingMode,
    p_pace_multiplier: draft.paceMultiplier,
    p_fixed_time_limit_seconds: draft.fixedTimeLimitSeconds,
    p_set_format: draft.setFormat,
    p_access_scope: draft.accessScope,
    p_stem_ids: draft.stemIds,
    p_section_id: draft.sectionId,
    p_reference_blueprint_id: draft.referenceBlueprintId,
    p_operation_kinds: operationKinds(operations),
  }, {
    contentType: 'set',
    contentId: id,
    accessScope: draft.accessScope,
    memberIds: draft.stemIds,
  })
  return getSet(client, result.id)
}

export async function createUcatMcpMock(
  client: SupabaseClient<Database>,
  input: CreateMockInput,
): Promise<Record<string, unknown>> {
  const draft: MockDraft = {
    authoringNote: input.authoringNote ?? null,
    instructionsText: toRichTextJson(input.instructionsText ?? null),
    accessScope: input.accessScope,
    blueprintId: input.blueprintId,
    setIds: [],
  }
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_mock', {
    p_mock_id: null,
    p_expected_updated_at: null,
    p_authoring_note: draft.authoringNote,
    p_access_scope: draft.accessScope,
    p_instructions_text: draft.instructionsText,
    p_blueprint_id: draft.blueprintId,
    p_set_ids: null,
    p_operation_kinds: ['create'],
  }, {
    contentType: 'mock',
    contentId: NIL_AUTHORING_ID,
    accessScope: draft.accessScope,
    memberIds: [],
  })
  return getMock(client, result.id)
}

export async function updateUcatMcpMock(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: MockOperation[],
): Promise<Record<string, unknown>> {
  const current = await getMock(client, id)
  const draft = applyMockOperations(mockDraftFromDetail(current), operations)
  const result = await callMutationWithVisibility(client, 'tutor_ucat_mcp_upsert_mock', {
    p_mock_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_authoring_note: draft.authoringNote,
    p_access_scope: draft.accessScope,
    p_set_ids: draft.setIds,
    p_instructions_text: draft.instructionsText,
    p_blueprint_id: draft.blueprintId,
    p_operation_kinds: operationKinds(operations),
  }, {
    contentType: 'mock',
    contentId: id,
    accessScope: draft.accessScope,
    memberIds: draft.setIds,
  })
  return getMock(client, result.id)
}

function learningModuleRpcBlocks(draft: LearningModuleDraft): Json {
  return draft.blocks.map((block) => ({
    ...(block.id ? { id: block.id } : {}),
    block_type: block.block_type,
    index: block.index,
    require_completion_before_next: block.require_completion_before_next,
    content: block.content,
    question_stem_id: block.question_stem_id,
    question_id: block.question_id,
    file_id: block.file_id,
    skill_trainer_id: block.skill_trainer_id,
  })) as Json
}

async function persistLearningModule(
  client: SupabaseClient<Database>,
  id: string | null,
  expectedUpdatedAt: string | null,
  draft: LearningModuleDraft,
  kinds: string[],
): Promise<Record<string, unknown>> {
  const result = await callMutation(client, 'tutor_ucat_mcp_upsert_learning_module', {
    p_module_id: id,
    p_expected_updated_at: expectedUpdatedAt,
    p_kind: draft.kind,
    p_title: draft.title,
    p_description: draft.description,
    p_ucat_section_id: draft.sectionId,
    p_parent_id: draft.parentId,
    p_index: draft.index,
    p_access_scope: draft.accessScope,
    p_icon_key: draft.iconKey,
    p_estimated_minutes: draft.estimatedMinutes,
    p_study_plan_priority: draft.studyPlanPriority,
    p_study_plan_category_ids: draft.studyPlanCategoryIds,
    p_study_plan_tag_ids: draft.studyPlanTagIds,
    p_blocks: learningModuleRpcBlocks(draft),
    p_operation_kinds: kinds,
  })
  return getLearningModule(client, result.id)
}

export async function createUcatMcpLearningModule(
  client: SupabaseClient<Database>,
  input: CreateLearningModuleInput,
): Promise<Record<string, unknown>> {
  const blocks = (input.blocks ?? []).map(blockFromInput)
  reindexBlocks(blocks)
  const draft: LearningModuleDraft = {
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    sectionId: input.sectionId ?? null,
    parentId: input.parentId ?? null,
    index: input.index ?? 0,
    accessScope: input.kind === 'folder' ? 'public' : input.accessScope,
    iconKey: input.iconKey ?? 'book-open',
    estimatedMinutes: input.estimatedMinutes ?? null,
    studyPlanPriority: input.studyPlanPriority ?? 'recommended',
    studyPlanCategoryIds: input.studyPlanCategoryIds ?? [],
    studyPlanTagIds: input.studyPlanTagIds ?? [],
    blocks,
  }
  return persistLearningModule(client, null, null, draft, ['create'])
}

export async function updateUcatMcpLearningModule(
  client: SupabaseClient<Database>,
  id: string,
  revision: string,
  operations: LearningModuleOperation[],
): Promise<Record<string, unknown>> {
  const current = await getLearningModule(client, id)
  const rawBlocks = Array.isArray(current.blocks) ? current.blocks : []
  const draft = applyLearningModuleOperations(
    learningModuleDraftFromDetail(current, rawBlocks),
    operations,
  )
  return persistLearningModule(
    client,
    id,
    decodeAuthoringRevision(revision, id),
    draft,
    operationKinds(operations),
  )
}

export async function submitUcatMcpForReview(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
): Promise<Record<string, unknown>> {
  if (contentType === 'learning_module') {
    const aggregate = await getLearningModule(client, id)
    if (aggregate.kind !== 'lesson') throw new Error('Folders do not have a review lifecycle')
  }
  const result = await callMutation(client, 'tutor_ucat_mcp_submit_for_review', {
    p_content_type: contentType === 'learning_module' ? 'lesson' : contentType,
    p_content_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
  })
  if (contentType === 'stem') {
    await enqueueUcatQuestionAssessmentPreparation({
      stemIds: [id],
      triggerKind: 'review_submission',
    }).catch((error) => {
      console.error('Could not request UCAT AI assessment after MCP review submission', error)
    })
  }
  return getUcatMcpAggregate(client, contentType, result.id)
}

export async function deleteUcatMcpContent(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
): Promise<MutationResult & { deletedAt?: string | null }> {
  try {
    return await callMutation(client, 'tutor_ucat_mcp_set_deleted', {
      p_content_type: contentType,
      p_content_id: id,
      p_expected_updated_at: decodeAuthoringRevision(revision, id),
      p_deleted: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      !message.includes('delete_blocked_by_dependency') &&
      !message.includes('status_blocked_by_attachment') &&
      !message.includes('still used by another active UCAT') &&
      !message.includes('attached to a session')
    ) {
      throw error
    }
    const { data } = await rpcClient(client).rpc('tutor_ucat_content_delete_blockers', {
      p_content_type: contentType === 'learning_module' ? 'lesson' : contentType,
      p_content_id: id,
    })
    const blockers = parseUcatLifecycleBlockers(data)
    const extraCount = Math.max(0, blockers.length - 1)
    const extra = extraCount > 0
      ? ` There ${extraCount === 1 ? 'is' : 'are'} ${extraCount} more blocker${extraCount === 1 ? '' : 's'}.`
      : ''
    throw new Error(
      (blockers[0]?.message ?? (
        message.includes('status_blocked_by_attachment') || message.includes('attached to a session')
          ? 'This learning module is attached to a session and cannot be deleted.'
          : 'This content is still used by another active UCAT aggregate or session and cannot be deleted.'
      )) + extra,
    )
  }
}

export async function restoreUcatMcpContent(
  client: SupabaseClient<Database>,
  contentType: UcatMcpAggregateType,
  id: string,
  revision: string,
): Promise<Record<string, unknown>> {
  const result = await callMutation(client, 'tutor_ucat_mcp_set_deleted', {
    p_content_type: contentType,
    p_content_id: id,
    p_expected_updated_at: decodeAuthoringRevision(revision, id),
    p_deleted: false,
  })
  return getUcatMcpAggregate(client, contentType, result.id)
}

export async function getUcatMcpGenerationRuns(
  client: SupabaseClient<Database>,
  runId?: string,
): Promise<unknown[]> {
  let query = client
    .from('vtutor_ucat_ai_generation_runs')
    .select('id,status,requested_stem_count,accepted_stem_count,discarded_stem_count,processed_stem_count,progress_step,progress_message,error_message,generated_stem_ids,created_at,completed_at,dismissed_at')
    .order('created_at', { ascending: false })
    .limit(runId ? 1 : 20)
  if (runId) query = query.eq('id', runId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getUcatMcpAiAssessment(
  client: SupabaseClient<Database>,
  stemId: string,
): Promise<Record<string, unknown>> {
  const [cycles, runs, decisions] = await Promise.all([
    client
      .from('vtutor_ucat_ai_question_assessment_cycles')
      .select('*')
      .eq('stem_id', stemId)
      .order('started_at', { ascending: false }),
    client
      .from('vtutor_ucat_ai_question_assessment_runs')
      .select('*')
      .eq('stem_id', stemId)
      .order('requested_at', { ascending: false }),
    client
      .from('vtutor_ucat_ai_question_assessment_decisions')
      .select('*')
      .eq('stem_id', stemId)
      .order('decided_at', { ascending: false }),
  ])
  for (const result of [cycles, runs, decisions]) {
    if (result.error) throw new Error(result.error.message)
  }
  return {
    stemId,
    cycles: cycles.data ?? [],
    runs: runs.data ?? [],
    decisions: decisions.data ?? [],
  }
}
