import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  CallToolResult,
  ImageContent,
} from '@modelcontextprotocol/sdk/types.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { z } from 'zod'
import { UCAT_DURABLE_AI_REVIEW_STATUSES } from '@/features/ucat/questions/lib/ai-assessment/review-status'
import { createUcatMcpSupabaseClient } from '@/features/ucat/mcp/server/auth'
import {
  AuditCatalogFiltersSchema,
  CatalogFilterExpressionSchema,
  QuestionCatalogSearchScopesSchema,
  QuestionCatalogSortBySchema,
} from '@/features/ucat/mcp/server/catalog-filters'
import {
  AuditSelectorSchema,
  AuditTargetSchema,
  ContentChangeMetadataSchema,
  LearningModuleBlockSchema,
  LearningModuleOperationSchema,
  IdempotencyKeySchema,
  MockOperationSchema,
  NullableRichTextSchema,
  QuestionInputSchema,
  QuestionSetOperationSchema,
  QuestionStemOperationSchema,
  RichTextSchema,
  UcatAccessScopeSchema,
  UcatContentIdOrIdsSchema,
  UcatStatusSchema,
} from '@/features/ucat/mcp/server/schemas'
import { executeUcatMcpIdempotent } from '@/features/ucat/mcp/server/idempotency'
import {
  createUcatMcpLearningModule,
  createUcatMcpMock,
  createUcatMcpQuestionSet,
  createUcatMcpQuestionStem,
  deleteUcatMcpContent,
  getUcatMcpAggregate,
  getUcatMcpAggregates,
  getUcatMcpAiAssessment,
  getUcatMcpGenerationRuns,
  getUcatMcpReferenceData,
  recordUcatMcpAuxiliaryActivity,
  restoreUcatMcpContent,
  searchUcatMcpContent,
  submitUcatMcpForReview,
} from '@/features/ucat/mcp/server/service'
import {
  createMcpImageContentFromDataUri,
  generateUcatMcpImage,
  getUcatMcpFile,
  reviseUcatMcpImage,
  type UcatMcpFileResult,
} from '@/features/ucat/mcp/server/media'
import {
  GenerateBodySchema,
} from '@/features/ucat/questions/server/generate-question-stems'
import { startUcatQuestionGeneration } from '@/features/ucat/questions/server/start-question-generation'
import { requestUcatQuestionAssessment } from '@/features/ucat/questions/server/ai-assessment/dispatcher'
import {
  GeneratedContentBlockSchema,
  GeneratedVisualBlockSchema,
} from '@/features/ucat/questions/lib/ai-generation/schema'
import { generatedVisualBlockToImageNodeServer } from '@/features/ucat/questions/lib/ai-generation/server-content-blocks'
import {
  addUcatMcpAuditTargets,
  applyUcatMcpPendingChanges,
  cancelUcatMcpAuditRun,
  changeUcatMcpAssessmentSuggestion,
  changeUcatMcpLearningModule,
  changeUcatMcpMock,
  changeUcatMcpQuestionSet,
  changeUcatMcpQuestionStem,
  claimUcatMcpAuditTargets,
  completeUcatMcpAuditRun,
  createUcatMcpAuditRun,
  finishUcatMcpAuditTarget,
  getUcatMcpAuditRun,
  getUcatMcpContentChanges,
  listUcatMcpAuditRuns,
  recordUcatMcpAssessmentDecision,
  rejectUcatMcpContentChange,
  restoreUcatMcpPublishedChange,
  startUcatMcpAuditRun,
} from '@/features/ucat/mcp/server/workflow-service'

const AggregateTypeSchema = z.enum(['learning_module', 'stem', 'set', 'mock'])
const StructuredObjectOutputSchema = z.object({}).passthrough()
const ImageNodeOutputSchema = z.object({
  type: z.literal('image'),
  attrs: z.object({
    src: z.string(),
    alt: z.string(),
    fileId: z.string().uuid(),
  }).passthrough(),
})
const RenderedImageNodeOutputSchema = z.object({
  type: z.literal('image'),
  attrs: z.object({
    src: z.string(),
    alt: z.string(),
  }).passthrough(),
})
const StoredImageOutputSchema = z.object({
  fileId: z.string().uuid(),
  signedUrl: z.string(),
  alt: z.string(),
  imageNode: ImageNodeOutputSchema,
}).passthrough()

function jsonResult(
  value: unknown,
  additionalContent: ImageContent[] = [],
): CallToolResult {
  const structuredContent = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : Array.isArray(value)
      ? { items: value }
      : { value }
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
      ...additionalContent,
    ],
    structuredContent,
  }
}

function errorResult(error: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: error instanceof Error ? error.message : 'UCAT MCP tool failed',
      },
    ],
    isError: true,
  }
}

async function executeTool<T>(
  token: string | undefined,
  operation: (client: ReturnType<typeof createUcatMcpSupabaseClient>) => Promise<T>,
  result: (value: T) => CallToolResult = jsonResult,
  createClient: (token: string) => ReturnType<typeof createUcatMcpSupabaseClient> =
    createUcatMcpSupabaseClient,
): Promise<CallToolResult> {
  if (!token) return errorResult(new Error('Authenticated Supabase OAuth token required'))
  try {
    return result(await operation(createClient(token)))
  } catch (error) {
    return errorResult(error)
  }
}

type UcatMcpToolDependencies = {
  createClient?: (token: string) => SupabaseClient<Database>
  generateImage?: typeof generateUcatMcpImage
  reviseImage?: typeof reviseUcatMcpImage
  getFile?: (
    client: SupabaseClient<Database>,
    fileId: string,
  ) => Promise<UcatMcpFileResult>
}

function fileResult(value: UcatMcpFileResult): CallToolResult {
  return jsonResult(value.metadata, value.image ? [value.image] : [])
}

function imageNodeSource(imageNode: unknown): string {
  if (
    !imageNode
    || typeof imageNode !== 'object'
    || Array.isArray(imageNode)
    || !('attrs' in imageNode)
    || !imageNode.attrs
    || typeof imageNode.attrs !== 'object'
    || Array.isArray(imageNode.attrs)
    || !('src' in imageNode.attrs)
    || typeof imageNode.attrs.src !== 'string'
  ) {
    throw new Error('The rendered visual image source is missing')
  }
  return imageNode.attrs.src
}

async function attachStoredImage(
  client: SupabaseClient<Database>,
  metadata: Record<string, unknown>,
  getFile: NonNullable<UcatMcpToolDependencies['getFile']>,
): Promise<UcatMcpFileResult> {
  if (typeof metadata.fileId !== 'string') {
    throw new Error('Stored image file id is missing')
  }
  const stored = await getFile(client, metadata.fileId)
  const signedUrl = typeof stored.metadata.signedUrl === 'string'
    ? stored.metadata.signedUrl
    : null
  const imageNode = metadata.imageNode
  const refreshedImageNode = signedUrl
    && imageNode
    && typeof imageNode === 'object'
    && !Array.isArray(imageNode)
    && 'attrs' in imageNode
    && imageNode.attrs
    && typeof imageNode.attrs === 'object'
    && !Array.isArray(imageNode.attrs)
    ? {
        ...imageNode,
        attrs: {
          ...imageNode.attrs,
          src: signedUrl,
        },
      }
    : imageNode
  return {
    metadata: {
      ...metadata,
      ...(signedUrl ? { signedUrl } : {}),
      ...(refreshedImageNode ? { imageNode: refreshedImageNode } : {}),
    },
    ...(stored.image ? { image: stored.image } : {}),
  }
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}

const idempotentWriteAnnotations = {
  ...writeAnnotations,
  idempotentHint: true,
}

const destructiveWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}

export function registerUcatMcpTools(
  server: McpServer,
  dependencies: UcatMcpToolDependencies = {},
): void {
  const createClient = dependencies.createClient ?? createUcatMcpSupabaseClient
  const generateImage = dependencies.generateImage ?? generateUcatMcpImage
  const getFile = dependencies.getFile ?? getUcatMcpFile
  const reviseImage = dependencies.reviseImage ?? reviseUcatMcpImage
  server.registerTool(
    'search_ucat_content',
    {
      title: 'Search UCAT authoring content',
      description:
        'Search tutor-authoring learning modules (folders and lessons), question stems, sets, or mocks across every lifecycle. Deleted results are read-only. Stem search supports optional multi-status filters and composable filter trees via filter (all/any/clause). Omit status and statuses to include every lifecycle.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        query: z.string().trim().max(500).optional(),
        status: UcatStatusSchema.optional().describe(
          'Single-status alias. Prefer statuses when matching multiple lifecycles.',
        ),
        statuses: z.array(UcatStatusSchema).max(3).optional().describe(
          'Optional lifecycle filter. Omit status and statuses to include draft, in_review, and published stems.',
        ),
        accessScope: UcatAccessScopeSchema.optional(),
        sectionId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional().describe(
          'Stem-only single-category alias. Prefer categoryIds when filtering multiple categories.',
        ),
        includeDeleted: z.boolean().default(false),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(25),
        filter: CatalogFilterExpressionSchema.optional().describe(
          'Stem-only composable predicate tree. Use all for AND, any for OR, and clause for atomic field predicates. Flat fields are AND-ed with filter when both are supplied.',
        ),
        auditFilters: AuditCatalogFiltersSchema,
        stemIds: z.array(z.string().uuid()).max(200).optional(),
        sectionIds: z.array(z.string().uuid()).max(200).optional(),
        categoryIds: z.array(z.string().uuid()).max(200).optional(),
        includeNoCategory: z.boolean().optional(),
        tagIds: z.array(z.string().uuid()).max(200).optional(),
        accessScopes: z.array(UcatAccessScopeSchema).max(2).optional(),
        practicePool: z.boolean().optional(),
        setIds: z.array(z.string().uuid()).max(200).optional(),
        includeWithoutSet: z.boolean().optional(),
        sourceChannels: z.array(z.enum(['individual', 'bulk_import', 'ai_generation'])).max(3).optional(),
        aiReviewStatuses: z.array(z.enum(UCAT_DURABLE_AI_REVIEW_STATUSES)).max(20).optional(),
        createdBy: z.array(z.string().uuid()).max(200).optional(),
        createdFrom: z.string().datetime({ offset: true }).optional(),
        createdTo: z.string().datetime({ offset: true }).optional(),
        questionCountMin: z.number().int().min(0).optional(),
        questionCountMax: z.number().int().min(0).optional(),
        searchScopes: QuestionCatalogSearchScopesSchema,
        sortBy: QuestionCatalogSortBySchema,
        sortDirection: z.enum(['asc', 'desc']).optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => searchUcatMcpContent(client, input),
    ),
  )

  server.registerTool(
    'get_ucat_content',
    {
      title: 'Read complete UCAT authoring content',
      description:
        'Read one or an ordered batch of complete learning modules, question-stem bundles, sets, or mocks of the same type, including nested items, referenced file metadata, lifecycle state, and opaque revisions. Pass one UUID for the original single-object response, or an array for per-item batch results. Choose batch size based on aggregate size and calling-harness capacity.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        id: UcatContentIdOrIdsSchema,
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ contentType, id }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => Array.isArray(id)
        ? getUcatMcpAggregates(
          client,
          id.map((contentId) => ({ contentType, id: contentId })),
        )
        : getUcatMcpAggregate(client, contentType, id),
    ),
  )

  server.registerTool(
    'get_ucat_reference_data',
    {
      title: 'Read UCAT authoring reference data',
      description:
        'Read UCAT sections, stem categories, question tags, enabled question-generation model profiles, and enabled skill trainers. Skill trainers include their section, pedagogical description, and approved active item count; attach one only when its practice behavior supports the lesson and it has usable items. Use returned IDs instead of inventing references.',
      inputSchema: {},
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (_input, extra) => executeTool(
      extra.authInfo?.token,
      getUcatMcpReferenceData,
    ),
  )

  server.registerTool(
    'create_learning_module',
    {
      title: 'Create a draft learning module',
      description:
        'Create a lesson draft or a catalog folder. Folders have no draft/review lifecycle and may contain no blocks. Lessons always begin as drafts. Text strings are normalized as Markdown-compatible rich text, including inline LaTeX in \\(...\\) and display LaTeX in \\[...\\]. The explicit content: { body: { format: "markdown", value: "## Heading\\n\\n- Item" } } form remains supported; native TipTap/ProseMirror documents remain available for exact control and embedded images.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        kind: z.enum(['folder', 'lesson']),
        title: z.string().trim().min(1).max(500),
        description: z.string().max(10_000).nullable().optional(),
        sectionId: z.string().uuid().nullable().optional(),
        parentId: z.string().uuid().nullable().optional(),
        index: z.number().int().min(0).optional(),
        accessScope: UcatAccessScopeSchema.default('public'),
        iconKey: z.string().trim().min(1).max(100).optional(),
        estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
        studyPlanPriority: z.enum(['essential', 'recommended', 'optional', 'excluded']).optional(),
        studyPlanCategoryIds: z.array(z.string().uuid()).optional(),
        studyPlanTagIds: z.array(z.string().uuid()).optional(),
        blocks: z.array(LearningModuleBlockSchema).default([]),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, (client) => {
      const { idempotencyKey, ...request } = input
      return executeUcatMcpIdempotent(
        client,
        'create_learning_module',
        idempotencyKey,
        request,
        () => createUcatMcpLearningModule(client, request),
      )
    }),
  )

  server.registerTool(
    'change_learning_module',
    {
      title: 'Change a UCAT learning module',
      description:
        'Apply explicit typed metadata or block operations to editable content. For a published lesson or live folder, stage a durable pending content change instead of changing live content; pass the returned changeId to apply_ucat_content_changes when application is authorised. Omission never deletes.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(LearningModuleOperationSchema).min(1).max(100),
        ...ContentChangeMetadataSchema,
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations, ...metadata }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => changeUcatMcpLearningModule(client, id, revision, operations, metadata),
    ),
  )

  server.registerTool(
    'create_question_stem',
    {
      title: 'Create a draft question-stem bundle',
      description:
        'Create a question stem plus its questions and answer options as a draft with codex_mcp AI provenance. Author questions with responseType, answerScheme, and option answerKeyValue. Drafts may be incomplete but references and supplied structure must be valid.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        sectionId: z.string().uuid(),
        categoryId: z.string().uuid().nullable().optional(),
        stemText: RichTextSchema,
        accessScope: UcatAccessScopeSchema.default('public'),
        tutorSourceNote: z.string().max(4000).nullable().optional(),
        questions: z.array(QuestionInputSchema).default([]),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, (client) => {
      const { idempotencyKey, ...request } = input
      return executeUcatMcpIdempotent(
        client,
        'create_question_stem',
        idempotencyKey,
        request,
        () => createUcatMcpQuestionStem(client, request),
      )
    }),
  )

  server.registerTool(
    'change_question_stem',
    {
      title: 'Change a question-stem bundle',
      description:
        'Apply explicit add/update/move/remove operations to an editable stem. For a published stem, stage a durable pending content change instead of changing live content; pass the returned changeId to apply_ucat_content_changes when application is authorised. Omission never deletes.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(QuestionStemOperationSchema).min(1).max(100),
        ...ContentChangeMetadataSchema,
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations, ...metadata }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => changeUcatMcpQuestionStem(client, id, revision, operations, metadata),
    ),
  )

  server.registerTool(
    'create_question_set',
    {
      title: 'Create a draft UCAT question set',
      description:
        'Create a deterministically named draft set for one UCAT section. Timing is stored as pace, fixed duration, or untimed intent against an explicit database blueprint. An empty set is allowed while drafting.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        authoringNote: z.string().trim().max(1000).nullable().optional(),
        description: RichTextSchema,
        timingMode: z.enum(['pace', 'fixed', 'untimed']).default('pace'),
        paceMultiplier: z.number().positive().max(10).nullable().optional(),
        fixedTimeLimitSeconds: z.number().int().positive().nullable().optional(),
        setFormat: z.enum(['full_section', 'partial_section']),
        accessScope: UcatAccessScopeSchema.default('public'),
        sectionId: z.string().uuid(),
        referenceBlueprintId: z.string().uuid(),
        stemIds: z.array(z.string().uuid()).default([]),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, (client) => {
      const { idempotencyKey, ...request } = input
      return executeUcatMcpIdempotent(
        client,
        'create_question_set',
        idempotencyKey,
        request,
        () => createUcatMcpQuestionSet(client, request),
      )
    }),
  )

  server.registerTool(
    'change_question_set',
    {
      title: 'Change a UCAT question set',
      description:
        'Apply explicit metadata and add/move/remove stem-membership operations to an editable set. For a published set, stage a durable pending content change instead of changing live content; pass its changeId to apply_ucat_content_changes. Omission never deletes.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(QuestionSetOperationSchema).min(1).max(100),
        ...ContentChangeMetadataSchema,
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations, ...metadata }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => changeUcatMcpQuestionSet(client, id, revision, operations, metadata),
    ),
  )

  server.registerTool(
    'create_mock',
    {
      title: 'Create a draft UCAT mock exam',
      description:
        'Create a deterministically named draft mock against an explicit database blueprint. The four section component sets are created and linked atomically.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        authoringNote: z.string().trim().max(1000).nullable().optional(),
        instructionsText: NullableRichTextSchema.optional(),
        accessScope: UcatAccessScopeSchema.default('public'),
        blueprintId: z.string().uuid(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, (client) => {
      const { idempotencyKey, ...request } = input
      return executeUcatMcpIdempotent(
        client,
        'create_mock',
        idempotencyKey,
        request,
        () => createUcatMcpMock(client, request),
      )
    }),
  )

  server.registerTool(
    'change_mock',
    {
      title: 'Change a UCAT mock exam',
      description:
        'Apply explicit metadata and add/move/remove set-membership operations to an editable mock. For a published mock, stage a durable pending content change instead of changing live content; pass its changeId to apply_ucat_content_changes. Omission never deletes.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(MockOperationSchema).min(1).max(100),
        ...ContentChangeMetadataSchema,
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations, ...metadata }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => changeUcatMcpMock(client, id, revision, operations, metadata),
    ),
  )

  server.registerTool(
    'get_ucat_content_changes',
    {
      title: 'Review UCAT content proposals and applied changes',
      description:
        'Read durable base/proposed snapshots, operations, provenance, status, and recovery links. Filter by change, target, audit run, or status.',
      inputSchema: {
        changeId: z.string().uuid().optional(),
        contentType: AggregateTypeSchema.optional(),
        targetId: z.string().uuid().optional(),
        auditRunId: z.string().uuid().optional(),
        status: z.enum(['pending', 'applied', 'rejected', 'stale']).optional(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getUcatMcpContentChanges(client, input),
    ),
  )

  server.registerTool(
    'apply_ucat_content_changes',
    {
      title: 'Apply a reviewed batch of UCAT content changes',
      description:
        'Apply up to 50 pending changes in one approved tool call. Each change is still an independent atomic transaction with its own exact-revision and validation checks; failures do not roll back successful siblings.',
      inputSchema: {
        changeIds: z.array(z.string().uuid()).min(1).max(50),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: destructiveWriteAnnotations,
    },
    async ({ changeIds }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => applyUcatMcpPendingChanges(client, changeIds),
    ),
  )

  server.registerTool(
    'reject_ucat_content_change',
    {
      title: 'Reject one pending UCAT content change',
      description: 'Reject a pending proposal without changing its target content.',
      inputSchema: {
        changeId: z.string().uuid(),
        reason: z.string().trim().max(4000).nullable().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ changeId, reason }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => rejectUcatMcpContentChange(client, changeId, reason),
    ),
  )

  server.registerTool(
    'restore_ucat_content_change',
    {
      title: 'Restore an applied UCAT content change',
      description:
        'If no later edit exists, atomically restore the recorded base snapshot. If the target changed later, create a pending recovery proposal instead of overwriting newer work.',
      inputSchema: {
        changeId: z.string().uuid(),
        summary: z.string().trim().min(1).max(1000),
        rationale: z.string().trim().max(10_000).nullable().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: destructiveWriteAnnotations,
    },
    async ({ changeId, summary, rationale }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => restoreUcatMcpPublishedChange(client, changeId, summary, rationale),
    ),
  )

  server.registerTool(
    'submit_ucat_content_for_review',
    {
      title: 'Submit a UCAT draft for review',
      description:
        'Move exactly one draft lesson, question stem, set, or mock to in_review after lifecycle-appropriate readiness validation. This tool cannot publish.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        id: z.string().uuid(),
        revision: z.string().min(1),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ contentType, id, revision }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => submitUcatMcpForReview(client, contentType, id, revision),
    ),
  )

  server.registerTool(
    'delete_ucat_content',
    {
      title: 'Soft-delete editable UCAT content',
      description:
        'Soft-delete one draft or in-review lesson, question stem, set, or mock using its current revision. Published content and live learning folders are always rejected. Active dependencies must be removed first.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        id: z.string().uuid(),
        revision: z.string().min(1),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: destructiveWriteAnnotations,
    },
    async ({ contentType, id, revision }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => deleteUcatMcpContent(client, contentType, id, revision),
    ),
  )

  server.registerTool(
    'restore_ucat_content',
    {
      title: 'Restore deleted UCAT content as a draft',
      description:
        'Restore one deleted lesson, question stem, set, or mock using the revision returned by deleted-content search. Restored content returns to draft. Published content and live learning folders are always rejected.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        id: z.string().uuid(),
        revision: z.string().min(1),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ contentType, id, revision }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => restoreUcatMcpContent(client, contentType, id, revision),
    ),
  )

  server.registerTool(
    'create_ucat_audit_run',
    {
      title: 'Create a durable UCAT audit run',
      description:
        'Create a resumable audit manifest. Audit reasoning remains in the calling agent. apply_valid_changes is the default and authorises published writes only for this run’s frozen targets while active; choose proposal_only when staff review is required.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        title: z.string().trim().min(1).max(500),
        brief: z.string().max(20_000).nullable().optional(),
        publishedWriteMode: z.enum(['proposal_only', 'apply_valid_changes']).default('apply_valid_changes'),
        selector: AuditSelectorSchema.default({ kind: 'manual' }),
        workflowId: z.string().trim().max(300).nullable().optional(),
        workflowVersion: z.string().trim().max(300).nullable().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: destructiveWriteAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => createUcatMcpAuditRun(client, input),
    ),
  )

  server.registerTool(
    'add_ucat_audit_run_targets',
    {
      title: 'Add explicit targets to a selecting UCAT audit run',
      description:
        'Idempotently add up to 200 target aggregates. Use repeated calls for a large arbitrary selection, then start the run to freeze its manifest.',
      inputSchema: {
        runId: z.string().uuid(),
        targets: z.array(AuditTargetSchema).min(1).max(200),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async ({ runId, targets }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => addUcatMcpAuditTargets(client, runId, targets),
    ),
  )

  server.registerTool(
    'start_ucat_audit_run',
    {
      title: 'Start and freeze a UCAT audit run manifest',
      description:
        'Move a selecting run to active. New content or targets are not added after this point.',
      inputSchema: { runId: z.string().uuid() },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ runId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => startUcatMcpAuditRun(client, runId),
    ),
  )

  server.registerTool(
    'list_ucat_audit_runs',
    {
      title: 'List UCAT audit runs',
      description:
        'List durable audit runs newest first, including target status counts. Any UCAT tutor can read every run. Filter by lifecycle status and use both cursor fields from nextCursor to fetch the next page.',
      inputSchema: {
        status: z.enum(['selecting', 'active', 'completed', 'cancelled']).optional(),
        cursorCreatedAt: z.string().datetime({ offset: true }).optional().describe(
          'createdAt from the previous page’s nextCursor. Supply together with cursorId.',
        ),
        cursorId: z.string().uuid().optional().describe(
          'id from the previous page’s nextCursor. Supply together with cursorCreatedAt.',
        ),
        limit: z.number().int().min(1).max(100).default(50),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => listUcatMcpAuditRuns(client, input),
    ),
  )

  server.registerTool(
    'get_ucat_audit_run',
    {
      title: 'Read a UCAT audit run and target progress',
      description:
        'Read run provenance, write mode, status counts, and a page of materialised targets for review or resumption.',
      inputSchema: {
        runId: z.string().uuid(),
        targetOffset: z.number().int().min(0).default(0),
        targetLimit: z.number().int().min(1).max(500).default(100),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ runId, targetOffset, targetLimit }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getUcatMcpAuditRun(client, runId, targetOffset, targetLimit),
    ),
  )

  server.registerTool(
    'claim_ucat_audit_run_targets',
    {
      title: 'Claim the next UCAT audit targets',
      description:
        'Atomically claim pending targets for this agent. Set includeContent to claim and read complete aggregates with current revisions in the same MCP call. Choose the limit based on aggregate size and calling-harness capacity; omit content when a lightweight claim is preferable. A content read failure is returned as contentError and leaves that target in progress for explicit retry, failure, or requeue.',
      inputSchema: {
        runId: z.string().uuid(),
        limit: z.number().int().min(1).max(25).default(5),
        includeContent: z.boolean().default(false),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ runId, limit, includeContent }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => claimUcatMcpAuditTargets(client, runId, limit, includeContent),
    ),
  )

  server.registerTool(
    'finish_ucat_audit_run_target',
    {
      title: 'Record one UCAT audit target outcome',
      description:
        'Complete, fail, skip, or requeue a claimed target. Store a concise structured outcome, not hidden reasoning. Pass result for completed (updated/unchanged) or skipped (suggest_delete/suggest_split) targets; it is inferred from outcome.outcome when omitted.',
      inputSchema: {
        runId: z.string().uuid(),
        contentType: AggregateTypeSchema,
        contentId: z.string().uuid(),
        status: z.enum(['completed', 'failed', 'skipped', 'pending']),
        result: z.enum(['updated', 'unchanged', 'suggest_delete', 'suggest_split']).nullable().optional()
          .describe('Canonical terminal result for completed or skipped targets. Inferred from outcome.outcome when omitted.'),
        claimedRevision: z.string().nullable().optional(),
        outcome: z.record(z.unknown()).nullable().optional(),
        errorMessage: z.string().max(10_000).nullable().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => finishUcatMcpAuditTarget(client, input),
    ),
  )

  server.registerTool(
    'complete_ucat_audit_run',
    {
      title: 'Complete a UCAT audit run',
      description:
        'Complete an active run only after every target is completed, failed, or skipped.',
      inputSchema: { runId: z.string().uuid() },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ runId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => completeUcatMcpAuditRun(client, runId),
    ),
  )

  server.registerTool(
    'cancel_ucat_audit_run',
    {
      title: 'Cancel a UCAT audit run',
      description:
        'Cancel a selecting or active run. Cancellation immediately removes any run-scoped unattended published-write authority.',
      inputSchema: { runId: z.string().uuid() },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ runId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => cancelUcatMcpAuditRun(client, runId),
    ),
  )

  server.registerTool(
    'start_question_generation',
    {
      title: 'Start the durable UCAT AI question generator',
      description:
        'Queue the existing durable question generator with its configured prompts, gates, budget, visual generation, run tracking, and automatic review behavior. Reuse idempotencyKey unchanged after a timeout.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        ...GenerateBodySchema.shape,
      },
      outputSchema: z.object({
        runId: z.string().uuid(),
      }).passthrough(),
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, async (client) => {
      const { idempotencyKey, ...request } = input
      return executeUcatMcpIdempotent(
        client,
        'start_question_generation',
        idempotencyKey,
        request,
        async () => {
          const result = await startUcatQuestionGeneration(client, request)
          await recordUcatMcpAuxiliaryActivity(client, {
            entityType: 'ucat_ai_generation_runs',
            entityId: result.runId,
            toolName: 'start_question_generation',
            operationKinds: ['start_generation'],
          })
          return result
        },
      )
    }),
  )

  server.registerTool(
    'get_question_generation_runs',
    {
      title: 'Read UCAT AI question-generation runs',
      description:
        'Read the acting tutor’s recent durable generation runs, or one specific run and its generated stem IDs.',
      inputSchema: {
        runId: z.string().uuid().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ runId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getUcatMcpGenerationRuns(client, runId),
    ),
  )

  server.registerTool(
    'get_question_ai_assessment',
    {
      title: 'Read a question stem AI assessment',
      description:
        'Read assessment cycles, runs, format checks, findings, and tutor decisions for one question stem.',
      inputSchema: {
        stemId: z.string().uuid(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ stemId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getUcatMcpAiAssessment(client, stemId),
    ),
  )

  server.registerTool(
    'request_question_ai_assessment',
    {
      title: 'Request a question stem AI assessment',
      description:
        'Request or reuse the supplementary AI assessment for a draft, in-review, or published question stem. Assessment never publishes or changes lifecycle state.',
      inputSchema: {
        stemId: z.string().uuid(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ stemId }, extra) => executeTool(extra.authInfo?.token, async (client) => {
      const result = await requestUcatQuestionAssessment({
        stemId,
        triggerKind: 'manual_request',
        userClient: client,
      })
      await recordUcatMcpAuxiliaryActivity(client, {
        entityType: 'ucat_ai_question_assessments',
        entityId: stemId,
        toolName: 'request_question_ai_assessment',
        operationKinds: ['request_assessment'],
      })
      return result
    }),
  )

  server.registerTool(
    'decide_question_ai_assessment_finding',
    {
      title: 'Acknowledge, dismiss, or reject a question AI-review finding',
      description:
        'Record a current automated-review decision without changing question content. Dismissal requires a reason. Apply a generated suggestion through change_question_ai_assessment_suggestion.',
      inputSchema: {
        runId: z.string().uuid(),
        stemId: z.string().uuid(),
        findingKey: z.string().trim().min(1).max(300),
        decision: z.enum(['dismissed', 'acknowledged', 'suggestion_rejected']),
        reason: z.string().trim().max(4000).nullable().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => recordUcatMcpAssessmentDecision(client, input),
    ),
  )

  server.registerTool(
    'change_question_ai_assessment_suggestion',
    {
      title: 'Change a question using an AI-review suggestion',
      description:
        'Apply the exact current suggestion to editable content, or stage a pending content change for a published stem. Pass a staged changeId to apply_ucat_content_changes; only application records suggestion_accepted. Visual patches use deterministic server rendering.',
      inputSchema: {
        runId: z.string().uuid(),
        stemId: z.string().uuid(),
        findingKey: z.string().trim().min(1).max(300),
        summary: z.string().trim().min(1).max(1000),
        rationale: z.string().trim().max(10_000).nullable().optional(),
        auditRunId: z.string().uuid().nullable().optional(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: destructiveWriteAnnotations,
    },
    async (input, extra) => executeTool(
      extra.authInfo?.token,
      (client) => changeUcatMcpAssessmentSuggestion(client, input),
    ),
  )

  server.registerTool(
    'generate_ucat_image',
    {
      title: 'Generate and store a UCAT authoring image',
      description:
        'Generate an image through Altitutor’s configured server image pathway and return native MCP image content plus a preview URL, durable file ID, alt text, and ready-to-insert ProseMirror imageNode. It is not attached automatically. Reuse idempotencyKey unchanged after a timeout.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        prompt: z.string().trim().min(1).max(8000),
        alt: z.string().trim().max(1000).nullable().optional(),
      },
      outputSchema: StoredImageOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, async (client) => {
      const { idempotencyKey, ...request } = input
      const generated = await executeUcatMcpIdempotent(
        client,
        'generate_ucat_image',
        idempotencyKey,
        request,
        async () => {
          const result = await generateImage(client, request)
          if (typeof result.fileId !== 'string') {
            throw new Error('Generated image file id is missing')
          }
          await recordUcatMcpAuxiliaryActivity(client, {
            entityType: 'files',
            entityId: result.fileId,
            toolName: 'generate_ucat_image',
            operationKinds: ['generate_image'],
          })
          return result
        },
      )
      return attachStoredImage(client, generated, getFile)
    }, fileResult, createClient),
  )

  server.registerTool(
    'revise_ucat_image',
    {
      title: 'Revise and store a UCAT authoring image',
      description:
        'Revise an accessible stored image through Altitutor’s configured image pathway. Returns native MCP image content, a new preview/file, and a ready-to-insert imageNode; the source is retained and nothing is attached automatically. Reuse idempotencyKey unchanged after a timeout.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        fileId: z.string().uuid(),
        instructions: z.string().trim().min(1).max(4000),
        alt: z.string().trim().max(1000).nullable().optional(),
        context: z.unknown().optional(),
      },
      outputSchema: StoredImageOutputSchema,
      annotations: idempotentWriteAnnotations,
    },
    async (input, extra) => executeTool(extra.authInfo?.token, async (client) => {
      const { idempotencyKey, ...request } = input
      const revised = await executeUcatMcpIdempotent(
        client,
        'revise_ucat_image',
        idempotencyKey,
        request,
        async () => {
          const result = await reviseImage(client, request)
          if (typeof result.fileId !== 'string') {
            throw new Error('Revised image file id is missing')
          }
          await recordUcatMcpAuxiliaryActivity(client, {
            entityType: 'files',
            entityId: result.fileId,
            toolName: 'revise_ucat_image',
            operationKinds: ['revise_image'],
          })
          return result
        },
      )
      return attachStoredImage(client, revised, getFile)
    }, fileResult, createClient),
  )

  server.registerTool(
    'render_ucat_visual',
    {
      title: 'Render a deterministic UCAT visual',
      description:
        'Validate and render an inline Vega-Lite, Venn, or set-diagram visual into native raster MCP image content and a ProseMirror image node without external data references.',
      inputSchema: {
        visual: GeneratedVisualBlockSchema,
      },
      outputSchema: z.object({
        imageNode: RenderedImageNodeOutputSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ visual }, extra) => executeTool(extra.authInfo?.token, async () => {
      const parsed = GeneratedContentBlockSchema.safeParse(visual)
      if (!parsed.success || parsed.data.type !== 'visual') {
        throw new Error('A valid deterministic visual block is required')
      }
      const imageNode = await generatedVisualBlockToImageNodeServer(parsed.data)
      return {
        metadata: { imageNode },
        image: await createMcpImageContentFromDataUri(imageNodeSource(imageNode)),
      }
    }, fileResult, createClient),
  )

  server.registerTool(
    'get_ucat_file',
    {
      title: 'Read an accessible UCAT authoring file',
      description:
        'Read metadata and a fresh one-hour signed URL for a referenced authoring file accessible to the acting tutor. Stored images also return bounded native MCP image content for immediate model inspection.',
      inputSchema: {
        fileId: z.string().uuid(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ fileId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getFile(client, fileId),
      fileResult,
      createClient,
    ),
  )
}
