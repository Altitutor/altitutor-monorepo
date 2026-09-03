import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js'
import { z } from 'zod'
import {
  AuditSelectorSchema,
  ChangeMockInputSchema,
  ChangeQuestionSetInputSchema,
  ContentChangeMetadataSchema,
  CreateMockInputSchema,
  CreateQuestionSetInputSchema,
  LearningModuleBlockSchema,
  RichTextSchema,
  UcatContentIdOrIdsSchema,
} from '@/features/ucat/mcp/server/schemas'

describe('UCAT MCP authoring schemas', () => {
  it('accepts the recommended plain-string text-block contract', () => {
    expect(LearningModuleBlockSchema.parse({
      blockType: 'text',
      content: { body: 'A concise lesson paragraph.' },
    })).toEqual({
      blockType: 'text',
      requireCompletionBeforeNext: true,
      content: { body: 'A concise lesson paragraph.' },
    })
  })

  it('requires block-specific references and payloads', () => {
    expect(LearningModuleBlockSchema.safeParse({
      blockType: 'video',
      content: {},
    }).success).toBe(false)
    expect(LearningModuleBlockSchema.safeParse({
      blockType: 'question_stem',
      content: {},
    }).success).toBe(false)
  })

  it('accepts native TipTap/ProseMirror JSON for advanced rich text', () => {
    expect(RichTextSchema.safeParse({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Strategy' }] }],
    }).success).toBe(true)
  })

  it('accepts explicit Markdown for model-friendly formatted rich text', () => {
    expect(RichTextSchema.safeParse({
      format: 'markdown',
      value: '## Strategy\n\n- Eliminate impossible answers',
    }).success).toBe(true)
  })

  it('preserves the text-block contract through MCP JSON Schema conversion', () => {
    const jsonSchema = toJsonSchemaCompat(z.object({
      blocks: z.array(LearningModuleBlockSchema),
    }))
    const serialized = JSON.stringify(jsonSchema)

    expect(serialized).toContain('"body"')
    expect(serialized).toContain('"markdown"')
    expect(serialized).toContain('TipTap/ProseMirror')
    expect(serialized).toContain('"questionStemId"')
  })

  it('supports resumable manual, explicit, and filtered audit selection', () => {
    expect(AuditSelectorSchema.parse({ kind: 'manual' })).toEqual({ kind: 'manual' })
    expect(AuditSelectorSchema.safeParse({
      kind: 'explicit',
      targets: [{
        contentType: 'stem',
        id: '60000000-0000-0000-0000-000000000001',
      }],
    }).success).toBe(true)
    expect(AuditSelectorSchema.safeParse({
      kind: 'filter',
      contentType: 'stem',
      statuses: ['published', 'in_review'],
      auditFilters: ['not_audited'],
    }).success).toBe(true)
    expect(AuditSelectorSchema.safeParse({
      kind: 'filter',
      contentType: 'stem',
      filter: {
        any: [
          { clause: { auditFilters: ['not_audited'] } },
          { clause: { auditFilters: ['73100000-0000-0000-0000-000000000001:failed'] } },
        ],
      },
    }).success).toBe(true)
    expect(AuditSelectorSchema.safeParse({
      kind: 'filter',
      contentType: 'set',
      status: 'published',
      accessScope: 'public',
    }).success).toBe(true)
  })

  it('retains multiple automated-review finding references on one change', () => {
    expect(ContentChangeMetadataSchema.findingRefs.parse([
      {
        assessmentRunId: '60000000-0000-0000-0000-000000000001',
        findingKey: 'missing-explanation',
        appliedExactSuggestion: false,
      },
      {
        assessmentRunId: '60000000-0000-0000-0000-000000000001',
        findingKey: 'weak-distractor',
        appliedExactSuggestion: true,
      },
    ])).toHaveLength(2)
  })

  it('accepts either one content ID or an ordered batch', () => {
    const first = '60000000-0000-0000-0000-000000000001'
    const second = '60000000-0000-0000-0000-000000000002'

    expect(UcatContentIdOrIdsSchema.parse(first)).toBe(first)
    expect(UcatContentIdOrIdsSchema.parse([first, second])).toEqual([first, second])
    expect(UcatContentIdOrIdsSchema.safeParse([]).success).toBe(false)
    expect(UcatContentIdOrIdsSchema.safeParse(Array.from({ length: 26 }, () => first)).success)
      .toBe(false)
  })

  it('keeps set and mock intent fields in the runtime and exposed MCP contracts', () => {
    const sectionId = '50000000-0000-0000-0000-000000000001'
    const blueprintId = '70000000-0000-0000-0000-000000000001'
    const idempotencyKey = '80000000-0000-0000-0000-000000000001'

    expect(CreateQuestionSetInputSchema.safeParse({
      idempotencyKey,
      description: 'Practice set',
      setFormat: 'partial_section',
      sectionId,
      referenceBlueprintId: blueprintId,
    }).success).toBe(true)
    expect(CreateQuestionSetInputSchema.safeParse({
      idempotencyKey,
      description: 'Missing intent',
      sectionId,
    }).success).toBe(false)
    expect(CreateMockInputSchema.safeParse({
      idempotencyKey,
      blueprintId,
    }).success).toBe(true)

    const serialized = JSON.stringify({
      createSet: toJsonSchemaCompat(CreateQuestionSetInputSchema),
      changeSet: toJsonSchemaCompat(ChangeQuestionSetInputSchema),
      createMock: toJsonSchemaCompat(CreateMockInputSchema),
      changeMock: toJsonSchemaCompat(ChangeMockInputSchema),
    })
    expect(serialized).toContain('referenceBlueprintId')
    expect(serialized).toContain('setFormat')
    expect(serialized).toContain('blueprintId')
    expect(serialized).toContain('replace_stems')
    expect(serialized).toContain('replace_section_sets')
  })
})
