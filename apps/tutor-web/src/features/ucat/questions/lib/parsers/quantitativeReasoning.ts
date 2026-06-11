import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirrorWithTables,
  tokenizedPlainTextToProseMirrorWithLineBreaksAndTables,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  collectBlocksFromDocForQuantitativeReasoning,
  mergeConsecutiveStemsWithSameText,
  parseFromLines,
  type ParsedStem,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

export type { ParsedStem, ParsedOption, ParsedQuestion } from '@/features/ucat/questions/lib/parsers/core'

export type QuantitativeReasoningParserConfig = ParserConfig

const QR_DEFAULT_CONFIG: Partial<ParserConfig> = {
  questionLookaheadLimit: 160,
}

export type QuantitativeReasoningToFormOptions = {
  sectionId: string
  categoryId?: string | null
  isPrivate?: boolean
  getCategoryIdForStem?: (stem: ParsedStem) => string | null
  getTagIdsForQuestion?: (args: {
    stem: ParsedStem
    question: ParsedStem['questions'][number]
  }) => string[]
}

export function parseQuantitativeReasoningFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  return mergeConsecutiveStemsWithSameText(
    parseFromLines(rawLines, { ...QR_DEFAULT_CONFIG, ...configOverrides })
  )
}

export function parseQuantitativeReasoningPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseQuantitativeReasoningFromLines(rawLines, configOverrides)
}

export type ParseQuantitativeReasoningResult = {
  stems: ParsedStem[]
  tableMap: Map<string, Json>
}

export function parseQuantitativeReasoningFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParseQuantitativeReasoningResult {
  const { logicalLines, tableMap } = collectBlocksFromDocForQuantitativeReasoning(doc)
  const stems = parseQuantitativeReasoningFromLines(logicalLines, configOverrides)
  return { stems, tableMap }
}

/**
 * Map parsed Quantitative Reasoning stems into UcatQuestionStemFormValues.
 * Preserves tables and images in stem text, question text, and answer options.
 * All questions are multiple_choice.
 */
export function mapParsedQuantitativeReasoningToFormValues(
  result: ParseQuantitativeReasoningResult,
  options: QuantitativeReasoningToFormOptions
): UcatQuestionStemFormValues[] {
  const { stems, tableMap } = result
  const {
    sectionId,
    categoryId = null,
    isPrivate = false,
    getCategoryIdForStem,
    getTagIdsForQuestion,
  } = options

  const formValues: UcatQuestionStemFormValues[] = []

  for (const stem of stems) {
    if (stem.stemText.trim().length === 0 || stem.questions.length === 0) continue

    const questions = stem.questions
      .filter((q) => q.text.trim().length > 0 && q.options.length > 0)
      .map((q) => ({
        questionText: tokenizedPlainTextToProseMirrorWithLineBreaksAndTables(
          q.text,
          tableMap
        ) as Json,
        questionType: 'multiple_choice' as const,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: getTagIdsForQuestion?.({ stem, question: q }) ?? [],
        options: q.options.map((opt) => ({
          answerText: tokenizedPlainTextToProseMirrorWithTables(opt.text, tableMap) as Json,
          answerExplanation: null,
          isAnswer: false,
        })),
      }))

    if (questions.length === 0) continue

    formValues.push({
      sectionId,
      categoryId: getCategoryIdForStem?.(stem) ?? categoryId ?? null,
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaksAndTables(
        stem.stemText,
        tableMap
      ) as Json,
      isPrivate,
      questions,
    })
  }

  return formValues
}

function normalizedText(value: string): string {
  return value
    .replace(/\[\[(?:TABLE|IMG):[^\]]+\]\]/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function hasAny(text: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) =>
    typeof pattern === 'string' ? text.includes(pattern.toLowerCase()) : pattern.test(text)
  )
}

export function getQuantitativeReasoningStemCategoryName(stem: ParsedStem): string | null {
  const raw = stem.stemText
  const text = normalizedText(raw)

  if (hasAny(text, [/currency exchange/, /exchange rate/, /foreign currenc/])) {
    return 'Currency Exchange Tables'
  }
  if (hasAny(text, [/financial statement/, /balance sheet/, /income statement/])) {
    return 'Financial Statements'
  }
  if (hasAny(text, [/invoice/, /receipt/])) return 'Invoices'
  if (hasAny(text, [/price list/, /price table/, /fare table/, /tariff/])) return 'Price Lists'
  if (hasAny(text, [/population data/, /population table/, /census/])) {
    return 'Population Data Tables'
  }
  if (hasAny(text, [/frequency table/])) return 'Frequency Tables'
  if (hasAny(text, [/timetable/])) return 'Timetables'
  if (hasAny(text, [/calendar/])) return 'Calendars'
  if (hasAny(text, [/bar chart/, /bar graph/, /grouped bar/, /stacked bar/])) return 'Bar Charts'
  if (hasAny(text, [/line graph/, /line chart/])) return 'Line Graphs'
  if (hasAny(text, [/pie chart/, /pie graph/])) return 'Pie Charts'
  if (hasAny(text, [/scatter plot/, /scatter diagram/])) return 'Scatter Plots'
  if (hasAny(text, [/histogram/])) return 'Histograms'
  if (hasAny(text, [/map\b/, /maps\b/])) return 'Maps'
  if (hasAny(text, [/diagram/, /schematic/])) return 'Diagrams'
  if (hasAny(text, [/infographic/])) return 'Infographics'

  if (raw.includes('[[TABLE:')) return 'Tables'
  return null
}

type TagRule = {
  path: string[]
  patterns: Array<string | RegExp>
}

const QR_TAG_RULES: TagRule[] = [
  { path: ['Arithmetic', 'Order of operations (BEDMAS)'], patterns: [/bedmas/, /order of operations/] },
  { path: ['Arithmetic', 'Mental maths'], patterns: [/mental maths?/] },
  { path: ['Arithmetic', 'Estimation'], patterns: [/estimat/] },
  { path: ['Arithmetic', 'Rounding'], patterns: [/round(?:ed|ing)?/] },
  { path: ['Arithmetic', 'Addition'], patterns: [/\badd(?:ed|ing|ition)?\b/, /\bsum\b/, /\btotal\b/] },
  { path: ['Arithmetic', 'Subtraction'], patterns: [/\bsubtract/, /\bdifference\b/] },
  { path: ['Arithmetic', 'Multiplication'], patterns: [/\bmultiply/, /\bproduct\b/] },
  { path: ['Arithmetic', 'Division'], patterns: [/\bdivide/, /\bquotient\b/] },

  { path: ['Fractions', 'Simplifying fractions'], patterns: [/simplif(?:y|ying|ied) fractions?/] },
  { path: ['Fractions', 'Equivalent fractions'], patterns: [/equivalent fractions?/] },
  { path: ['Fractions', 'Adding fractions'], patterns: [/add(?:ing)? fractions?/] },
  { path: ['Fractions', 'Subtracting fractions'], patterns: [/subtract(?:ing)? fractions?/] },
  { path: ['Fractions', 'Multiplying fractions'], patterns: [/multiply(?:ing)? fractions?/] },
  { path: ['Fractions', 'Dividing fractions'], patterns: [/divid(?:e|ing) fractions?/] },
  { path: ['Fractions', 'Converting fractions to decimals'], patterns: [/fraction(?:s)? to decimals?/] },
  { path: ['Fractions', 'Converting fractions to percentages'], patterns: [/fraction(?:s)? to percentages?/] },
  { path: ['Fractions'], patterns: [/fraction/] },

  { path: ['Decimals', 'Decimal place conversions'], patterns: [/decimal place/, /place value/] },
  { path: ['Decimals', 'Rounding'], patterns: [/round(?:ed|ing)? decimals?/] },
  { path: ['Decimals', 'Addition/subtraction'], patterns: [/add(?:ing)? decimals?/, /subtract(?:ing)? decimals?/] },
  { path: ['Decimals', 'Multiplication'], patterns: [/multiply(?:ing)? decimals?/] },
  { path: ['Decimals', 'Division'], patterns: [/divid(?:e|ing) decimals?/] },
  { path: ['Decimals'], patterns: [/decimal/] },

  { path: ['Percentages', 'Finding a percentage of a quantity'], patterns: [/percentage of/, /percent of/, /% of/] },
  { path: ['Percentages', 'Percentage increase'], patterns: [/percentage increase/, /percent increase/, /increased by \d+(?:\.\d+)?%/] },
  { path: ['Percentages', 'Percentage decrease'], patterns: [/percentage decrease/, /percent decrease/, /decreased by \d+(?:\.\d+)?%/] },
  { path: ['Percentages', 'Reverse percentages'], patterns: [/reverse percentage/, /original (?:price|value|amount)/] },
  { path: ['Percentages', 'Percentage difference'], patterns: [/percentage difference/, /percent difference/] },
  { path: ['Percentages', 'Compound percentage change'], patterns: [/compound percentage/, /compound percent/] },
  { path: ['Percentages', 'Percentage change'], patterns: [/percentage change/, /percent(?:age)? (?:profit|loss)/, /% change/] },
  { path: ['Percentages'], patterns: [/%/, /percentage/, /percent/] },

  { path: ['Ratios', 'Simplifying ratios'], patterns: [/simplif(?:y|ying|ied) ratios?/] },
  { path: ['Ratios', 'Sharing amounts in a ratio'], patterns: [/sharing amounts? in a ratio/, /split .* ratio/] },
  { path: ['Ratios', 'Ratio interpretation'], patterns: [/ratio interpretation/] },
  { path: ['Ratios', 'Comparing ratios'], patterns: [/compar(?:e|ing) ratios?/] },
  { path: ['Ratios'], patterns: [/\bratio\b/] },

  { path: ['Proportion', 'Direct proportion'], patterns: [/direct proportion/] },
  { path: ['Proportion', 'Inverse proportion'], patterns: [/inverse proportion/] },
  { path: ['Proportion', 'Scaling'], patterns: [/\bscal(?:e|ing)\b/] },
  { path: ['Proportion'], patterns: [/\bproportion(?:al)?\b/] },

  { path: ['Speed - Distance - Time'], patterns: [/\bspeed\b/, /\bdistance\b/, /\bkm\/h\b/, /\bm\/s\b/] },

  { path: ['Unit Conversions', 'Length', 'mm'], patterns: [/\bmm\b/, /\bmillimet/] },
  { path: ['Unit Conversions', 'Length', 'cm'], patterns: [/\bcm\b/, /\bcentimet/] },
  { path: ['Unit Conversions', 'Length', 'm'], patterns: [/\bmetres?\b/, /\bmeters?\b/] },
  { path: ['Unit Conversions', 'Length', 'km'], patterns: [/\bkm\b/, /\bkilomet/] },
  { path: ['Unit Conversions', 'Weight', 'mg'], patterns: [/\bmg\b/, /\bmilligram/] },
  { path: ['Unit Conversions', 'Weight', 'g'], patterns: [/\bgrams?\b/, /\bg\b/] },
  { path: ['Unit Conversions', 'Weight', 'kg'], patterns: [/\bkg\b/, /\bkilogram/] },
  { path: ['Unit Conversions', 'Weight', 'Tonnes'], patterns: [/\btonnes?\b/, /\btons?\b/] },
  { path: ['Unit Conversions', 'Volume', 'mL'], patterns: [/\bml\b/, /\bmillilit/] },
  { path: ['Unit Conversions', 'Volume', 'L'], patterns: [/\blitres?\b/, /\bliters?\b/] },
  { path: ['Unit Conversions', 'Time', 'seconds'], patterns: [/\bseconds?\b/, /\bsecs?\b/] },
  { path: ['Unit Conversions', 'Time', 'minutes'], patterns: [/\bminutes?\b/, /\bmins?\b/] },
  { path: ['Unit Conversions', 'Time', 'hours'], patterns: [/\bhours?\b/] },
  { path: ['Unit Conversions', 'Time', 'days'], patterns: [/\bdays?\b/] },
  { path: ['Unit Conversions', 'Currency', 'Exchange rates'], patterns: [/exchange rates?/] },
  { path: ['Unit Conversions', 'Currency', 'Foreign currencies'], patterns: [/foreign currenc/] },
  { path: ['Unit Conversions'], patterns: [/convert/, /conversion/] },

  { path: ['Averages', 'Mean'], patterns: [/\bmean\b/, /\baverage\b/] },
  { path: ['Averages', 'Median'], patterns: [/\bmedian\b/] },
  { path: ['Averages', 'Mode'], patterns: [/\bmode\b/] },
  { path: ['Averages', 'Range'], patterns: [/\brange\b/] },
  { path: ['Averages'], patterns: [/\baverages?\b/] },

  { path: ['Basic Statistics', 'Comparing datasets'], patterns: [/compar(?:e|ing) datasets?/] },
  { path: ['Basic Statistics', 'Reading summary statistics'], patterns: [/summary statistics?/] },
  { path: ['Basic Statistics', 'Interpreting trends'], patterns: [/\btrend/] },
  { path: ['Basic Statistics', 'Comparing means'], patterns: [/compar(?:e|ing) means?/] },
  { path: ['Basic Statistics', 'Comparing percentages'], patterns: [/compar(?:e|ing) percentages?/] },
  { path: ['Basic Statistics'], patterns: [/\bstatistics?\b/, /\bdataset/] },

  { path: ['Tables and Financial Maths', 'Simple interest'], patterns: [/simple interest/] },
  { path: ['Tables and Financial Maths', 'Compound interest'], patterns: [/compound interest/] },
  { path: ['Tables and Financial Maths', 'Profit'], patterns: [/\bprofit\b/, /\brevenue\b/] },
  { path: ['Tables and Financial Maths', 'Loss'], patterns: [/\bloss\b/] },
  { path: ['Tables and Financial Maths', 'Mark-up'], patterns: [/\bmark-?up\b/] },
  { path: ['Tables and Financial Maths', 'Margin'], patterns: [/\bmargin\b/] },
  { path: ['Tables and Financial Maths', 'Discounts'], patterns: [/\bdiscount/] },
  { path: ['Tables and Financial Maths', 'VAT/GST'], patterns: [/\bvat\b/, /\bgst\b/, /\btax\b/] },
  { path: ['Tables and Financial Maths', 'Interest'], patterns: [/\binterest\b/] },

  { path: ['Algebra'], patterns: [/\balgebra\b/, /\bequation\b/, /\bsolve for\b/] },

  { path: ['Probability', 'Simple probability'], patterns: [/simple probability/] },
  { path: ['Probability', 'Expected outcomes'], patterns: [/expected outcomes?/, /expected value/] },
  { path: ['Probability'], patterns: [/\bprobability\b/, /\bchance\b/, /\blikelihood\b/] },

  { path: ['Geometry', 'Area', 'Rectangle'], patterns: [/\brectangle\b/] },
  { path: ['Geometry', 'Area', 'Square'], patterns: [/\bsquare\b/] },
  { path: ['Geometry', 'Area', 'Triangle'], patterns: [/\btriangle\b/] },
  { path: ['Geometry', 'Area'], patterns: [/\barea\b/] },
  { path: ['Geometry', 'Perimeter'], patterns: [/\bperimeter\b/] },
  { path: ['Geometry', 'Volume', 'Cubes'], patterns: [/\bcubes?\b/] },
  { path: ['Geometry', 'Volume', 'Rectangular prisms'], patterns: [/rectangular prisms?/] },
  { path: ['Geometry', 'Volume'], patterns: [/\bvolume\b/] },
  { path: ['Geometry', 'Circumference'], patterns: [/\bcircumference\b/] },
  { path: ['Geometry'], patterns: [/\bgeometry\b/] },

  { path: ['Time Calculations', 'Timetables'], patterns: [/\btimetable\b/] },
  { path: ['Time Calculations', 'Scheduling'], patterns: [/\bschedul(?:e|ing)\b/] },
  { path: ['Time Calculations', 'Duration'], patterns: [/\bduration\b/, /\belapsed\b/] },
  { path: ['Time Calculations', 'Time zones'], patterns: [/time zones?/] },

  { path: ['Multi-Step Calculations'], patterns: [/multi-?step/, /multiple steps?/] },
]

export function getQuantitativeReasoningTagPathsForQuestion(args: {
  stem: ParsedStem
  question: ParsedStem['questions'][number]
}): string[][] {
  const optionText = args.question.options.map((opt) => opt.text).join(' ')
  const text = normalizedText(`${args.stem.stemText} ${args.question.text} ${optionText}`)
  const matched = QR_TAG_RULES.filter((rule) => hasAny(text, rule.patterns)).map((rule) => rule.path)

  return matched.filter(
    (path) =>
      !matched.some(
        (other) =>
          other.length > path.length &&
          path.every((part, index) => other[index] === part)
      )
  )
}
