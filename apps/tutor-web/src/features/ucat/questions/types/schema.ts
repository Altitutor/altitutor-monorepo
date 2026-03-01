import { z } from 'zod'
import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union<[z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny, z.ZodTypeAny]>([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ])
)

const nonEmptyRichTextSchema: z.ZodType<Json> = jsonSchema.refine(
  (value) => proseMirrorToPlainText(value)?.trim().length > 0,
  'Text is required'
)

export const ucatQuestionOptionSchema = z.object({
  answerText: nonEmptyRichTextSchema,
  answerExplanation: jsonSchema.nullable().optional(),
  isAnswer: z.boolean(),
  imageFileId: z.string().uuid().nullable().optional(),
})

export const ucatQuestionItemSchema = z.object({
  questionText: nonEmptyRichTextSchema,
  questionType: z.enum(['multiple_choice', 'syllogism']),
  answerExplanation: jsonSchema.nullable().optional(),
  difficulty: z.coerce.number().min(0).max(1).nullable().optional(),
  /** Time burden as mm:ss or seconds string; converted to number when submitting */
  timeBurdenSeconds: z.string().optional().nullable(),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(ucatQuestionOptionSchema).min(1, 'At least one option/statement is required'),
})

export const ucatQuestionStemSchema = z.object({
  sectionId: z.string().uuid('Section is required'),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: nonEmptyRichTextSchema,
  isPrivate: z.boolean().default(false),
  questions: z.array(ucatQuestionItemSchema).min(1, 'At least one question is required'),
})

export type UcatQuestionStemFormValues = z.infer<typeof ucatQuestionStemSchema>
