import { z } from 'zod'

export const UcatContentTypeSchema = z.enum(['lesson', 'stem', 'set', 'mock'])
export const UcatStatusSchema = z.enum(['draft', 'in_review', 'published'])
export const UcatAccessScopeSchema = z.enum(['public', 'private'])
export const UcatMcpAggregateTypeSchema = z.enum(['learning_module', 'stem', 'set', 'mock'])
export const UcatContentIdOrIdsSchema = z.union([
  z.string().uuid(),
  z.array(z.string().uuid()).min(1).max(25),
]).describe(
  'One aggregate ID, or an ordered batch of up to 25 IDs of the same contentType. Choose a batch size appropriate to the content size and calling harness.',
)
export const IdempotencyKeySchema = z.string().trim().min(8).max(200).describe(
  'Stable caller-generated key for this logical create/generation request. Reuse it unchanged after a timeout; use a new key for a materially different request.',
)
const MarkdownRichTextSchema = z.object({
  format: z.literal('markdown'),
  value: z.string(),
}).describe(
  'Explicit model-friendly formatted text. Common Markdown headings, ordered and unordered lists, pipe tables, blockquotes, fenced code blocks, horizontal rules, links, inline code, bold, italic, strike-through, inline LaTeX wrapped in \\(...\\), and display LaTeX wrapped in \\[...\\] are converted to TipTap/ProseMirror JSON.',
)
export const RichTextSchema = z.union([
  z.string(),
  MarkdownRichTextSchema,
  z.record(z.unknown()),
]).describe(
  'Rich text. Model-authored strings are normalized as Markdown-compatible rich text, including inline LaTeX wrapped in \\(...\\) and display LaTeX wrapped in \\[...\\]. The explicit {"format":"markdown","value":"## Heading\\n\\n- Item"} form remains supported, or provide a native TipTap/ProseMirror document object shaped like {"type":"doc","content":[...]} for exact control and embedded images.',
)
export const NullableRichTextSchema = RichTextSchema.nullable()

const PositionSchema = z.number().int().min(0)

export const AnswerOptionInputSchema = z.object({
  answerText: RichTextSchema,
  answerExplanation: NullableRichTextSchema.optional(),
  isAnswer: z.boolean().default(false),
})

export const QuestionInputSchema = z.object({
  questionText: RichTextSchema,
  questionType: z.enum(['multiple_choice', 'syllogism']).default('multiple_choice'),
  answerExplanation: NullableRichTextSchema.optional(),
  difficulty: z.number().min(0).max(1).nullable().optional().describe(
    'Expected proportion of the target UCAT candidate cohort who would answer incorrectly on first exposure under realistic section timing and without assistance. 0 is easiest, 1 is hardest, and null means unknown.',
  ),
  timeBurdenSeconds: z.number().int().positive().nullable().optional().describe(
    'Expected active working time in whole seconds to submit a fully correct first-exposure answer under realistic section timing and without assistance, with the question encountered in its authored stem position. Null means unknown.',
  ),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(AnswerOptionInputSchema).default([]),
})

const QuestionChangesSchema = z.object({
  questionText: RichTextSchema.optional(),
  questionType: z.enum(['multiple_choice', 'syllogism']).optional(),
  answerExplanation: NullableRichTextSchema.optional(),
  difficulty: z.number().min(0).max(1).nullable().optional().describe(
    'Expected proportion incorrect on first exposure under realistic section timing. 0 is easiest, 1 is hardest, and null means unknown.',
  ),
  timeBurdenSeconds: z.number().int().positive().nullable().optional().describe(
    'Expected active working time in whole seconds to submit a fully correct first-exposure answer in authored stem order. Null means unknown.',
  ),
  tagIds: z.array(z.string().uuid()).optional(),
})

const AnswerOptionChangesSchema = z.object({
  answerText: RichTextSchema.optional(),
  answerExplanation: NullableRichTextSchema.optional(),
  isAnswer: z.boolean().optional(),
})

export const QuestionStemOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_metadata'),
    sectionId: z.string().uuid().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    stemText: RichTextSchema.optional(),
    accessScope: UcatAccessScopeSchema.optional(),
    tutorSourceNote: z.string().max(4000).nullable().optional(),
  }),
  z.object({
    type: z.literal('add_question'),
    question: QuestionInputSchema,
    toIndex: PositionSchema.optional(),
  }),
  z.object({
    type: z.literal('update_question'),
    questionId: z.string().uuid(),
    changes: QuestionChangesSchema,
  }),
  z.object({
    type: z.literal('move_question'),
    questionId: z.string().uuid(),
    toIndex: PositionSchema,
  }),
  z.object({
    type: z.literal('remove_question'),
    questionId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('add_answer_option'),
    questionId: z.string().uuid(),
    option: AnswerOptionInputSchema,
    toIndex: PositionSchema.optional(),
  }),
  z.object({
    type: z.literal('update_answer_option'),
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
    changes: AnswerOptionChangesSchema,
  }),
  z.object({
    type: z.literal('move_answer_option'),
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
    toIndex: PositionSchema,
  }),
  z.object({
    type: z.literal('remove_answer_option'),
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  }),
])

export const QuestionSetOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_metadata'),
    name: NullableRichTextSchema.optional(),
    description: RichTextSchema.optional(),
    timeLimitSeconds: z.number().int().positive().nullable().optional(),
    accessScope: UcatAccessScopeSchema.optional(),
  }),
  z.object({
    type: z.literal('add_stem'),
    stemId: z.string().uuid(),
    toIndex: PositionSchema.optional(),
  }),
  z.object({
    type: z.literal('move_stem'),
    stemId: z.string().uuid(),
    toIndex: PositionSchema,
  }),
  z.object({
    type: z.literal('remove_stem'),
    stemId: z.string().uuid(),
  }),
])

export const MockOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_metadata'),
    name: z.string().trim().min(1).max(300).optional(),
    instructionsText: NullableRichTextSchema.optional(),
    accessScope: UcatAccessScopeSchema.optional(),
  }),
  z.object({
    type: z.literal('add_set'),
    setId: z.string().uuid(),
    toIndex: PositionSchema.optional(),
  }),
  z.object({
    type: z.literal('move_set'),
    setId: z.string().uuid(),
    toIndex: PositionSchema,
  }),
  z.object({
    type: z.literal('remove_set'),
    setId: z.string().uuid(),
  }),
])

const LearningModuleBlockCommonShape = {
  requireCompletionBeforeNext: z.boolean().default(true).describe(
    'Whether the student must complete this block before advancing.',
  ),
  questionStemId: z.string().uuid().nullable().optional(),
  questionId: z.string().uuid().nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
  skillTrainerId: z.string().uuid().nullable().optional(),
}

const TextBlockContentSchema = z.object({
  body: RichTextSchema.describe(
    'The visible lesson text. Use a plain string, an explicit Markdown value, or a native TipTap/ProseMirror document.',
  ),
}).passthrough().describe(
  'Text-block payload. Examples: {"body":"A concise explanation."} or {"body":{"format":"markdown","value":"## Strategy\\n\\n- Eliminate impossible answers"}}.',
)

const VideoBlockContentSchema = z.object({
  url: z.string().trim().url().describe(
    'Absolute video URL, such as a YouTube or Vimeo URL.',
  ),
}).describe(
  'Video-block payload. Example: {"url":"https://www.youtube.com/watch?v=..."}',
)

const FileBlockContentSchema = z.object({
  label: z.string().describe('Student-facing file label.').default(''),
  url: z.string().url().optional().describe(
    'Optional signed or public URL for display; fileId remains the durable reference.',
  ),
}).describe(
  'File-block display metadata. The durable uploaded file reference belongs in fileId.',
)

const LinkedBlockContentSchema = z.record(z.unknown()).default({}).describe(
  'Optional display or workflow metadata. Use an empty object for an ordinary linked resource.',
)

export const LearningModuleBlockSchema = z.discriminatedUnion('blockType', [
  z.object({
    ...LearningModuleBlockCommonShape,
    blockType: z.literal('text'),
    content: TextBlockContentSchema,
  }),
  z.object({
    ...LearningModuleBlockCommonShape,
    blockType: z.literal('video'),
    content: VideoBlockContentSchema,
  }),
  z.object({
    ...LearningModuleBlockCommonShape,
    blockType: z.literal('file'),
    fileId: z.string().uuid().describe('ID of an uploaded file returned by an MCP file/image tool.'),
    content: FileBlockContentSchema,
  }),
  z.object({
    ...LearningModuleBlockCommonShape,
    blockType: z.literal('question_stem'),
    questionStemId: z.string().uuid().describe('Question-stem aggregate to embed.'),
    content: LinkedBlockContentSchema,
  }),
  z.object({
    ...LearningModuleBlockCommonShape,
    blockType: z.literal('question'),
    questionId: z.string().uuid().describe('Individual question to embed.'),
    content: LinkedBlockContentSchema,
  }),
  z.object({
    ...LearningModuleBlockCommonShape,
    blockType: z.literal('skill_trainer'),
    skillTrainerId: z.string().uuid().describe('Skill trainer to embed.'),
    content: LinkedBlockContentSchema,
  }),
]).describe(
  'A typed lesson block. Each blockType has its own documented content and required durable reference.',
)

const LearningModuleBlockChangesSchema = z.object({
  blockType: z.enum(['text', 'video', 'file', 'question_stem', 'question', 'skill_trainer']).optional(),
  requireCompletionBeforeNext: z.boolean().optional(),
  content: z.record(z.unknown()).optional().describe(
    'Replacement payload for the resulting block type. For text use {"body":"plain text"}, {"body":{"format":"markdown","value":"## Heading\\n\\n- Item"}}, or a native TipTap/ProseMirror document in body; for video use {"url":"https://..."}.',
  ),
  questionStemId: z.string().uuid().nullable().optional(),
  questionId: z.string().uuid().nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
  skillTrainerId: z.string().uuid().nullable().optional(),
})

const LearningModuleMetadataSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).nullable().optional(),
  sectionId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  index: z.number().int().min(0).optional(),
  accessScope: UcatAccessScopeSchema.optional(),
  iconKey: z.string().trim().min(1).max(100).optional(),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  studyPlanPriority: z.enum(['essential', 'recommended', 'optional', 'excluded']).optional(),
  studyPlanCategoryIds: z.array(z.string().uuid()).optional(),
  studyPlanTagIds: z.array(z.string().uuid()).optional(),
})

export const LearningModuleOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_metadata'),
    changes: LearningModuleMetadataSchema,
  }),
  z.object({
    type: z.literal('add_block'),
    block: LearningModuleBlockSchema,
    toIndex: PositionSchema.optional(),
  }),
  z.object({
    type: z.literal('update_block'),
    blockId: z.string().uuid(),
    changes: LearningModuleBlockChangesSchema,
  }),
  z.object({
    type: z.literal('move_block'),
    blockId: z.string().uuid(),
    toIndex: PositionSchema,
  }),
  z.object({
    type: z.literal('remove_block'),
    blockId: z.string().uuid(),
  }),
])

export const AuditTargetSchema = z.object({
  contentType: UcatMcpAggregateTypeSchema,
  id: z.string().uuid(),
})

const AuditFilterSelectorSchema = z.object({
  kind: z.literal('filter'),
  contentType: UcatMcpAggregateTypeSchema,
  status: UcatStatusSchema.optional(),
  accessScope: UcatAccessScopeSchema.optional(),
  sectionId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
}).describe(
  'Server-side target selection. categoryId applies to stems; folderId applies to a learning-module subtree.',
)

export const AuditSelectorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({
    kind: z.literal('explicit'),
    targets: z.array(AuditTargetSchema).min(1).max(200),
  }),
  AuditFilterSelectorSchema,
])

export const AssessmentFindingRefSchema = z.object({
  assessmentRunId: z.string().uuid(),
  findingKey: z.string().trim().min(1).max(300),
  appliedExactSuggestion: z.boolean().default(false),
  reason: z.string().trim().max(4000).nullable().optional(),
})

export const ContentChangeMetadataSchema = {
  summary: z.string().trim().min(1).max(1000).describe(
    'Concise human-readable description of the intended published change.',
  ),
  rationale: z.string().trim().max(10_000).nullable().optional(),
  auditRunId: z.string().uuid().nullable().optional().describe(
    'Active auto-applying audit run authorising an unattended published write. Omit for an interactive edit.',
  ),
  findingRefs: z.array(AssessmentFindingRefSchema).max(100).optional().describe(
    'Automated-review findings addressed by this change. Set appliedExactSuggestion only when applying that exact generated patch.',
  ),
}

export type QuestionStemOperation = z.infer<typeof QuestionStemOperationSchema>
export type QuestionSetOperation = z.infer<typeof QuestionSetOperationSchema>
export type MockOperation = z.infer<typeof MockOperationSchema>
export type LearningModuleOperation = z.infer<typeof LearningModuleOperationSchema>
export type LearningModuleBlockInput = z.infer<typeof LearningModuleBlockSchema>
export type QuestionInput = z.infer<typeof QuestionInputSchema>
export type AuditTarget = z.infer<typeof AuditTargetSchema>
export type AuditSelector = z.infer<typeof AuditSelectorSchema>
export type AssessmentFindingRef = z.infer<typeof AssessmentFindingRefSchema>
