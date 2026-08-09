import { z } from 'zod'
import type { Json } from '@altitutor/shared'
import { hasRichTextContent } from '@/features/ucat/shared/lib/rich-text'

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
  (value) => hasRichTextContent(value),
  'Text or visual content is required'
)

const timeBurdenInputSchema = z.string().optional().nullable().refine(
  (value) => {
    const input = value?.trim() ?? ''
    if (input === '') return true
    if (/^\d+$/u.test(input)) return Number(input) > 0
    if (!/^\d+:[0-5]\d$/u.test(input)) return false
    const [minutes = '0', seconds = '0'] = input.split(':')
    return (Number(minutes) * 60) + Number(seconds) > 0
  },
  'Expected time to correct must be positive whole seconds or mm:ss.',
).describe(
  'Expected active working time to a fully correct first-exposure answer in authored stem order. Empty means unknown.',
)

/** Option answer/statement text; may be empty (only at least one option needs content). */
export const ucatQuestionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  answerText: jsonSchema,
  answerExplanation: jsonSchema.nullable().optional(),
  isAnswer: z.boolean(),
  answerKeyValue: z.enum(['correct', 'yes', 'no', 'most', 'least']).nullable().optional(),
})

export const ucatQuestionItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    questionText: nonEmptyRichTextSchema,
    questionType: z.enum(['multiple_choice', 'syllogism']),
    responseType: z.enum(['multiple_choice', 'drag_and_drop']).optional(),
    answerScheme: z.enum([
      'single_choice',
      'situational_judgement_rating',
      'decision_making_binary_placement',
      'situational_judgement_most_least',
    ]).optional(),
    /** For syllogism: 'Y'/'N' per option, e.g. 'YYNNY'. Only used in bulk import UI; not persisted to API. */
    syllogismAnswerPattern: z.string().nullable().optional(),
    answerExplanation: jsonSchema.nullable().optional(),
    difficulty: z.coerce.number().min(0).max(1).nullable().optional().describe(
      'Expected proportion incorrect on first exposure under realistic section timing. Higher means harder; null means unknown.',
    ),
    /** Expected time to a fully correct first-exposure answer, as mm:ss or whole seconds. */
    timeBurdenSeconds: timeBurdenInputSchema,
    tagIds: z.array(z.string().uuid()).default([]),
    sourceChannel: z.enum(['individual', 'bulk_import', 'ai_generation']).nullable().optional(),
    aiGenerationMetadata: jsonSchema.nullable().optional(),
    options: z.array(ucatQuestionOptionSchema).min(1, 'At least one option/statement is required'),
  })
  .refine(
    (data) => {
      return data.options.some((opt) => hasRichTextContent(opt.answerText))
    },
    { message: 'At least one answer option must have content.', path: ['options'] }
  )

export const ucatQuestionStemSchema = z
  .object({
    sectionId: z.string().uuid('Section is required'),
    categoryId: z.string().uuid().nullable().optional(),
    stemText: nonEmptyRichTextSchema,
    accessScope: z.enum(['public', 'private']).default('public'),
    tutorSourceNote: z.string().max(1000, 'Source note must be 1000 characters or fewer').nullable().optional(),
    status: z.enum(['published', 'in_review', 'draft']).optional(),
    questions: z.array(ucatQuestionItemSchema).min(1, 'At least one question is required'),
  })
  .superRefine((stem, context) => {
    if (
      stem.questions.some(
        (question) => question.answerScheme === 'situational_judgement_most_least',
      )
      && stem.questions.length !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions'],
        message: 'A Most/Least Appropriate stem must contain exactly one question.',
      })
    }
    if (
      stem.questions.every(
        (question) => question.answerScheme === 'situational_judgement_rating',
      )
      && stem.questions.length > 6
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions'],
        message: 'An SJT rating stem may contain at most six questions.',
      })
    }
  })

export type UcatQuestionStemFormValues = z.infer<typeof ucatQuestionStemSchema>
