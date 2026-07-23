import { z } from 'zod'

export const UcatContentTypeSchema = z.enum(['lesson', 'stem', 'set', 'mock'])
export const UcatStatusSchema = z.enum(['draft', 'in_review', 'published'])
export const UcatAccessScopeSchema = z.enum(['public', 'private'])
export const RichTextSchema = z.union([z.string(), z.record(z.unknown())])
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
  difficulty: z.number().min(0).max(1).nullable().optional(),
  timeBurdenSeconds: z.number().int().positive().nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(AnswerOptionInputSchema).default([]),
})

const QuestionChangesSchema = z.object({
  questionText: RichTextSchema.optional(),
  questionType: z.enum(['multiple_choice', 'syllogism']).optional(),
  answerExplanation: NullableRichTextSchema.optional(),
  difficulty: z.number().min(0).max(1).nullable().optional(),
  timeBurdenSeconds: z.number().int().positive().nullable().optional(),
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

export const LearningModuleBlockSchema = z.object({
  blockType: z.enum(['text', 'video', 'file', 'question_stem', 'question', 'skill_trainer']),
  requireCompletionBeforeNext: z.boolean().default(true),
  content: z.record(z.unknown()).default({}),
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
    changes: LearningModuleBlockSchema.partial(),
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

export type QuestionStemOperation = z.infer<typeof QuestionStemOperationSchema>
export type QuestionSetOperation = z.infer<typeof QuestionSetOperationSchema>
export type MockOperation = z.infer<typeof MockOperationSchema>
export type LearningModuleOperation = z.infer<typeof LearningModuleOperationSchema>
export type LearningModuleBlockInput = z.infer<typeof LearningModuleBlockSchema>
export type QuestionInput = z.infer<typeof QuestionInputSchema>

