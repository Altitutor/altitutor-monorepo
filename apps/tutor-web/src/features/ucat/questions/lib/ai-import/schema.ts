import { z } from 'zod'

export const AiImportSectionKeySchema = z.enum([
  'verbal_reasoning',
  'decision_making',
  'quantitative_reasoning',
  'situational_judgement',
])

export type AiImportSectionKey = z.infer<typeof AiImportSectionKeySchema>

export const AiImportIssueSeveritySchema = z.enum(['low', 'medium', 'high'])

export const AiImportIssueCodeSchema = z.enum([
  'missing_answer',
  'missing_explanation',
  'ambiguous_answer',
  'low_confidence',
  'image_dependent',
  'format_mismatch',
  'section_mismatch',
])

export const AiImportIssueSchema = z.object({
  code: AiImportIssueCodeSchema,
  severity: AiImportIssueSeveritySchema,
  message: z.string().min(1),
})

export type AiImportIssue = z.infer<typeof AiImportIssueSchema>

export const AiImportSourceEvidenceSchema = z.object({
  blockId: z.string().min(1),
  snippet: z.string().min(1),
})

export const AiImportExtractOptionSchema = z.object({
  answerText: z.string().min(1),
  isAnswer: z.boolean(),
  answerExplanation: z.string().nullable().optional(),
})

export const AiImportExtractQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['multiple_choice', 'syllogism']).default('multiple_choice'),
  options: z.array(AiImportExtractOptionSchema).min(1),
  answerExplanation: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  imageDependent: z.boolean().default(false),
  sourceEvidence: z.array(AiImportSourceEvidenceSchema).default([]),
  issues: z.array(AiImportIssueSchema).default([]),
  qcSkippedReasons: z.array(z.string()).default([]),
})

export const AiImportExtractStemSchema = z.object({
  stemText: z.string().min(1),
  questions: z.array(AiImportExtractQuestionSchema).min(1),
  sourceEvidence: z.array(AiImportSourceEvidenceSchema).default([]),
  issues: z.array(AiImportIssueSchema).default([]),
})

export const AiImportExtractResponseSchema = z.object({
  status: z.enum(['success', 'rejected']),
  rejectionReason: z.string().nullable().optional(),
  sourceSummary: z
    .object({
      estimatedQuestions: z.number().int().nonnegative().default(0),
      estimatedAnswerRows: z.number().int().nonnegative().default(0),
      imageCount: z.number().int().nonnegative().default(0),
      blockCount: z.number().int().nonnegative().default(0),
    })
    .default({
      estimatedQuestions: 0,
      estimatedAnswerRows: 0,
      imageCount: 0,
      blockCount: 0,
    }),
  stems: z.array(AiImportExtractStemSchema).default([]),
  globalIssues: z.array(AiImportIssueSchema).default([]),
})

export type AiImportExtractResponse = z.infer<typeof AiImportExtractResponseSchema>

export const AiImportStemQuestionOptionPayloadSchema = z.object({
  index: z.number().int().positive(),
  answerText: z.unknown(),
  answerExplanation: z.unknown().nullable().optional(),
  isAnswer: z.boolean(),
})

export const AiImportStemQuestionPayloadSchema = z.object({
  index: z.number().int().positive(),
  questionText: z.unknown(),
  answerExplanation: z.unknown().nullable().optional(),
  difficulty: z.number().nullable().optional(),
  timeBurdenSeconds: z.number().nullable().optional(),
  questionType: z.enum(['multiple_choice', 'syllogism']),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(AiImportStemQuestionOptionPayloadSchema).min(1),
})

export const AiImportDraftStemPayloadSchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: z.unknown(),
  isPrivate: z.boolean().default(true),
  questions: z.array(AiImportStemQuestionPayloadSchema).min(1),
  aiGenerationMetadata: z.unknown().nullable().optional(),
})

export type AiImportDraftStemPayload = z.infer<typeof AiImportDraftStemPayloadSchema>

export const AiImportGenerateMissingUpdateSchema = z.object({
  stemIndex: z.number().int().nonnegative(),
  questionIndex: z.number().int().nonnegative(),
  correctOptionIndex: z.number().int().nonnegative().nullable().optional(),
  answerExplanation: z.string().nullable().optional(),
  optionExplanations: z.array(z.string().nullable()).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  rationale: z.string().min(1),
  unresolved: z.boolean().default(false),
})

export const AiImportGenerateMissingResponseSchema = z.object({
  updates: z.array(AiImportGenerateMissingUpdateSchema).default([]),
})

export type AiImportGenerateMissingResponse = z.infer<typeof AiImportGenerateMissingResponseSchema>

export const AiImportQcIssueSchema = z.object({
  stemIndex: z.number().int().nonnegative(),
  questionIndex: z.number().int().nonnegative(),
  severity: AiImportIssueSeveritySchema,
  category: z.enum([
    'section_fit',
    'question_quality',
    'answer_correctness',
    'explanation_quality',
    'ambiguity',
  ]),
  message: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
  skipped: z.boolean().default(false),
})

export const AiImportQcResponseSchema = z.object({
  issues: z.array(AiImportQcIssueSchema).default([]),
})

export type AiImportQcResponse = z.infer<typeof AiImportQcResponseSchema>
