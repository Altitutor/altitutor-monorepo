import { z } from 'zod'

export const DifficultyTargetSchema = z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed')
export const TimeBurdenTargetSchema = z.enum(['low', 'medium', 'high', 'mixed']).default('mixed')

export type DifficultyTarget = z.infer<typeof DifficultyTargetSchema>
export type TimeBurdenTarget = z.infer<typeof TimeBurdenTargetSchema>

const GeneratedTableBlockSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const table = value as Record<string, unknown>
  if (table.type !== 'table' || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return value
  const objectColumns = table.columns.every(
    (column) => column && typeof column === 'object' && !Array.isArray(column)
  )
  if (!objectColumns) return value

  const columns = table.columns.map((column, index) => {
    const record = column as Record<string, unknown>
    return {
      accessor: String(record.accessor ?? record.key ?? index),
      header: String(record.header ?? record.label ?? record.accessor ?? record.key ?? index),
    }
  })
  return {
    ...table,
    columns: columns.map((column) => column.header),
    rows: table.rows.map((row) => {
      if (Array.isArray(row)) return row.map((cell) => String(cell))
      const record = row && typeof row === 'object' ? row as Record<string, unknown> : {}
      return columns.map((column) => String(record[column.accessor] ?? ''))
    }),
  }
}, z.object({
  type: z.literal('table'),
  caption: z.string().trim().optional().nullable(),
  columns: z.array(z.string().trim().min(1)).min(1).max(10),
  rows: z.array(z.array(z.string().trim().min(1)).min(1).max(10)).min(1).max(20),
}))

export const GeneratedContentBlockSchema = z.union([
  z.object({
    type: z.literal('paragraph'),
    text: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().optional().default(false),
    items: z.array(z.string().trim().min(1)).min(1).max(12),
  }),
  GeneratedTableBlockSchema,
  z.object({
    type: z.literal('visual'),
    visualType: z.enum([
      'bar_chart',
      'stacked_bar_chart',
      'line_chart',
      'scatter_plot',
      'histogram',
      'pie_chart',
      'venn_diagram',
      'set_diagram',
      'schematic_map',
    ]),
    title: z.string().trim().optional().nullable(),
    altText: z.string().trim().min(1),
    spec: z.record(z.unknown()),
  }),
])

export type GeneratedContentBlock = z.infer<typeof GeneratedContentBlockSchema>

export const GeneratedOptionSchema = z.object({
  answerText: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]),
  answerExplanation: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]).nullable().optional(),
  isAnswer: z.boolean(),
})

export const GeneratedQuestionSchema = z.object({
  questionText: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]),
  questionType: z.enum(['multiple_choice', 'syllogism']).default('multiple_choice'),
  answerExplanation: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]).nullable().optional(),
  difficultyTarget: DifficultyTargetSchema.optional(),
  timeBurdenTarget: TimeBurdenTargetSchema.optional(),
  estimatedDifficulty: z.number().min(0).max(1).nullable().optional(),
  estimatedTimeBurdenSeconds: z.number().int().positive().nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  options: z.array(GeneratedOptionSchema).min(1),
})

export const GeneratedStemSchema = z.object({
  stemText: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]),
  categoryId: z.string().uuid().nullable().optional(),
  categoryName: z.string().trim().nullable().optional(),
  difficultyTarget: DifficultyTargetSchema.optional(),
  timeBurdenTarget: TimeBurdenTargetSchema.optional(),
  warnings: z.array(z.string()).default([]),
  questions: z.array(GeneratedQuestionSchema).min(1),
})

export const GeneratedCandidateResponseSchema = z.object({
  stems: z.array(GeneratedStemSchema).min(1),
})

export const GenerationPlanSchema = z.object({
  plans: z.array(
    z.object({
      stemIndex: z.number().int().nonnegative(),
      scenarioDomain: z.string().trim().min(1),
      questionArchetype: z.string().trim().min(1),
      distractorPlan: z.string().trim().min(1),
      difficultyTarget: DifficultyTargetSchema,
      timeBurdenTarget: TimeBurdenTargetSchema,
      notes: z.string().trim().optional(),
      vennVisualFormat: z.string().trim().optional(),
    })
  ),
})

export const CriticIssueSchema = z.object({
  severity: z.enum(['blocking', 'warning']),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  stemIndex: z.number().int().nonnegative().nullable().optional(),
  questionIndex: z.number().int().nonnegative().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
})

export const CriticResponseSchema = z.object({
  issues: z.array(CriticIssueSchema).default([]),
  scores: z
    .object({
      ucatLikeness: z.number().min(0).max(1).nullable().optional(),
      answerConfidence: z.number().min(0).max(1).nullable().optional(),
      explanationQuality: z.number().min(0).max(1).nullable().optional(),
    })
    .default({}),
})

export type GeneratedStem = z.infer<typeof GeneratedStemSchema>
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>
export type GeneratedOption = z.infer<typeof GeneratedOptionSchema>
export type GenerationPlan = z.infer<typeof GenerationPlanSchema>
export type CriticIssue = z.infer<typeof CriticIssueSchema>
