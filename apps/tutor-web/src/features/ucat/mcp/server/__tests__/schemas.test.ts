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
})
