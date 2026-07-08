import type { GeneratedStem } from '@/features/ucat/questions/lib/ai-generation/schema'
import {
  generatedContentToPlainText,
  getGeneratedVisualSpecIssue,
} from '@/features/ucat/questions/lib/ai-generation/content-blocks'

export type GenerationGateSeverity = 'blocking' | 'warning'

export type GenerationGateIssue = {
  severity: GenerationGateSeverity
  code: string
  message: string
  stemIndex: number
  questionIndex?: number
}

export type GenerationContext = {
  sectionName: string
  categoryName: string | null
  sourcePlainTexts?: string[]
}

const DM_CATEGORIES = new Set([
  'logical puzzles',
  'probabilistic and statistical reasoning',
  'recognising assumptions',
  'syllogisms',
  'venn diagrams',
])

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, ' ')
}

function optionNorm(value: string): string {
  return norm(value).replace(/[^a-z]/gu, '')
}

function stemText(stem: GeneratedStem): string {
  return generatedContentToPlainText(stem.stemText)
}

function questionText(stem: GeneratedStem, index: number): string {
  return generatedContentToPlainText(stem.questions[index]?.questionText ?? '')
}

function optionText(option: GeneratedStem['questions'][number]['options'][number]): string {
  return generatedContentToPlainText(option.answerText)
}

function explanationText(value: GeneratedStem['questions'][number]['answerExplanation']): string {
  if (!value) return ''
  return generatedContentToPlainText(value)
}

function generatedBlocks(stem: GeneratedStem) {
  const values: unknown[] = [
    stem.stemText,
    ...stem.questions.flatMap((question) => [
      question.questionText,
      question.answerExplanation,
      ...question.options.flatMap((option) => [option.answerText, option.answerExplanation]),
    ]),
  ]
  return values.flatMap((value) => Array.isArray(value) ? value : [])
}

function isShapeBasedSetVisual(block: ReturnType<typeof generatedBlocks>[number]): boolean {
  if (block.type !== 'visual') return false
  if (!['venn_diagram', 'set_diagram'].includes(block.visualType)) return false
  return Array.isArray(block.spec.shapes) && block.spec.shapes.length >= 2
}

function numberValue(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function shapePoints(shape: Record<string, unknown>): Array<{ x: number; y: number }> {
  const type = String(shape.shape ?? shape.type ?? 'ellipse')
  if (type === 'triangle') {
    const x = numberValue(shape.x) ?? 160
    const y = numberValue(shape.y) ?? 80
    const width = numberValue(shape.width) ?? 210
    const height = numberValue(shape.height) ?? 220
    return [
      { x: x + width / 2, y },
      { x, y: y + height },
      { x: x + width, y: y + height },
    ]
  }
  if (type === 'diamond') {
    const cx = numberValue(shape.cx) ?? 260
    const cy = numberValue(shape.cy) ?? 190
    const width = numberValue(shape.width) ?? 170
    const height = numberValue(shape.height) ?? 170
    return [
      { x: cx, y: cy - height / 2 },
      { x: cx + width / 2, y: cy },
      { x: cx, y: cy + height / 2 },
      { x: cx - width / 2, y: cy },
    ]
  }
  if (type === 'pentagon' || type === 'hexagon') {
    const cx = numberValue(shape.cx) ?? 250
    const cy = numberValue(shape.cy) ?? 190
    const radius = numberValue(shape.r) ?? numberValue(shape.radius) ?? 95
    const sides = type === 'pentagon' ? 5 : 6
    const rotation = type === 'pentagon' ? -Math.PI / 2 : Math.PI / 6
    return Array.from({ length: sides }, (_, index) => {
      const angle = rotation + (index / sides) * Math.PI * 2
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    })
  }
  return []
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function isLabelNearShapeBoundary(label: { x: number; y: number }, shape: Record<string, unknown>): boolean {
  const type = String(shape.shape ?? shape.type ?? 'ellipse')
  const tolerancePx = 14
  if (type === 'circle') {
    const cx = numberValue(shape.cx) ?? 180
    const cy = numberValue(shape.cy) ?? 190
    const r = numberValue(shape.r) ?? 95
    return Math.abs(Math.hypot(label.x - cx, label.y - cy) - r) <= tolerancePx
  }
  if (type === 'ellipse') {
    const cx = numberValue(shape.cx) ?? 210
    const cy = numberValue(shape.cy) ?? 190
    const rx = numberValue(shape.rx) ?? 120
    const ry = numberValue(shape.ry) ?? 82
    const scaled = Math.sqrt(((label.x - cx) / rx) ** 2 + ((label.y - cy) / ry) ** 2)
    return Math.abs(scaled - 1) * Math.min(rx, ry) <= tolerancePx
  }
  if (type === 'rect') {
    const x = numberValue(shape.x) ?? 120
    const y = numberValue(shape.y) ?? 115
    const width = numberValue(shape.width) ?? 170
    const height = numberValue(shape.height) ?? 160
    const withinBand =
      label.x >= x - tolerancePx &&
      label.x <= x + width + tolerancePx &&
      label.y >= y - tolerancePx &&
      label.y <= y + height + tolerancePx
    if (!withinBand) return false
    return (
      Math.abs(label.x - x) <= tolerancePx ||
      Math.abs(label.x - (x + width)) <= tolerancePx ||
      Math.abs(label.y - y) <= tolerancePx ||
      Math.abs(label.y - (y + height)) <= tolerancePx
    )
  }
  const points = shapePoints(shape)
  return points.some((point, index) =>
    distanceToSegment(label, point, points[(index + 1) % points.length] ?? point) <= tolerancePx
  )
}

function stringSet(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => norm(String(item ?? ''))).filter(Boolean)
}

function parseSetRegionExpression(value: unknown): { include: string[]; exclude: string[] } {
  const include: string[] = []
  const exclude: string[] = []
  const text = String(value ?? '').trim()
  if (!text) return { include, exclude }
  const normalized = text
    .replace(/\bonly\b/giu, '')
    .replace(/[∩&+,]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  if (norm(normalized) === 'outside') return { include, exclude: ['*'] }
  const tokens = normalized.split(/\s+/u)
  let negateNext = false
  for (const rawToken of tokens) {
    const token = rawToken.trim()
    if (!token) continue
    if (/^(?:not|no|without|exclude|¬|!|not_)$/iu.test(token)) {
      negateNext = true
      continue
    }
    const cleaned = norm(token.replace(/^(?:not_|!|¬)/iu, ''))
    if (!cleaned) continue
    if (negateNext || cleaned !== norm(token)) exclude.push(cleaned)
    else include.push(cleaned)
    negateNext = false
  }
  return { include, exclude }
}

function setRegionKey(record: Record<string, unknown>): string | null {
  const include = new Set(stringSet(record.include))
  const exclude = new Set(stringSet(record.exclude))
  const parsed = parseSetRegionExpression(record.region)
  parsed.include.forEach((item) => include.add(item))
  parsed.exclude.forEach((item) => exclude.add(item))
  if (include.size === 0 && exclude.size === 0) return null
  return `in:${Array.from(include).sort().join(',')}|out:${Array.from(exclude).sort().join(',')}`
}

function setVisualRegionLabels(block: ReturnType<typeof generatedBlocks>[number]) {
  if (block.type !== 'visual') return []
  const rawLabels = Array.isArray(block.spec.regionLabels)
    ? block.spec.regionLabels
    : Array.isArray(block.spec.labels)
      ? block.spec.labels
      : Array.isArray(block.spec.regions)
        ? block.spec.regions
        : []
  return (rawLabels as unknown[]).flatMap((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const x = numberValue(record.x)
    const y = numberValue(record.y)
    const text = String(record.text ?? record.value ?? '')
    return [{ text, x: x ?? null, y: y ?? null, regionKey: setRegionKey(record) }]
  })
}

function legendShapeType(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'rectangle') return 'rect'
  if (normalized === 'oval') return 'ellipse'
  return ['circle', 'ellipse', 'rect', 'triangle', 'diamond', 'pentagon', 'hexagon'].includes(normalized)
    ? normalized
    : null
}

function parseRegionLegendText(value: unknown): { shape: string; label: string } | null {
  const text = String(value ?? '').trim()
  const match = text.match(/^(circle|ellipse|oval|rect|rectangle|triangle|diamond|pentagon|hexagon)\s*=\s*(.+)$/iu)
  if (!match?.[1] || !match[2]) return null
  const shape = legendShapeType(match[1])
  const label = match[2].trim()
  return shape && label ? { shape, label } : null
}

function setVisualHasShapeMapping(block: ReturnType<typeof generatedBlocks>[number]): boolean {
  if (block.type !== 'visual' || !Array.isArray(block.spec.shapes)) return false
  const shapes = (block.spec.shapes as unknown[])
    .map((raw) => raw && typeof raw === 'object' ? raw as Record<string, unknown> : null)
    .filter((shape): shape is Record<string, unknown> => Boolean(shape))
  if (shapes.length < 2) return false

  const labelledShapeCount = shapes.filter((shape) => String(shape.label ?? '').trim()).length
  if (labelledShapeCount >= Math.min(shapes.length, 3)) return true

  const regionLabels = Array.isArray(block.spec.regionLabels)
    ? block.spec.regionLabels
    : Array.isArray(block.spec.labels)
      ? block.spec.labels
      : []
  const legendEntries = (regionLabels as unknown[])
    .map((raw) => raw && typeof raw === 'object' ? raw as Record<string, unknown> : {})
    .map((record) => parseRegionLegendText(record.text ?? record.value))
    .filter((entry): entry is { shape: string; label: string } => Boolean(entry))
  const distinctLegendShapes = new Set(legendEntries.map((entry) => entry.shape))
  return distinctLegendShapes.size >= Math.min(shapes.length, 3)
}

function paragraphCount(text: string): number {
  const blocks = text
    .split(/\n{2,}|\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  return blocks.length
}

function add(
  issues: GenerationGateIssue[],
  severity: GenerationGateSeverity,
  code: string,
  message: string,
  stemIndex: number,
  questionIndex?: number
) {
  issues.push({ severity, code, message, stemIndex, questionIndex })
}

function validateCommon(stem: GeneratedStem, stemIndex: number, issues: GenerationGateIssue[]) {
  const candidateText = [
    stemText(stem),
    ...stem.questions.flatMap((question) => [
      generatedContentToPlainText(question.questionText),
      explanationText(question.answerExplanation),
      ...question.options.flatMap((option) => [optionText(option), explanationText(option.answerExplanation)]),
    ]),
  ].join(' ')
  if (/\s(?:--|—)\s/u.test(candidateText)) {
    add(issues, 'warning', 'generic_ai_dash_style', 'Candidate uses generic AI-style dash punctuation.', stemIndex)
  }

  generatedBlocks(stem).forEach((block) => {
    if (block.type !== 'visual') return
    const issue = getGeneratedVisualSpecIssue(block)
    if (issue) {
      add(issues, 'blocking', 'generated_visual_spec_invalid', issue, stemIndex)
    }
  })

  for (let questionIndex = 0; questionIndex < stem.questions.length; questionIndex += 1) {
    const question = stem.questions[questionIndex]
    if (!question) continue

    if (question.questionType === 'multiple_choice') {
      const correctCount = question.options.filter((option) => option.isAnswer).length
      if (correctCount !== 1) {
        add(issues, 'blocking', 'multiple_choice_correct_count', 'Multiple-choice questions must have exactly one correct answer.', stemIndex, questionIndex)
      }
      const explanation = explanationText(question.answerExplanation)
      if (!explanation.trim()) {
        add(issues, 'blocking', 'missing_question_explanation', 'Multiple-choice questions must include a question-level explanation.', stemIndex, questionIndex)
      } else if (explanation.length < 80) {
        add(issues, 'warning', 'thin_question_explanation', 'Question-level explanation may be too thin to explain the correct answer and distractors.', stemIndex, questionIndex)
      }
    }

    if (question.questionType === 'syllogism') {
      if (question.options.length !== 5) {
        add(issues, 'blocking', 'syllogism_option_count', 'Syllogism questions must have exactly five Yes/No statements.', stemIndex, questionIndex)
      }
      question.options.forEach((option, optionIndex) => {
        const explanation = explanationText(option.answerExplanation)
        if (!explanation.trim()) {
          add(issues, 'blocking', 'missing_syllogism_option_explanation', `Syllogism option ${optionIndex + 1} must explain why the answer is Yes or No.`, stemIndex, questionIndex)
        } else if (explanation.length < 30) {
          add(issues, 'warning', 'thin_syllogism_option_explanation', `Syllogism option ${optionIndex + 1} explanation may be too thin.`, stemIndex, questionIndex)
        }
      })
    }
  }
}

function validateVr(stem: GeneratedStem, stemIndex: number, categoryName: string | null, issues: GenerationGateIssue[]) {
  const category = norm(categoryName)
  if (stem.questions.length !== 4) {
    add(issues, 'blocking', 'vr_question_count', 'Verbal Reasoning stems must have exactly 4 questions.', stemIndex)
  }
  const count = paragraphCount(stemText(stem))
  if (count < 2 || count > 6) {
    add(issues, 'blocking', 'vr_paragraph_count', 'Verbal Reasoning stems must contain 2 to 6 paragraphs.', stemIndex)
  }
  if (category !== 'reading comprehension' && category !== "true, false, can't tell") {
    add(issues, 'blocking', 'vr_category', 'Verbal Reasoning stems must use Reading Comprehension or True, False, Can\'t Tell.', stemIndex)
  }

  for (let questionIndex = 0; questionIndex < stem.questions.length; questionIndex += 1) {
    const question = stem.questions[questionIndex]
    if (!question) continue
    if (question.questionType !== 'multiple_choice') {
      add(issues, 'blocking', 'vr_question_type', 'Verbal Reasoning questions must be stored as multiple_choice.', stemIndex, questionIndex)
    }
    if (category === 'reading comprehension' && question.options.length !== 4) {
      add(issues, 'blocking', 'vr_reading_comprehension_options', 'Reading Comprehension questions must have exactly 4 options.', stemIndex, questionIndex)
    }
    if (category === "true, false, can't tell") {
      const normalized = question.options.map((option) => optionNorm(optionText(option))).sort().join('|')
      if (normalized !== ['canttell', 'false', 'true'].sort().join('|')) {
        add(issues, 'blocking', 'vr_tfct_options', "True, False, Can't Tell questions must have exactly True, False, and Can't Tell options.", stemIndex, questionIndex)
      }
      const text = norm(questionText(stem, questionIndex))
      if (/\b(?:this statement is (?:true|false)|(?:is|answer is) (?:true|false|can't tell)|cannot be determined from the passage)\b/u.test(text)) {
        add(issues, 'blocking', 'vr_tfct_answer_leak', "True, False, Can't Tell question text must not reveal or hint at its answer.", stemIndex, questionIndex)
      }
    }
  }
}

function validateDm(stem: GeneratedStem, stemIndex: number, categoryName: string | null, issues: GenerationGateIssue[]) {
  const category = norm(categoryName)
  if (!DM_CATEGORIES.has(category)) {
    add(issues, 'blocking', 'dm_category', 'Decision Making candidates must select a valid DM category.', stemIndex)
  }
  if (stem.questions.length !== 1) {
    add(issues, 'blocking', 'dm_question_count', 'Decision Making stems must have exactly 1 question.', stemIndex)
  }
  const qText = norm(questionText(stem, 0))
  if (category === 'syllogisms') {
    const expected = norm("Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.")
    if (qText !== expected) {
      add(issues, 'blocking', 'dm_syllogism_question_text', 'Syllogism question text must match the required UCAT instruction.', stemIndex, 0)
    }
    if (stem.questions[0]?.questionType !== 'syllogism') {
      add(issues, 'blocking', 'dm_syllogism_question_type', 'Syllogism category questions must be stored as syllogism.', stemIndex, 0)
    }
  }
  if (category === 'recognising assumptions') {
    const expected = norm('Select the strongest argument from the statements below.')
    if (qText !== expected) {
      add(issues, 'blocking', 'dm_assumption_question_text', 'Recognising Assumptions question text must match the required UCAT instruction.', stemIndex, 0)
    }
  }
  if (category === 'logical puzzles') {
    const explanation = norm(explanationText(stem.questions[0]?.answerExplanation))
    const ambiguityMarkers = [
      'underspecified',
      'both orders are possible',
      'two possibilities',
      'no direct comparison between',
      'we missed',
      're-read',
      'wait,',
      'actually,',
      'let me',
      "let's",
      'i need to',
      're-evaluate',
      'multiple possibilities',
      'another option is also',
    ]
    if (ambiguityMarkers.some((marker) => explanation.includes(marker))) {
      add(
        issues,
        'blocking',
        'dm_logical_puzzle_ambiguous_explanation',
        'Logical Puzzle explanation contains unresolved ambiguity or self-correction.',
        stemIndex,
        0
      )
    }

    const rawStemText = norm(stemText(stem))
    const rawQuestionText = norm(questionText(stem, 0))
    if (rawQuestionText.length >= 24 && rawStemText.includes(rawQuestionText)) {
      add(
        issues,
        'blocking',
        'dm_logical_question_duplicated_in_stem',
        'Logical Puzzle question text must not be repeated inside the stem.',
        stemIndex,
        0
      )
    }

    const unorderedPairKeys = new Set<string>()
    for (const option of stem.questions[0]?.options ?? []) {
      const match = optionText(option).match(/^\s*([^,.;]+?)\s+and\s+([^,.;]+?)\s*\.?\s*$/iu)
      if (!match?.[1] || !match[2]) continue
      const key = [norm(match[1]), norm(match[2])].sort().join('|')
      if (unorderedPairKeys.has(key)) {
        add(
          issues,
          'blocking',
          'dm_logical_duplicate_pair_option',
          'Logical Puzzle contains duplicate answer options with the pair reversed.',
          stemIndex,
          0
        )
        break
      }
      unorderedPairKeys.add(key)
    }
  }
  if (category === 'venn diagrams') {
    const blocks = generatedBlocks(stem)
    const setVisuals = blocks.filter(
      (block) => block.type === 'visual' && ['venn_diagram', 'set_diagram'].includes(block.visualType)
    )
    const hasVenn = blocks.some(
      (block) => block.type === 'visual' && ['venn_diagram', 'set_diagram'].includes(block.visualType)
    )
    if (!hasVenn) {
      add(issues, 'blocking', 'dm_venn_visual_required', 'Venn Diagram questions must include a deterministic Venn visual.', stemIndex, 0)
    }
    if (hasVenn && !blocks.some(isShapeBasedSetVisual)) {
      add(
        issues,
        'blocking',
        'dm_venn_shape_spec_required',
        'Venn Diagram visuals must use the shape-based set_diagram/venn_diagram spec, not the legacy coloured three-circle template.',
        stemIndex,
        0
      )
    }
    if (hasVenn && !setVisuals.some(setVisualHasShapeMapping)) {
      add(
        issues,
        'blocking',
        'dm_venn_shape_mapping_required',
        'Venn Diagram visuals must label the sets using shape labels or a parseable shape legend.',
        stemIndex,
        0
      )
    }
    const regionLabels = setVisuals.flatMap(setVisualRegionLabels)
    const numericRegionLabels = regionLabels.filter((label) => /\d/u.test(label.text))
    if (hasVenn && numericRegionLabels.length < 3) {
      add(
        issues,
        'blocking',
        'dm_venn_numeric_regions_required',
        'Venn Diagram visuals must include numeric region labels inside the diagram, not only set names.',
        stemIndex,
        0
      )
    }
    const oversizedVisual = setVisuals.some((block) => block.type === 'visual' && Array.isArray(block.spec.shapes) && block.spec.shapes.length > 3)
    if (oversizedVisual) {
      add(
        issues,
        'blocking',
        'dm_venn_too_many_sets',
        'Generated Venn Diagram visuals must use two or three sets only; four-set diagrams create ambiguous generated regions.',
        stemIndex,
        0
      )
    }
    const overLabelledVisual = setVisuals.some((block) => {
      if (block.type !== 'visual' || !Array.isArray(block.spec.shapes)) return false
      const shapeCount = block.spec.shapes.length
      const maxLabels = shapeCount === 2 ? 4 : shapeCount === 3 ? 8 : 0
      const labelCount = setVisualRegionLabels(block).filter((label) => /\d/u.test(label.text)).length
      return maxLabels > 0 && labelCount > maxLabels
    })
    if (overLabelledVisual) {
      add(
        issues,
        'blocking',
        'dm_venn_too_many_region_labels',
        'Generated Venn Diagram visuals must not label more regions than the two-set or three-set layout can show clearly.',
        stemIndex,
        0
      )
    }
    const semanticNumericLabels = numericRegionLabels.filter((label) => label.regionKey)
    const duplicateRegionKeys = new Set<string>()
    const seenRegionKeys = new Set<string>()
    for (const label of semanticNumericLabels) {
      const key = label.regionKey
      if (!key) continue
      if (seenRegionKeys.has(key)) duplicateRegionKeys.add(key)
      seenRegionKeys.add(key)
    }
    if (hasVenn && duplicateRegionKeys.size > 0) {
      add(
        issues,
        'blocking',
        'dm_venn_duplicate_region_expression',
        'Venn Diagram numeric labels must not put multiple values in the same set-region expression.',
        stemIndex,
        0
      )
    }
    if (hasVenn && numericRegionLabels.length >= 3 && semanticNumericLabels.length < numericRegionLabels.length) {
      add(
        issues,
        'blocking',
        'dm_venn_region_expression_required',
        'Every Venn Diagram numeric label must include a set-region expression so duplicate or missing logical regions can be detected.',
        stemIndex,
        0
      )
    }
    const hasBoundaryLabel = setVisuals.some((block) => {
      if (block.type !== 'visual' || !Array.isArray(block.spec.shapes)) return false
      const shapes = (block.spec.shapes as unknown[])
        .map((raw) => raw && typeof raw === 'object' ? raw as Record<string, unknown> : null)
        .filter((shape): shape is Record<string, unknown> => !!shape)
      const visualNumericLabels = setVisualRegionLabels(block).filter((label): label is { text: string; x: number; y: number; regionKey: string | null } =>
        /\d/u.test(label.text) && label.x != null && label.y != null
      )
      return visualNumericLabels.some((label) => shapes.some((shape) => isLabelNearShapeBoundary(label, shape)))
    })
    if (hasBoundaryLabel) {
      add(
        issues,
        'warning',
        'dm_venn_region_label_boundary_overlap',
        'Venn Diagram numeric labels may be close to shape boundaries; review placement for visual ambiguity.',
        stemIndex,
        0
      )
    }
  }
}

function validateQr(
  stem: GeneratedStem,
  stemIndex: number,
  categoryName: string | null,
  issues: GenerationGateIssue[],
  targetedCategory: boolean
) {
  if (stem.questions.length < 1 || stem.questions.length > 4) {
    add(issues, 'blocking', 'qr_question_count', 'Quantitative Reasoning stems must have 1 to 4 questions.', stemIndex)
  }
  stem.questions.forEach((question, questionIndex) => {
    if (question.questionType !== 'multiple_choice') {
      add(issues, 'blocking', 'qr_question_type', 'Quantitative Reasoning questions must be stored as multiple_choice.', stemIndex, questionIndex)
    }
    if (question.options.length !== 5) {
      add(issues, 'blocking', 'qr_option_count', 'Quantitative Reasoning questions must have exactly 5 answer options.', stemIndex, questionIndex)
    }
  })

  const category = norm(categoryName)
  const blocks = generatedBlocks(stem)
  const tables = blocks.filter((block) => block.type === 'table').length
  const visuals = blocks.filter((block) => block.type === 'visual')
  const hasChart = visuals.some((block) =>
    block.type === 'visual' &&
    block.visualType === 'vega_lite_chart'
  )
  const categoryMismatchSeverity = targetedCategory ? 'blocking' : 'warning'
  if (category === 'data tables' && tables === 0) {
    add(issues, categoryMismatchSeverity, 'qr_table_required', `${categoryName} questions should include a table block.`, stemIndex)
  }
  if (category === 'timetables and calendars' && tables === 0 && !hasChart) {
    add(issues, categoryMismatchSeverity, 'qr_timetable_required', 'Timetables and Calendars questions should include a table block or vega_lite_chart visual.', stemIndex)
  }
  if (category === 'graphs and charts' && !hasChart) {
    add(issues, categoryMismatchSeverity, 'qr_chart_required', 'Graphs and Charts questions should include a vega_lite_chart visual.', stemIndex)
  }
  if (category === 'graphs and charts') {
    const chartVisuals = visuals.filter((block) =>
      block.type === 'visual' &&
      block.visualType === 'vega_lite_chart'
    )
    const thinChart = chartVisuals.some((block) => countVegaLiteDataRows(block.spec) < 4)
    if (thinChart) {
      add(
        issues,
        'warning',
        'qr_chart_low_information_density',
        'Chart visual may be too sparse for realistic QR interpretation.',
        stemIndex
      )
    }
    const lacksAxisContext = chartVisuals.some((block) => !vegaLiteHasAxisOrLegendContext(block.spec))
    if (lacksAxisContext) {
      add(
        issues,
        'warning',
        'qr_chart_axis_context_missing',
        'Chart visual should include axis labels or units so students can interpret the data source without guesswork.',
        stemIndex
      )
    }
  }
  if (category === 'maps and diagrams' && !hasChart) {
    add(issues, categoryMismatchSeverity, 'qr_map_required', 'Maps and Diagrams questions should include a vega_lite_chart visual containing the map or diagram data.', stemIndex)
  }
  if (category === 'mixed data sources' && (tables === 0 || visuals.length === 0)) {
    add(issues, categoryMismatchSeverity, 'qr_mixed_sources_required', 'Mixed Data Sources questions should include a table and a visual source.', stemIndex)
  }
  if (category === 'text-only scenarios' && (tables > 0 || visuals.length > 0)) {
    add(issues, categoryMismatchSeverity, 'qr_text_only_assets', 'Text-Only Scenarios should not include table or visual blocks.', stemIndex)
  }
}

function countVegaLiteDataRows(value: unknown): number {
  if (Array.isArray(value)) return Math.max(0, ...value.map(countVegaLiteDataRows))
  if (!value || typeof value !== 'object') return 0
  const record = value as Record<string, unknown>
  const values = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? (record.data as Record<string, unknown>).values
    : null
  const datasets = record.datasets && typeof record.datasets === 'object' && !Array.isArray(record.datasets)
    ? Object.values(record.datasets as Record<string, unknown>)
    : []
  const ownCount = Array.isArray(values) ? values.length : 0
  const datasetCount = datasets.reduce<number>((max, dataset) => Math.max(max, Array.isArray(dataset) ? dataset.length : 0), 0)
  const childCount = Math.max(0, ...Object.values(record).map(countVegaLiteDataRows))
  return Math.max(ownCount, datasetCount, childCount)
}

function vegaLiteHasAxisOrLegendContext(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(vegaLiteHasAxisOrLegendContext)
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const encoding = record.encoding && typeof record.encoding === 'object' && !Array.isArray(record.encoding)
    ? record.encoding as Record<string, unknown>
    : {}
  const hasContext = Object.values(encoding).some((channel) => {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) return false
    const channelRecord = channel as Record<string, unknown>
    const axis = channelRecord.axis && typeof channelRecord.axis === 'object' && !Array.isArray(channelRecord.axis)
      ? channelRecord.axis as Record<string, unknown>
      : {}
    const legend = channelRecord.legend && typeof channelRecord.legend === 'object' && !Array.isArray(channelRecord.legend)
      ? channelRecord.legend as Record<string, unknown>
      : {}
    return Boolean(
      String(channelRecord.title ?? '').trim() ||
      String(axis.title ?? '').trim() ||
      String(legend.title ?? '').trim()
    )
  })
  return hasContext || Object.values(record).some(vegaLiteHasAxisOrLegendContext)
}

function validateSj(stem: GeneratedStem, stemIndex: number, categoryName: string | null, issues: GenerationGateIssue[]) {
  const category = norm(categoryName)
  if (stem.questions.length !== 4) {
    add(issues, 'blocking', 'sj_question_count', 'Situational Judgement stems must have exactly 4 questions.', stemIndex)
  }
  const expected =
    category === 'how important'
      ? ['Very important', 'Important', 'Of minor importance', 'Not important at all']
      : category === 'how appropriate'
        ? ['A very appropriate thing to do', 'Appropriate, but not ideal', 'Inappropriate, but not awful', 'A very inappropriate thing to do']
        : null
  if (!expected) {
    add(issues, 'blocking', 'sj_category', 'Situational Judgement category must be How Important or How Appropriate.', stemIndex)
  }

  stem.questions.forEach((question, questionIndex) => {
    if (question.questionType !== 'multiple_choice') {
      add(issues, 'blocking', 'sj_question_type', 'Situational Judgement questions must be stored as multiple_choice.', stemIndex, questionIndex)
    }
    if (question.options.length !== 4) {
      add(issues, 'blocking', 'sj_option_count', 'Situational Judgement questions must have exactly 4 options.', stemIndex, questionIndex)
    }
    if (expected) {
      const actual = question.options.map((option) => norm(optionText(option)))
      const expectedNorm = expected.map(norm)
      if (actual.join('|') !== expectedNorm.join('|')) {
        add(issues, 'blocking', 'sj_option_text', 'Situational Judgement answer options must match the selected category exactly and in order.', stemIndex, questionIndex)
      }
    }
  })
}

function validateSimilarity(stem: GeneratedStem, stemIndex: number, sourcePlainTexts: string[], issues: GenerationGateIssue[]) {
  if (sourcePlainTexts.length === 0) return
  const candidate = norm(
    [
      stemText(stem),
      ...stem.questions.flatMap((question) => [
        generatedContentToPlainText(question.questionText),
        ...question.options.map(optionText),
      ]),
    ].join(' ')
  )
  if (candidate.length < 120) return
  for (const source of sourcePlainTexts) {
    const sourceText = norm(source)
    if (sourceText.length < 120) continue
    const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 4))
    const sourceTokens = sourceText.split(' ').filter((token) => token.length > 4)
    const overlap = sourceTokens.filter((token) => candidateTokens.has(token)).length
    const ratio = overlap / Math.max(1, Math.min(candidateTokens.size, sourceTokens.length))
    if (ratio >= 0.72) {
      add(issues, 'blocking', 'source_similarity', 'Candidate is too textually similar to a selected source example.', stemIndex)
      return
    }
  }
}

export function validateGeneratedStemCandidate(
  stem: GeneratedStem,
  stemIndex: number,
  context: GenerationContext
): GenerationGateIssue[] {
  const issues: GenerationGateIssue[] = []
  validateCommon(stem, stemIndex, issues)
  const section = norm(context.sectionName)
  const category = stem.categoryName ?? context.categoryName

  if (section === 'verbal reasoning') validateVr(stem, stemIndex, category, issues)
  else if (section === 'decision making') validateDm(stem, stemIndex, category, issues)
  else if (section === 'quantitative reasoning') validateQr(stem, stemIndex, category, issues, !!context.categoryName)
  else if (section === 'situational judgement') validateSj(stem, stemIndex, category, issues)
  else add(issues, 'warning', 'unknown_section', 'Section-specific generation gates were not applied.', stemIndex)

  validateSimilarity(stem, stemIndex, context.sourcePlainTexts ?? [], issues)
  return issues
}

export function hasBlockingIssues(issues: GenerationGateIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'blocking')
}
