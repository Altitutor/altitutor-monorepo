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

const ChartSeriesSchema = z.object({
  name: z.string().trim().min(1),
  values: z.array(z.coerce.number()).min(1).max(20),
  points: z.array(z.object({
    x: z.coerce.number(),
    y: z.coerce.number(),
    label: z.string().trim().optional(),
  })).max(30).optional(),
})

const ChartAxisSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  unit: z.string().trim().min(1).max(24).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  tickCount: z.coerce.number().int().min(2).max(12).optional(),
}).passthrough()

const ChartStyleSchema = z.object({
  palette: z.enum(['default', 'teal_amber', 'indigo_rose', 'slate_green', 'monochrome']).optional(),
  showGrid: z.boolean().optional(),
  showValueLabels: z.boolean().optional(),
  patterned: z.boolean().optional(),
}).passthrough()

const CartesianChartPanelSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: z.string().trim().min(1).max(80).optional(),
  labels: z.array(z.string().trim().min(1)).min(1).max(16),
  values: z.array(z.coerce.number()).min(1).max(16).optional(),
  series: z.array(z.object({
    name: z.string().trim().min(1),
    values: z.array(z.coerce.number()).min(1).max(16),
  })).min(1).max(5).optional(),
}).passthrough()

const CartesianChartSpecSchema = z.object({
  labels: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  values: z.array(z.coerce.number()).min(1).max(20).optional(),
  series: z.array(ChartSeriesSchema).min(1).max(6).optional(),
  panels: z.array(CartesianChartPanelSchema).min(1).max(3).optional(),
  xAxis: ChartAxisSchema.optional(),
  yAxis: ChartAxisSchema.optional(),
  style: ChartStyleSchema.optional(),
}).passthrough()

const PieChartPanelSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: z.string().trim().min(1).max(80).optional(),
  labels: z.array(z.string().trim().min(1)).min(1).max(10),
  values: z.array(z.coerce.number()).min(1).max(10),
})

const PieChartSpecSchema = z.object({
  labels: z.array(z.string().trim().min(1)).min(1).max(10).optional(),
  values: z.array(z.coerce.number()).min(1).max(10).optional(),
  panels: z.array(PieChartPanelSchema).min(1).max(3).optional(),
  style: ChartStyleSchema.optional(),
}).passthrough()

const ShapeSpecSchema = z.object({
  id: z.string().trim().min(1).max(24).optional(),
  shape: z.enum(['circle', 'ellipse', 'rect', 'triangle', 'diamond', 'pentagon', 'hexagon']).optional(),
  type: z.enum(['circle', 'ellipse', 'rect', 'triangle', 'diamond', 'pentagon', 'hexagon']).optional(),
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
  labelX: z.coerce.number().optional(),
  labelY: z.coerce.number().optional(),
  fill: z.string().trim().optional(),
  stroke: z.string().trim().optional(),
}).passthrough()

const SetRegionLabelSchema = z.object({
  text: z.union([z.string().trim().min(1), z.coerce.number()]).optional(),
  value: z.union([z.string().trim().min(1), z.coerce.number()]).optional(),
  region: z.string().trim().min(1).max(120).optional(),
  include: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  exclude: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  bold: z.boolean().optional(),
  fontSize: z.coerce.number().min(8).max(32).optional(),
}).passthrough()

const SetDiagramSpecSchema = z.object({
  shapes: z.array(ShapeSpecSchema).min(2).max(8),
  regionLabels: z.array(SetRegionLabelSchema).min(1).max(24).optional(),
  labels: z.array(SetRegionLabelSchema).max(24).optional(),
  regions: z.array(SetRegionLabelSchema).max(24).optional(),
}).passthrough()

const LegacyVennSpecSchema = z.object({
  sets: z.array(z.object({
    id: z.string().trim().optional(),
    label: z.string().trim().optional(),
  }).passthrough()).min(1).max(4).optional(),
  regions: z.record(z.unknown()).optional(),
  leftLabel: z.string().trim().optional(),
  rightLabel: z.string().trim().optional(),
  intersectionLabel: z.string().trim().optional(),
}).passthrough()

const MapSpecSchema = z.object({
  points: z.array(z.object({
    id: z.string().trim().min(1).max(24),
    label: z.string().trim().min(1).max(80),
    x: z.coerce.number(),
    y: z.coerce.number(),
  }).passthrough()).min(1).max(20),
  lines: z.array(z.object({
    from: z.string().trim().min(1).max(24),
    to: z.string().trim().min(1).max(24),
    label: z.string().trim().max(40).optional(),
  }).passthrough()).max(30),
}).passthrough()

const LayoutGridSpecSchema = z.object({
  title: z.string().trim().max(120).optional(),
  rows: z.coerce.number().int().min(1).max(8),
  columns: z.coerce.number().int().min(1).max(8),
  rowLabels: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  columnLabels: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  cells: z.array(z.object({
    row: z.coerce.number().int().min(1).max(8),
    column: z.coerce.number().int().min(1).max(8),
    label: z.string().trim().min(1).max(80).optional(),
    fill: z.string().trim().optional(),
  }).passthrough()).max(64).optional(),
}).passthrough()

const TimetableSpecSchema = z.object({
  caption: z.string().trim().max(120).optional(),
  columns: z.array(z.string().trim().min(1)).min(2).max(10),
  rows: z.array(z.array(z.string().trim().min(1)).min(1).max(10)).min(2).max(20),
  rowHeaderCount: z.coerce.number().int().min(0).max(3).optional(),
  columnGroupLabels: z.array(z.string().trim().min(1)).max(10).optional(),
}).passthrough()

const GeneratedVisualBlockSchema = z.discriminatedUnion('visualType', [
  z.object({ type: z.literal('visual'), visualType: z.literal('bar_chart'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: CartesianChartSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('stacked_bar_chart'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: CartesianChartSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('line_chart'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: CartesianChartSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('scatter_plot'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: CartesianChartSpecSchema.extend({ points: z.array(z.object({ x: z.coerce.number(), y: z.coerce.number(), label: z.string().trim().optional() })).min(1).max(40).optional() }).passthrough() }),
  z.object({ type: z.literal('visual'), visualType: z.literal('histogram'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: CartesianChartSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('pie_chart'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: PieChartSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('venn_diagram'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: z.union([SetDiagramSpecSchema, LegacyVennSpecSchema]) }),
  z.object({ type: z.literal('visual'), visualType: z.literal('set_diagram'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: SetDiagramSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('schematic_map'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: MapSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('route_map'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: MapSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('layout_grid'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: LayoutGridSpecSchema }),
  z.object({ type: z.literal('visual'), visualType: z.literal('timetable'), title: z.string().trim().optional().nullable(), altText: z.string().trim().min(1), spec: TimetableSpecSchema }),
])

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
