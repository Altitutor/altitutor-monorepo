import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js'
import { z } from 'zod'
import {
  LearningModuleBlockSchema,
  RichTextSchema,
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
})
