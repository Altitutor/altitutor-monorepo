import { z } from 'zod'
import type { Json } from '@altitutor/shared'

/** Keep in sync with public.ucat_current_ai_assessment_prompt_version(). */
export const AI_ASSESSMENT_PROMPT_VERSION = 18

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
  optionIndex: z.number().int().nonnegative().nullable().optional(),
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

const RichContentSchema: z.ZodType<Json> = z.custom<Json>((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.type === 'doc' && Array.isArray(record.content)
}, 'A ProseMirror document is required.')

const ReplacementOptionSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  answerText: z.string().trim().min(1),
  answerExplanation: z.string().trim().nullable().optional(),
  answerKeyValue: z.enum(['correct', 'yes', 'no', 'most', 'least']).nullable(),
})

const ReplacementQuestionSchema = z.object({
  questionText: z.string().trim().min(1),
  responseType: z.enum(['multiple_choice', 'drag_and_drop']),
  answerScheme: z.enum(['single_choice', 'situational_judgement_rating', 'decision_making_binary_placement', 'situational_judgement_most_least']),
  answerExplanation: z.string().trim().nullable().optional(),
  difficulty: z.number().min(0).max(1).nullable().optional().describe(
    'Expected proportion incorrect on first exposure under realistic section timing. 0 is easiest, 1 is hardest, and null means unknown.',
  ),
  timeBurdenSeconds: z.number().int().positive().nullable().optional().describe(
    'Expected active working time in whole seconds to submit a fully correct first-exposure answer in authored stem order. Null means unknown.',
  ),
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
    operation: z.literal('set_rich_content'),
    target: TextTargetSchema,
    before: RichContentSchema,
    after: RichContentSchema,
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
      'response_type',
      'answer_scheme',
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
  placementAnswers: z.array(z.object({
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

export function parseUcatAssessmentResponse(value: unknown): UcatAssessmentResponse {
  const direct = UcatAssessmentResponseSchema.safeParse(value)
  if (direct.success) return direct.data

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of ['audit', 'assessment']) {
      const wrapped = UcatAssessmentResponseSchema.safeParse(record[key])
      if (wrapped.success) return wrapped.data
    }
  }

  return UcatAssessmentResponseSchema.parse(value)
}

const BulkImportUnresolvedFindingSchema = UcatAssessmentFindingSchema.omit({
  suggestion: true,
})

export const BulkImportRepairItemSchema = z.object({
  summary: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  // Confidence is model output, not transport validity. Automation policy is
  // applied after parsing so a cautious repair can still reach tutor review.
  confidence: z.number().min(0).max(1),
  resolvedFindingKeys: z.array(z.string().trim().min(1)).max(20).default([]),
  patches: z.array(UcatAssessmentPatchSchema).min(1).max(12),
})

export const BulkImportRepairResponseSchema = z.object({
  overallSummary: z.string().trim().min(1),
  repairs: z.array(BulkImportRepairItemSchema).max(50),
  unresolvedFindings: z.array(BulkImportUnresolvedFindingSchema).max(50),
})

export const BulkImportAuditRepairResponseSchema = z.object({
  audit: UcatAssessmentResponseSchema,
  repair: BulkImportRepairResponseSchema,
})

export const BulkImportReviewDirectiveKindSchema = z.enum([
  'explanation',
  'metadata',
  'answer_key',
  'content',
  'structure',
  'visual',
])

function directiveKindForPatch(
  patch: z.infer<typeof UcatAssessmentPatchSchema>,
): z.infer<typeof BulkImportReviewDirectiveKindSchema> {
  if (
    patch.operation === 'set_text'
    && patch.target.field === 'answer_explanation'
  ) return 'explanation'
  if (patch.operation === 'set_metadata') return 'metadata'
  if (patch.operation === 'set_answer_key') return 'answer_key'
  if (patch.operation === 'update_visual_spec') return 'visual'
  if (
    patch.operation === 'replace_text'
    || patch.operation === 'set_text'
    || patch.operation === 'set_rich_content'
  ) return 'content'
  return 'structure'
}

export const BulkImportReviewDirectiveSchema = z.object({
  kind: BulkImportReviewDirectiveKindSchema,
  summary: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  resolvedFindingKeys: z.array(z.string().trim().min(1)).max(20).default([]),
  patch: UcatAssessmentPatchSchema,
}).superRefine((directive, context) => {
  const expected = directiveKindForPatch(directive.patch)
  if (directive.kind !== expected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['kind'],
      message: `Directive kind must be ${expected} for ${directive.patch.operation}.`,
    })
  }
})

export const BulkImportReviewPlanSchema = z.object({
  overallSummary: z.string().trim().min(1),
  directives: z.array(BulkImportReviewDirectiveSchema).max(50),
  manualFindings: z.array(BulkImportUnresolvedFindingSchema).max(50),
})

export const BulkImportAuditDirectiveResponseSchema = z.object({
  audit: UcatAssessmentResponseSchema,
  review: BulkImportReviewPlanSchema,
})

function normalizeDirectiveResponse(
  response: z.infer<typeof BulkImportAuditDirectiveResponseSchema>,
): BulkImportAuditRepairResponse {
  return {
    audit: response.audit,
    repair: {
      overallSummary: response.review.overallSummary,
      repairs: response.review.directives.map((directive) => ({
        summary: directive.summary,
        rationale: directive.rationale,
        confidence: directive.confidence,
        resolvedFindingKeys: directive.resolvedFindingKeys,
        patches: [directive.patch],
      })),
      unresolvedFindings: response.review.manualFindings,
    },
  }
}

/**
 * Preserve a valid audit and valid sibling repairs when one model-generated
 * repair is malformed. Model uncertainty or formatting must not erase the
 * tutor-visible review of the whole stem.
 */
export function parseBulkImportAuditRepairResponse(value: unknown): BulkImportAuditRepairResponse {
  const directiveResponse = BulkImportAuditDirectiveResponseSchema.safeParse(value)
  if (directiveResponse.success) return normalizeDirectiveResponse(directiveResponse.data)

  const direct = BulkImportAuditRepairResponseSchema.safeParse(value)
  if (direct.success) return direct.data

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return BulkImportAuditRepairResponseSchema.parse(value)
  }
  const record = value as Record<string, unknown>
  const audit = UcatAssessmentResponseSchema.parse(record.audit)
  const usesDirectiveContract = Boolean(record.review)
  const rawPlan = usesDirectiveContract ? record.review : record.repair
  const repairRecord = rawPlan && typeof rawPlan === 'object' && !Array.isArray(rawPlan)
    ? rawPlan as Record<string, unknown>
    : {}
  const rawRepairCandidates = usesDirectiveContract
    ? repairRecord.directives
    : repairRecord.repairs
  const rawUnresolvedCandidates = usesDirectiveContract
    ? repairRecord.manualFindings
    : repairRecord.unresolvedFindings
  const repairCandidates = Array.isArray(rawRepairCandidates) ? rawRepairCandidates : []
  const unresolvedCandidates = Array.isArray(rawUnresolvedCandidates)
    ? rawUnresolvedCandidates
    : []
  const repairs = repairCandidates.flatMap((candidate) => {
    if (usesDirectiveContract) {
      const parsed = BulkImportReviewDirectiveSchema.safeParse(candidate)
      return parsed.success
        ? [{
            summary: parsed.data.summary,
            rationale: parsed.data.rationale,
            confidence: parsed.data.confidence,
            resolvedFindingKeys: parsed.data.resolvedFindingKeys,
            patches: [parsed.data.patch],
          }]
        : []
    }
    const parsed = BulkImportRepairItemSchema.safeParse(candidate)
    return parsed.success ? [parsed.data] : []
  })
  const unresolvedFindings = unresolvedCandidates.flatMap((candidate) => {
    const parsed = BulkImportUnresolvedFindingSchema.safeParse(candidate)
    return parsed.success ? [parsed.data] : []
  })
  const invalidCount = (repairCandidates.length - repairs.length)
    + (unresolvedCandidates.length - unresolvedFindings.length)
  if (invalidCount > 0 || !rawPlan) {
    unresolvedFindings.push({
      key: 'model-repair-output-incomplete',
      scopeType: 'shared',
      questionId: null,
      category: 'presentation_integrity',
      rating: 'concern',
      confidence: 0,
      title: 'Some AI fixes need another review',
      detail: `${Math.max(1, invalidCount)} proposed ${Math.max(1, invalidCount) === 1 ? 'change was' : 'changes were'} not safely interpretable. Valid review comments and fixes were preserved.`,
      evidence: [],
      recommendedAction: 'review',
    })
  }
  const summary = typeof repairRecord.overallSummary === 'string'
    && repairRecord.overallSummary.trim()
    ? repairRecord.overallSummary.trim()
    : audit.overallSummary
  return {
    audit,
    repair: {
      overallSummary: summary,
      repairs,
      unresolvedFindings,
    },
  }
}

export type UcatAssessmentCategory = z.infer<typeof UcatAssessmentCategorySchema>
export type UcatAssessmentRating = z.infer<typeof UcatAssessmentRatingSchema>
export type UcatFormatCheck = z.infer<typeof UcatFormatCheckSchema>
export type BlindSolutionResponse = z.infer<typeof BlindSolutionResponseSchema>
export type UcatAssessmentPatch = z.infer<typeof UcatAssessmentPatchSchema>
export type UcatAssessmentSuggestion = z.infer<typeof UcatAssessmentSuggestionSchema>
export type UcatAssessmentFinding = z.infer<typeof UcatAssessmentFindingSchema>
export type UcatAssessmentResponse = z.infer<typeof UcatAssessmentResponseSchema>
export type BulkImportRepairResponse = z.infer<typeof BulkImportRepairResponseSchema>
export type BulkImportAuditRepairResponse = z.infer<typeof BulkImportAuditRepairResponseSchema>

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
  answerKeyValue: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
  images: UcatAssessmentImage[]
}

export type UcatAssessmentQuestionSnapshot = {
  id: string
  index: number
  questionText: Json
  questionTextPlain: string
  answerExplanation: Json | null
  answerExplanationPlain: string
  responseType: 'multiple_choice' | 'drag_and_drop'
  answerScheme: 'single_choice' | 'situational_judgement_rating' | 'decision_making_binary_placement' | 'situational_judgement_most_least'
  sourceChannel?: 'individual' | 'bulk_import' | 'ai_generation' | null
  aiGenerationMetadata?: Json | null
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
  updatedAt?: string | null
  tutorSourceNote?: string | null
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
