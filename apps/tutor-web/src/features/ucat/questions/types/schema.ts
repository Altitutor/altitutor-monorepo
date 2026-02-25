import { z } from 'zod'

export const ucatQuestionOptionSchema = z.object({
  answerText: z.string().min(1, 'Answer text is required'),
  answerExplanation: z.string().optional(),
  isAnswer: z.boolean(),
})

export const ucatQuestionItemSchema = z.object({
  questionText: z.string().min(1, 'Question text is required'),
  questionType: z.enum(['multiple_choice', 'syllogism']),
  difficulty: z.coerce.number().min(0).max(1).nullable().optional(),
  timeBurdenSeconds: z.coerce.number().int().positive().nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(ucatQuestionOptionSchema).min(1, 'At least one option/statement is required'),
})

export const ucatQuestionStemSchema = z.object({
  sectionId: z.string().uuid('Section is required'),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: z.string().min(1, 'Stem text is required'),
  isPrivate: z.boolean().default(false),
  questions: z.array(ucatQuestionItemSchema).min(1, 'At least one question is required'),
})

export type UcatQuestionStemFormValues = z.infer<typeof ucatQuestionStemSchema>
