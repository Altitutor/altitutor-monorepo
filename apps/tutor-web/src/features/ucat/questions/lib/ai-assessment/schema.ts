import { z } from 'zod'
import type { Json } from '@altitutor/shared'

export const AI_ASSESSMENT_PROMPT_VERSION = 4

export const UcatAssessmentCategorySchema = z.enum([
  'presentation_integrity',
  'ucat_suitability',
  'answer_correctness_fairness',
  'explanation_quality',
  // Legacy keys remain valid so historical runs continue to render.
  'answer_validity',
  'explanation_teaching_quality',
  'question_clarity_fairness',
  'difficulty_timing',
  'ucat_authenticity_task_quality',
  'content_appropriateness',
  'visual_integrity',
])

export const UcatAssessmentRatingSchema = z.enum([
  'pass',
  'concern',
  'critical',
  'unreviewable',
  'not_applicable',
])

export const UcatFormatCheckSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  severity: z.enum(['error', 'warning']),
  scopeType: z.enum(['shared', 'question']),
  questionId: z.string().uuid().nullable().optional(),
  questionIndex: z.number().int().nonnegative().nullable().optional(),
})

const TextTargetSchema = z.object({
  kind: z.enum(['stem', 'question', 'option']),
  id: z.string().uuid().nullable().optional(),
  field: z.enum(['stem_text', 'question_text', 'answer_text', 'answer_explanation']),
})

const PatchValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
])

const ReplacementOptionSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  answerText: z.string().trim().min(1),
  answerExplanation: z.string().trim().nullable().optional(),
  isAnswer: z.boolean(),
})

const ReplacementQuestionSchema = z.object({
  questionText: z.string().trim().min(1),
  questionType: z.enum(['multiple_choice', 'syllogism']),
  answerExplanation: z.string().trim().nullable().optional(),
  difficulty: z.number().min(0).max(1).nullable().optional(),
  timeBurdenSeconds: z.number().int().positive().nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(ReplacementOptionSchema).min(1).max(8),
})

export const UcatAssessmentPatchSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('replace_text'),
    target: TextTargetSchema,
    beforeText: z.string().min(1),
    afterText: z.string().min(1),
  }),
  z.object({
    operation: z.literal('set_answer_key'),
    questionId: z.string().uuid(),
    currentCorrectOptionId: z.string().uuid().nullable(),
    correctOptionId: z.string().uuid(),
  }),
  z.object({
    operation: z.literal('replace_option_and_key'),
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
    beforeAnswerText: z.string().trim().min(1),
    answerText: z.string().trim().min(1),
    answerExplanation: z.string().trim().nullable().optional(),
  }),
  z.object({
    operation: z.literal('set_text'),
    target: TextTargetSchema,
    beforeText: z.string().nullable(),
    afterText: z.string().trim().min(1),
  }),
  z.object({
    operation: z.literal('replace_question'),
    questionId: z.string().uuid(),
    beforeQuestionText: z.string().trim().min(1),
    question: ReplacementQuestionSchema,
  }),
  z.object({
    operation: z.literal('insert_question'),
    afterQuestionId: z.string().uuid().nullable(),
    question: ReplacementQuestionSchema,
  }),
  z.object({
    operation: z.literal('remove_question'),
    questionId: z.string().uuid(),
    beforeQuestionText: z.string().trim().min(1),
  }),
  z.object({
    operation: z.literal('insert_option'),
    questionId: z.string().uuid(),
    afterOptionId: z.string().uuid().nullable(),
    option: ReplacementOptionSchema,
  }),
  z.object({
    operation: z.literal('remove_option'),
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
    beforeAnswerText: z.string().trim().min(1),
  }),
  z.object({
    operation: z.literal('reorder_options'),
    questionId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).min(1).max(8),
  }),
  z.object({
    operation: z.literal('set_metadata'),
    targetKind: z.enum(['stem', 'question']),
    targetId: z.string().uuid(),
    field: z.enum([
      'section_id',
      'category_id',
      'difficulty',
      'time_burden_seconds',
      'tag_ids',
      'question_type',
    ]),
    before: PatchValueSchema,
    after: PatchValueSchema,
  }),
  z.object({
    operation: z.literal('update_visual_spec'),
    target: TextTargetSchema,
    imageIndex: z.number().int().nonnegative(),
    visualType: z.enum(['venn_diagram', 'set_diagram', 'vega_lite_chart']),
    beforeSpec: z.record(z.string(), z.unknown()),
    afterSpec: z.record(z.string(), z.unknown()),
    title: z.string().nullable().optional(),
    altText: z.string().nullable().optional(),
  }),
])

export const UcatAssessmentSuggestionSchema = z.object({
  id: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  application: z.enum(['auto_apply', 'approval_required']).default('approval_required'),
  patches: z.array(UcatAssessmentPatchSchema).min(1).max(8),
})

export const BlindQuestionSolutionSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().trim().min(1).nullable().optional(),
  proposedAnswer: z.string().trim().nullable().optional(),
  syllogismAnswers: z.array(z.object({
    optionId: z.string().uuid(),
    answer: z.enum(['yes', 'no']),
  })).optional().default([]),
  justification: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  ambiguous: z.boolean().default(false),
  unsolvable: z.boolean().default(false),
})

export const BlindSolutionResponseSchema = z.object({
  solutions: z.array(BlindQuestionSolutionSchema),
})

export const UcatAssessmentCategoryResultSchema = z.object({
  scopeType: z.enum(['shared', 'question']),
  questionId: z.string().uuid().nullable().optional(),
  category: UcatAssessmentCategorySchema,
  rating: UcatAssessmentRatingSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1),
  evidence: z.array(z.string().trim().min(1)).max(8).default([]),
})

export const UcatAssessmentFindingSchema = z.object({
  key: z.string().trim().min(1),
  scopeType: z.enum(['shared', 'question']),
  questionId: z.string().uuid().nullable().optional(),
  category: UcatAssessmentCategorySchema,
  rating: z.enum(['concern', 'critical', 'unreviewable']),
  confidence: z.number().min(0).max(1),
  title: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  evidence: z.array(z.string().trim().min(1)).max(8).default([]),
  recommendedAction: z.enum(['fix', 'review', 'exclude']).default('review'),
  suggestion: UcatAssessmentSuggestionSchema.nullable().optional(),
})

export const UcatAssessmentResponseSchema = z.object({
  overallSummary: z.string().trim().min(1),
  categories: z.array(UcatAssessmentCategoryResultSchema),
  findings: z.array(UcatAssessmentFindingSchema),
})

export type UcatAssessmentCategory = z.infer<typeof UcatAssessmentCategorySchema>
export type UcatAssessmentRating = z.infer<typeof UcatAssessmentRatingSchema>
export type UcatFormatCheck = z.infer<typeof UcatFormatCheckSchema>
export type BlindSolutionResponse = z.infer<typeof BlindSolutionResponseSchema>
export type UcatAssessmentPatch = z.infer<typeof UcatAssessmentPatchSchema>
export type UcatAssessmentSuggestion = z.infer<typeof UcatAssessmentSuggestionSchema>
export type UcatAssessmentFinding = z.infer<typeof UcatAssessmentFindingSchema>
export type UcatAssessmentResponse = z.infer<typeof UcatAssessmentResponseSchema>

export type UcatAssessmentImage = {
  location: string
  index: number
  src: string | null
  fileId: string | null
  storagePath: string | null
  alt: string | null
  visualType: string | null
  visualSpec: Record<string, unknown> | null
  visualTitle: string | null
  visualAltText: string | null
  modelWidth: number | null
  modelHeight: number | null
  authoringMetadata: Record<string, unknown> | null
}

export type UcatAssessmentOptionSnapshot = {
  id: string
  index: number
  answerText: Json
  answerTextPlain: string
  answerExplanation: Json | null
  answerExplanationPlain: string
  isAnswer: boolean
  images: UcatAssessmentImage[]
}

export type UcatAssessmentQuestionSnapshot = {
  id: string
  index: number
  questionText: Json
  questionTextPlain: string
  answerExplanation: Json | null
  answerExplanationPlain: string
  questionType: 'multiple_choice' | 'syllogism'
  difficulty: number | null
  timeBurdenSeconds: number | null
  tagIds: string[]
  tagNames: string[]
  images: UcatAssessmentImage[]
  options: UcatAssessmentOptionSnapshot[]
}

export type UcatAssessmentSnapshot = {
  stemId: string
  status: 'draft' | 'in_review' | 'published'
  sourceChannel?: 'individual' | 'bulk_import' | 'ai_generation' | null
  statusChangedAt?: string | null
  statusChangedBy?: string | null
  updatedBy?: string | null
  sectionId: string
  sectionName: string
  sectionNumber: number
  displayColumns: number
  categoryId: string | null
  categoryName: string | null
  accessScope: 'public' | 'private'
  stemText: Json
  stemTextPlain: string
  images: UcatAssessmentImage[]
  questions: UcatAssessmentQuestionSnapshot[]
}

export type UcatAssessmentFingerprints = {
  content: string
  shared: string
  questions: Record<string, string>
}
