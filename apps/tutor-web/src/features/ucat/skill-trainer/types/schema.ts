import { z } from 'zod'
import { UCAT_SKILL_TRAINER_KEYS, type UcatSkillTrainerKey } from '@altitutor/shared'

const trainerKeyEnum = z.enum(
  UCAT_SKILL_TRAINER_KEYS as unknown as [UcatSkillTrainerKey, ...UcatSkillTrainerKey[]]
)

const jsonValue: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown())

const findWordKeywordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, 'Keyword text is required'),
  target_sentence_index: z.number().int().min(0),
})

const findConceptOccurrenceSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
})

export const ucatSkillTrainerItemFormSchema = z
  .object({
    skillTrainerId: z.string().min(1, 'Trainer type is required'),
    trainerKey: trainerKeyEnum,
    isActive: z.boolean(),
    passage: jsonValue.optional(),
    keywords: z.array(findWordKeywordSchema).optional(),
    concept: z.string().optional(),
    occurrences: z.array(findConceptOccurrenceSchema).optional(),
    statement: z.string().optional(),
    syllogismAnswer: z.boolean().optional(),
    expression: z.string().optional(),
    answer: z.coerce.number().optional(),
    buttonSequence: z.array(z.string()).optional(),
    label: z.string().optional(),
    question: jsonValue.optional(),
  })
  .superRefine((values, ctx) => {
    switch (values.trainerKey) {
      case 'find_word':
        if (!values.keywords?.length) {
          ctx.addIssue({ code: 'custom', message: 'At least one keyword is required', path: ['keywords'] })
        }
        break
      case 'find_concept':
        if (!values.concept?.trim()) {
          ctx.addIssue({ code: 'custom', message: 'Concept is required', path: ['concept'] })
        }
        if (!values.occurrences?.length) {
          ctx.addIssue({ code: 'custom', message: 'At least one occurrence is required', path: ['occurrences'] })
        }
        break
      case 'quick_syllogism':
        if (!values.statement?.trim()) {
          ctx.addIssue({ code: 'custom', message: 'Statement is required', path: ['statement'] })
        }
        if (values.syllogismAnswer == null) {
          ctx.addIssue({ code: 'custom', message: 'Answer is required', path: ['syllogismAnswer'] })
        }
        break
      case 'mental_maths':
        if (!values.expression?.trim()) {
          ctx.addIssue({ code: 'custom', message: 'Expression is required', path: ['expression'] })
        }
        if (values.answer == null || Number.isNaN(values.answer)) {
          ctx.addIssue({ code: 'custom', message: 'Answer is required', path: ['answer'] })
        }
        break
      case 'numpad_speed':
        if (!values.buttonSequence?.length) {
          ctx.addIssue({ code: 'custom', message: 'Button sequence is required', path: ['buttonSequence'] })
        }
        break
      case 'calculator_maths':
        if (values.answer == null || Number.isNaN(values.answer)) {
          ctx.addIssue({ code: 'custom', message: 'Answer is required', path: ['answer'] })
        }
        break
    }
  })

export type UcatSkillTrainerItemFormValues = z.infer<typeof ucatSkillTrainerItemFormSchema>
