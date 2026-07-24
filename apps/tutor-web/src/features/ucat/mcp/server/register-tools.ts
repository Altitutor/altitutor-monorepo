import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createUcatMcpSupabaseClient } from '@/features/ucat/mcp/server/auth'
import {
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
  getUcatMcpAiAssessment,
  getUcatMcpGenerationRuns,
  getUcatMcpReferenceData,
  recordUcatMcpAuxiliaryActivity,
  restoreUcatMcpContent,
  searchUcatMcpContent,
  submitUcatMcpForReview,
  updateUcatMcpLearningModule,
  updateUcatMcpMock,
  updateUcatMcpQuestionSet,
  updateUcatMcpQuestionStem,
} from '@/features/ucat/mcp/server/service'
import {
  generateUcatMcpImage,
  getUcatMcpFile,
  reviseUcatMcpImage,
} from '@/features/ucat/mcp/server/media'
import {
  GenerateBodySchema,
} from '@/features/ucat/questions/server/generate-question-stems'
import { startUcatQuestionGeneration } from '@/features/ucat/questions/server/start-question-generation'
import { requestUcatQuestionAssessment } from '@/features/ucat/questions/server/ai-assessment/dispatcher'
import { GeneratedContentBlockSchema } from '@/features/ucat/questions/lib/ai-generation/schema'
import { generatedVisualBlockToImageNodeServer } from '@/features/ucat/questions/lib/ai-generation/server-content-blocks'

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
const StoredImageOutputSchema = z.object({
  fileId: z.string().uuid(),
  signedUrl: z.string(),
  alt: z.string(),
  imageNode: ImageNodeOutputSchema,
}).passthrough()

function jsonResult(value: unknown) {
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
    ],
    structuredContent,
  }
}

function errorResult(error: unknown) {
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
) {
  if (!token) return errorResult(new Error('Authenticated Supabase OAuth token required'))
  try {
    return jsonResult(await operation(createUcatMcpSupabaseClient(token)))
  } catch (error) {
    return errorResult(error)
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

export function registerUcatMcpTools(server: McpServer): void {
  server.registerTool(
    'search_ucat_content',
    {
      title: 'Search UCAT authoring content',
      description:
        'Search tutor-authoring learning modules (folders and lessons), question stems, sets, or mocks. Published and deleted results are readable but never writable through MCP.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        query: z.string().trim().max(500).optional(),
        status: UcatStatusSchema.optional(),
        accessScope: UcatAccessScopeSchema.optional(),
        sectionId: z.string().uuid().optional(),
        includeDeleted: z.boolean().default(false),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(25),
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
      title: 'Read a complete UCAT authoring aggregate',
      description:
        'Read a complete learning module, question-stem bundle, set, or mock, including nested items, referenced file metadata, lifecycle state, and the opaque revision required for updates.',
      inputSchema: {
        contentType: AggregateTypeSchema,
        id: z.string().uuid(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ contentType, id }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getUcatMcpAggregate(client, contentType, id),
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
        'Create a lesson draft or a catalog folder. Folders have no draft/review lifecycle and may contain no blocks. Lessons always begin as drafts. For unformatted text blocks use content: { body: "plain text" }. Prefer content: { body: { format: "markdown", value: "## Heading\\n\\n- Item" } } for formatted authoring, including headings, lists, tables, quotes, code blocks, rules, links, and common inline marks. The server converts both forms to TipTap/ProseMirror JSON; native TipTap/ProseMirror documents remain available for exact control and embedded images.',
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
    'update_learning_module',
    {
      title: 'Update an editable learning module',
      description:
        'Apply explicit typed metadata or block operations. Omission never deletes. Draft/in-review lessons and non-live folders are editable; published lessons and folders with published descendants are rejected. Text-block content accepts { body: "plain text" }, { body: { format: "markdown", value: "## Heading\\n\\n- Item" } }, or a native TipTap/ProseMirror document; the server normalizes plain text and Markdown.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(LearningModuleOperationSchema).min(1).max(100),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => updateUcatMcpLearningModule(client, id, revision, operations),
    ),
  )

  server.registerTool(
    'create_question_stem',
    {
      title: 'Create a draft question-stem bundle',
      description:
        'Create a question stem plus its questions and answer options as a draft with codex_mcp AI provenance. Drafts may be incomplete but references and supplied structure must be valid.',
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
    'update_question_stem',
    {
      title: 'Update a draft or in-review question-stem bundle',
      description:
        'Apply explicit add/update/move/remove operations to stem metadata, questions, and answer options. Omission never deletes. Published or stale-revision writes are rejected atomically.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(QuestionStemOperationSchema).min(1).max(100),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => updateUcatMcpQuestionStem(client, id, revision, operations),
    ),
  )

  server.registerTool(
    'create_question_set',
    {
      title: 'Create a draft UCAT question set',
      description:
        'Create a draft set with an ordered initial stem membership. An empty set is allowed while drafting.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        name: NullableRichTextSchema.optional(),
        description: RichTextSchema,
        timeLimitSeconds: z.number().int().positive().nullable().optional(),
        accessScope: UcatAccessScopeSchema.default('public'),
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
    'update_question_set',
    {
      title: 'Update a draft or in-review UCAT question set',
      description:
        'Apply explicit metadata and add/move/remove stem-membership operations. Omission never deletes; published and stale writes are rejected atomically.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(QuestionSetOperationSchema).min(1).max(100),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => updateUcatMcpQuestionSet(client, id, revision, operations),
    ),
  )

  server.registerTool(
    'create_mock',
    {
      title: 'Create a draft UCAT mock exam',
      description:
        'Create a draft mock with ordered initial set membership. An empty mock is allowed while drafting.',
      inputSchema: {
        idempotencyKey: IdempotencyKeySchema,
        name: z.string().trim().min(1).max(300),
        instructionsText: NullableRichTextSchema.optional(),
        accessScope: UcatAccessScopeSchema.default('public'),
        setIds: z.array(z.string().uuid()).default([]),
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
    'update_mock',
    {
      title: 'Update a draft or in-review UCAT mock exam',
      description:
        'Apply explicit metadata and add/move/remove set-membership operations. Omission never deletes; published and stale writes are rejected atomically.',
      inputSchema: {
        id: z.string().uuid(),
        revision: z.string().min(1),
        operations: z.array(MockOperationSchema).min(1).max(100),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: writeAnnotations,
    },
    async ({ id, revision, operations }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => updateUcatMcpMock(client, id, revision, operations),
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
        'Request or reuse the supplementary AI assessment for a draft or in-review question stem. Assessment never publishes or changes lifecycle state.',
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
    'generate_ucat_image',
    {
      title: 'Generate and store a UCAT authoring image',
      description:
        'Generate an image through Altitutor’s configured server image pathway and return a preview URL, durable file ID, alt text, and ready-to-insert ProseMirror imageNode. It is not attached automatically. Reuse idempotencyKey unchanged after a timeout.',
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
      return executeUcatMcpIdempotent(
        client,
        'generate_ucat_image',
        idempotencyKey,
        request,
        async () => {
          const result = await generateUcatMcpImage(client, request)
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
    }),
  )

  server.registerTool(
    'revise_ucat_image',
    {
      title: 'Revise and store a UCAT authoring image',
      description:
        'Revise an accessible stored image through Altitutor’s configured image pathway. Returns a new preview/file and ready-to-insert imageNode; the source is retained and nothing is attached automatically. Reuse idempotencyKey unchanged after a timeout.',
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
      return executeUcatMcpIdempotent(
        client,
        'revise_ucat_image',
        idempotencyKey,
        request,
        async () => {
          const result = await reviseUcatMcpImage(client, request)
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
    }),
  )

  server.registerTool(
    'render_ucat_visual',
    {
      title: 'Render a deterministic UCAT visual',
      description:
        'Validate and render an inline Vega-Lite, Venn, or set-diagram visual into a ProseMirror image node without external data references.',
      inputSchema: {
        visual: z.unknown(),
      },
      outputSchema: z.object({
        imageNode: ImageNodeOutputSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ visual }, extra) => executeTool(extra.authInfo?.token, async () => {
      const parsed = GeneratedContentBlockSchema.safeParse(visual)
      if (!parsed.success || parsed.data.type !== 'visual') {
        throw new Error('A valid deterministic visual block is required')
      }
      return {
        imageNode: await generatedVisualBlockToImageNodeServer(parsed.data),
      }
    }),
  )

  server.registerTool(
    'get_ucat_file',
    {
      title: 'Read an accessible UCAT authoring file',
      description:
        'Read metadata and a fresh one-hour signed URL for a referenced authoring file accessible to the acting tutor.',
      inputSchema: {
        fileId: z.string().uuid(),
      },
      outputSchema: StructuredObjectOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ fileId }, extra) => executeTool(
      extra.authInfo?.token,
      (client) => getUcatMcpFile(client, fileId),
    ),
  )
}
