import { z } from 'zod'

export const DifficultyTargetSchema = z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed')
export const TimeBurdenTargetSchema = z.enum(['low', 'medium', 'high', 'mixed']).default('mixed')

export type DifficultyTarget = z.infer<typeof DifficultyTargetSchema>
export type TimeBurdenTarget = z.infer<typeof TimeBurdenTargetSchema>

const GeneratedTableColumnSchema = z.string().trim()

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
  columns: z.array(GeneratedTableColumnSchema).min(1).max(10),
  rows: z.array(z.array(z.string().trim().min(1)).min(1).max(10)).min(1).max(20),
}).superRefine((table, ctx) => {
  table.columns.forEach((column, index) => {
    if (column || index === 0) return
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only the first table column header may be blank.',
      path: ['columns', index],
    })
  })
}))

const VegaLiteSpecSchema = z.record(z.unknown()).superRefine((spec, ctx) => {
  if (!hasInlineVegaData(spec)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vega-Lite chart specs must include inline data values or datasets.',
    })
  }
  if (hasExternalReference(spec)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Vega-Lite chart specs must not reference external urls.',
    })
  }
})

const SetShapeTypeSchema = z.preprocess(
  (value) => {
    if (value === 'rectangle' || value === 'rounded_rectangle') return 'rect'
    if (value === 'oval') return 'ellipse'
    if (value === 'plus' || value === 'cruciform') return 'cross'
    return value
  },
  z.enum(['circle', 'ellipse', 'rect', 'triangle', 'diamond', 'pentagon', 'hexagon', 'cross', 'polygon'])
)

const SetPointSchema = z.union([
  z.tuple([z.coerce.number(), z.coerce.number()]),
  z.object({ x: z.coerce.number(), y: z.coerce.number() }),
])

const ShapeSpecSchema = z.object({
  id: z.string().trim().min(1).max(24).optional(),
  shape: SetShapeTypeSchema.optional(),
  type: SetShapeTypeSchema.optional(),
  label: z.string().trim().min(1).max(80).optional(),
  cx: z.coerce.number().optional(),
  cy: z.coerce.number().optional(),
  r: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  rx: z.coerce.number().optional(),
  ry: z.coerce.number().optional(),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  points: z.array(SetPointSchema).min(3).max(24).optional(),
  rotation: z.coerce.number().min(-360).max(360).optional(),
  labelX: z.coerce.number().optional(),
  labelY: z.coerce.number().optional(),
  fill: z.string().trim().optional(),
  stroke: z.string().trim().optional(),
}).passthrough()

const SetRegionLabelSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const label = value as Record<string, unknown>
  const region = label.region
  if (!region || typeof region !== 'object' || Array.isArray(region)) return value
  const membership = region as Record<string, unknown>
  return {
    ...label,
    include: label.include ?? membership.include,
    exclude: label.exclude ?? membership.exclude,
    region: typeof membership.expression === 'string' ? membership.expression : undefined,
  }
}, z.object({
  text: z.union([z.string().trim().min(1), z.coerce.number()]).optional(),
  value: z.union([z.string().trim().min(1), z.coerce.number()]).optional(),
  region: z.string().trim().min(1).max(120).optional(),
  include: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  exclude: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  bold: z.boolean().optional(),
  fontSize: z.coerce.number().min(8).max(32).optional(),
}).passthrough())

const SetDiagramSpecSchema = z.object({
  shapes: z.array(ShapeSpecSchema).min(2).max(8),
  regionLabels: z.array(SetRegionLabelSchema).max(24).optional(),
  labels: z.array(SetRegionLabelSchema).max(24).optional(),
  regions: z.array(SetRegionLabelSchema).max(24).optional(),
}).passthrough()

const GeneratedVisualBlockSchema = z.discriminatedUnion('visualType', [
  z.object({ type: z.literal('visual'), visualType: z.literal('vega_lite_chart'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: VegaLiteSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('venn_diagram'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: SetDiagramSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('set_diagram'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: SetDiagramSpecSchema }),
])

function hasInlineVegaData(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasInlineVegaData)
  const record = value as Record<string, unknown>
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const data = record.data as Record<string, unknown>
    if (Array.isArray(data.values) && data.values.length > 0) return true
  }
  if (record.datasets && typeof record.datasets === 'object' && !Array.isArray(record.datasets)) {
    if (Object.values(record.datasets).some((dataset) => Array.isArray(dataset) && dataset.length > 0)) return true
  }
  return Object.values(record).some(hasInlineVegaData)
}

function hasExternalReference(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasExternalReference)
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (['url', 'href', 'src'].includes(key.toLowerCase()) && typeof child === 'string' && child.trim()) return true
    return hasExternalReference(child)
  })
}

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
  GeneratedVisualBlockSchema,
  z.object({
    type: z.literal('image'),
    src: z.string().trim().min(1),
    altText: z.string().trim().optional().nullable(),
    fileId: z.string().uuid().optional().nullable(),
  }),
])

export type GeneratedContentBlock = z.infer<typeof GeneratedContentBlockSchema>

export const GeneratedOptionSchema = z.object({
  answerText: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]),
  answerExplanation: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]).nullable().optional(),
  isAnswer: z.boolean(),
})

const GeneratedQuestionBaseSchema = z.object({
  questionText: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]),
  questionType: z.enum(['multiple_choice', 'syllogism']).default('multiple_choice'),
  answerExplanation: z.union([z.string().trim().min(1), z.array(GeneratedContentBlockSchema).min(1)]).nullable().optional(),
  difficultyTarget: DifficultyTargetSchema.optional(),
  timeBurdenTarget: TimeBurdenTargetSchema.optional(),
  estimatedDifficulty: z.number().min(0).max(1).nullable().optional(),
  estimatedTimeBurdenSeconds: z.number().int().positive().nullable().optional(),
  tagIds: z.preprocess(
    (value) => Array.isArray(value)
      ? value.filter((item) => typeof item === 'string' && z.string().uuid().safeParse(item).success)
      : [],
    z.array(z.string().uuid())
  ).default([]),
  options: z.array(GeneratedOptionSchema).min(1),
})

export const GeneratedQuestionSchema = GeneratedQuestionBaseSchema.transform(
  (question): z.infer<typeof GeneratedQuestionBaseSchema> => question.questionType === 'syllogism'
  ? {
      ...question,
      answerExplanation: null,
    }
  : {
      ...question,
      options: question.options.map((option) => ({
        ...option,
        answerExplanation: null,
      })),
    },
)

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
      categoryName: z.string().trim().nullable().optional(),
      scenarioDomain: z.string().trim().min(1),
      questionArchetype: z.string().trim().min(1),
      distractorPlan: z.string().trim().min(1),
      difficultyTarget: DifficultyTargetSchema,
      timeBurdenTarget: TimeBurdenTargetSchema,
      notes: z.string().trim().optional(),
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
