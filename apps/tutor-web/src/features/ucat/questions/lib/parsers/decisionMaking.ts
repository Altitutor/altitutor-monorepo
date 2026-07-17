import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirror,
  tokenizedPlainTextToProseMirrorWithLineBreaks,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  buildOptionRegexes,
  buildQuestionRegexes,
  collectLogicalLinesFromDoc,
  parseFromLines,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

/** Same shape as core ParsedOption; used when we attach questionType. */
export type ParsedDecisionMakingOption = {
  label: string
  text: string
}

export type ParsedDecisionMakingQuestion = {
  number: number | null
  text: string
  questionType: 'syllogism' | 'multiple_choice'
  options: ParsedDecisionMakingOption[]
}

export type ParsedDecisionMakingStem = {
  stemText: string
  questions: ParsedDecisionMakingQuestion[]
}

export type DecisionMakingQuestionNumberPlacement = 'question' | 'item_stem'

export type DecisionMakingParserConfig = Partial<ParserConfig> & {
  questionNumberPlacement?: DecisionMakingQuestionNumberPlacement
}

function normaliseForSyllogismDetection(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '')
}

/**
 * True if normalised question text indicates a syllogism (e.g. "Place 'Yes' if the conclusion does follow").
 * Decision Making analogue of VR's getVerbalReasoningStemCategoryName.
 */
export function isSyllogismQuestionText(questionText: string): boolean {
  const n = normaliseForSyllogismDetection(questionText)
  if (!n) return false
  const hasYes = n.includes('yes')
  const hasConclusion = n.includes('conclusion')
  const hasFollow = n.includes('follow')
  const hasNo = n.includes('no')
  const hasDoesNot = n.includes('doesnot') || n.includes('doesnt')
  return (
    (hasYes && hasConclusion && hasFollow) ||
    (hasNo && hasConclusion && hasFollow) ||
    (hasDoesNot && hasFollow) ||
    (hasConclusion && hasFollow)
  )
}

const IMAGE_TOKEN_RE = /^\s*\[\[IMG:[^\]]+\]\]\s*$/

function lineHasQuestionNumber(line: string, config: Partial<ParserConfig>): boolean {
  const qRe = buildQuestionRegexes(config.questionIndicator ?? 'dot')
  return qRe.inline.test(line) || qRe.numberOnly.test(line)
}

function previousNonBlankLine(lines: string[], index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim() ?? ''
    if (line.length > 0) return line
  }
  return null
}

function hasSyllogismOptionEvidenceAfter(lines: string[], index: number): boolean {
  const nonBlank: string[] = []
  for (let i = index + 1; i < lines.length && nonBlank.length < 5; i += 1) {
    const line = lines[i]?.trim() ?? ''
    if (line.length === 0) continue
    if (IMAGE_TOKEN_RE.test(line)) return true
    nonBlank.push(line)
  }
  return nonBlank.length >= 5
}

export const SYLLOGISM_IMAGE_PLACEHOLDER_LINES = [
  '[Syllogism image statement 1 pending OCR]',
  '[Syllogism image statement 2 pending OCR]',
  '[Syllogism image statement 3 pending OCR]',
  '[Syllogism image statement 4 pending OCR]',
  '[Syllogism image statement 5 pending OCR]',
] as const

export function isSyllogismManualEntryPlaceholder(text: string): boolean {
  const trimmed = text.trim()
  return SYLLOGISM_IMAGE_PLACEHOLDER_LINES.some((placeholder) => placeholder === trimmed)
}

export function questionNeedsSyllogismManualEntry(
  question: Pick<ParsedDecisionMakingQuestion, 'questionType' | 'options'>
): boolean {
  if (question.questionType !== 'syllogism') return false
  if (question.options.length !== 5) return true
  return question.options.some((option) => isSyllogismManualEntryPlaceholder(option.text))
}

function stripQuestionNumber(line: string, config: Partial<ParserConfig>): string {
  const qRe = buildQuestionRegexes(config.questionIndicator ?? 'dot')
  const inlineMatch = qRe.inline.exec(line)
  if (inlineMatch) return inlineMatch[2]?.trim() ?? ''
  return line.trim()
}

function isSyllogismImageTokenForPreviousQuestion(
  lines: string[],
  index: number,
  config: Partial<ParserConfig>
): boolean {
  const line = lines[index]?.trim() ?? ''
  if (!IMAGE_TOKEN_RE.test(line)) return false
  const previous = previousNonBlankLine(lines, index)
  if (!previous) return false
  return isSyllogismQuestionText(stripQuestionNumber(previous, config))
}

function isQuestionNumberLine(line: string, config: Partial<ParserConfig>): boolean {
  const qRe = buildQuestionRegexes(config.questionIndicator ?? 'dot')
  return qRe.numberOnly.test(line) || qRe.inline.test(line)
}

function splitQuestionNumberLine(
  line: string,
  config: Partial<ParserConfig>
): { numberText: string; inlineText: string } | null {
  const qRe = buildQuestionRegexes(config.questionIndicator ?? 'dot')
  const inlineMatch = qRe.inline.exec(line)
  if (inlineMatch) {
    return { numberText: inlineMatch[1] ?? '', inlineText: inlineMatch[2] ?? '' }
  }
  const numberOnlyMatch = qRe.numberOnly.exec(line)
  if (numberOnlyMatch) {
    return { numberText: numberOnlyMatch[1] ?? '', inlineText: '' }
  }
  return null
}

function isAnswerOptionLine(line: string, config: Partial<ParserConfig>): boolean {
  const oRe = buildOptionRegexes(config.answerOptionIndicator ?? 'dot')
  return oRe.labelOnly.test(line) || oRe.inline.test(line)
}

function findLastNonBlankIndex(lines: string[], endExclusive: number): number {
  for (let i = endExclusive - 1; i >= 0; i -= 1) {
    if ((lines[i] ?? '').trim().length > 0) return i
  }
  return -1
}

function findItemStemOptionStart(lines: string[], config: Partial<ParserConfig>): number {
  for (let i = 0; i < lines.length; i += 1) {
    if (isAnswerOptionLine(lines[i] ?? '', config)) return i
  }

  for (let i = 1; i < lines.length; i += 1) {
    if (
      IMAGE_TOKEN_RE.test((lines[i] ?? '').trim()) &&
      isSyllogismQuestionText(lines[findLastNonBlankIndex(lines, i)] ?? '')
    ) {
      return i
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (!isSyllogismQuestionText(lines[i] ?? '')) continue
    const trailingNonBlank = lines.slice(i + 1).filter((line) => line.trim().length > 0)
    if (trailingNonBlank.length >= 5) return i + 1
  }

  return -1
}

function normalizeItemStemNumberedQuestionLines(
  rawLines: string[],
  config: Partial<ParserConfig>
): string[] {
  const blocks: Array<{ numberText: string; lines: string[] }> = []
  let current: { numberText: string; lines: string[] } | null = null
  const introLines: string[] = []

  for (const line of rawLines) {
    const marker = isQuestionNumberLine(line, config)
      ? splitQuestionNumberLine(line, config)
      : null
    if (marker) {
      if (current) blocks.push(current)
      current = {
        numberText: marker.numberText,
        lines: marker.inlineText.trim().length > 0 ? [marker.inlineText] : [],
      }
      continue
    }

    if (current) {
      current.lines.push(line)
    } else {
      introLines.push(line)
    }
  }
  if (current) blocks.push(current)

  if (blocks.length === 0) return rawLines

  const normalized: string[] = [...introLines]
  const questionIndicator = config.questionIndicator ?? 'dot'
  const separator = questionIndicator === 'paren' ? ')' : '.'

  for (const block of blocks) {
    const optionStart = findItemStemOptionStart(block.lines, config)
    const questionIndex = optionStart >= 0 ? findLastNonBlankIndex(block.lines, optionStart) : -1

    if (optionStart < 0 || questionIndex < 0) {
      normalized.push(`${block.numberText}${separator}`)
      normalized.push(...block.lines)
      continue
    }

    normalized.push(...block.lines.slice(0, questionIndex))
    normalized.push(`${block.numberText}${separator} ${block.lines[questionIndex]?.trim() ?? ''}`)
    normalized.push(...block.lines.slice(questionIndex + 1))
  }

  return normalized
}

export function normalizeDecisionMakingSyllogismLines(
  rawLines: string[],
  config: Partial<ParserConfig>,
  options?: { imageTokenMode?: 'preserve' | 'placeholder' }
): string[] {
  if (config.questionNumberPlacement === 'item_stem') {
    return normalizeDecisionMakingSyllogismLines(
      normalizeItemStemNumberedQuestionLines(rawLines, config),
      { ...config, questionNumberPlacement: 'question' },
      options
    )
  }

  const questionIndicator = config.questionIndicator ?? 'dot'
  const separator = questionIndicator === 'paren' ? ')' : '.'
  let nextQuestionNumber = 1
  const normalized: string[] = []

  rawLines.forEach((line, index) => {
    if (
      options?.imageTokenMode === 'placeholder' &&
      isSyllogismImageTokenForPreviousQuestion(rawLines, index, config)
    ) {
      normalized.push(...SYLLOGISM_IMAGE_PLACEHOLDER_LINES)
      return
    }

    const qRe = buildQuestionRegexes(questionIndicator)
    const inlineMatch = qRe.inline.exec(line)
    const numberOnlyMatch = qRe.numberOnly.exec(line)
    const existingNumber = Number.parseInt(inlineMatch?.[1] ?? numberOnlyMatch?.[1] ?? '', 10)
    if (!Number.isNaN(existingNumber)) {
      nextQuestionNumber = existingNumber + 1
      normalized.push(line)
      return
    }

    const trimmed = line.trim()
    if (!isSyllogismQuestionText(trimmed)) {
      normalized.push(line)
      return
    }
    if (!hasSyllogismOptionEvidenceAfter(rawLines, index)) {
      normalized.push(line)
      return
    }

    const previous = previousNonBlankLine(rawLines, index)
    if (previous && lineHasQuestionNumber(previous, config)) {
      normalized.push(line)
      return
    }

    const numbered = `${nextQuestionNumber}${separator} ${trimmed}`
    nextQuestionNumber += 1
    normalized.push(numbered)
  })

  return normalized
}

function parseDecisionMakingFromLines(
  rawLines: string[],
  configOverrides?: DecisionMakingParserConfig
): ParsedDecisionMakingStem[] {
  const config = {
    acceptSyllogismOptions: true,
    ...configOverrides,
  }
  const normalizedLines = normalizeDecisionMakingSyllogismLines(rawLines, config)
  const stems = parseFromLines(normalizedLines, config)
  return stems.map((stem) => ({
    stemText: stem.stemText,
    questions: stem.questions.map((q) => ({
      number: q.number,
      text: q.text,
      questionType: isSyllogismQuestionText(q.text)
        ? ('syllogism' as const)
        : ('multiple_choice' as const),
      options: q.options.map((opt) => ({ label: opt.label, text: opt.text })),
    })),
  }))
}

export function parseDecisionMakingFromDoc(
  doc: Json | null | undefined,
  configOverrides?: DecisionMakingParserConfig
): ParsedDecisionMakingStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc)
  return parseDecisionMakingFromLines(logicalLines, configOverrides)
}

export function parseDecisionMakingPlainText(
  input: string,
  configOverrides?: DecisionMakingParserConfig
): ParsedDecisionMakingStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseDecisionMakingFromLines(rawLines, configOverrides)
}

function toRichText(text: string): Json {
  return tokenizedPlainTextToProseMirror(text) as Json
}

export type DecisionMakingCategoryName =
  | 'Syllogisms'
  | 'Recognising Assumptions'
  | 'Venn Diagrams'
  | 'Probabilistic and Statistical Reasoning'
  | 'Logical Puzzles'

const PROBABILISTIC_KEYWORDS = [
  'probability',
  'probabilistic',
  'probabilities',
  'statistical',
  'statistics',
  'chance',
  'odds',
  'likelihood',
  'percent',
  'lottery',
  'spinner',
  'randomly',
] as const

const PROBABILISTIC_PATTERNS = [
  /\d+\s*%/,
  /\bfair(?:\s+six-sided)?\s+(?:dice|die|coin)\b/,
  /\b(?:dice|die)\b.*\b(?:re-?)?rolls?\b/,
  /\b(?:re-?)?rolls?\b.*\b(?:dice|die)\b/,
  /\bcoin\b.*\b(?:flip|toss)(?:es|ed|ing)?\b/,
  /\b(?:flip|toss)(?:es|ed|ing)?\b.*\bcoin\b/,
] as const

function containsProbabilisticSignals(text: string): boolean {
  const lower = text.toLowerCase()
  if (PROBABILISTIC_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true
  }
  return PROBABILISTIC_PATTERNS.some((pattern) => pattern.test(lower))
}

function stemHasProbabilisticSignals(stem: ParsedDecisionMakingStem): boolean {
  if (containsProbabilisticSignals(stem.stemText)) {
    return true
  }
  return stem.questions.some(
    (q) =>
      containsProbabilisticSignals(q.text) ||
      q.options.some((opt) => containsProbabilisticSignals(opt.text))
  )
}

/**
 * Get Decision Making category name from stem content.
 * Rules applied in order: Syllogisms, Recognising Assumptions, Venn Diagrams,
 * Probabilistic and Statistical Reasoning, Logical Puzzles.
 */
export function getDecisionMakingStemCategoryName(
  stem: ParsedDecisionMakingStem
): DecisionMakingCategoryName {
  const stemLower = stem.stemText.toLowerCase()
  const hasDiagramInStem = stemLower.includes('diagram')

  const containsImage = (text: string): boolean => text.includes('[[IMG:')

  const stemHasImage = containsImage(stem.stemText)

  for (const q of stem.questions) {
    const qLower = q.text.toLowerCase()
    const questionHasImage = containsImage(q.text)
    const anyOptionHasImage = q.options.some((opt) => containsImage(opt.text))

    if (q.questionType === 'syllogism') {
      return 'Syllogisms'
    }
    if (qLower.includes('argument')) {
      return 'Recognising Assumptions'
    }
    if (
      (hasDiagramInStem || qLower.includes('diagram')) &&
      (stemHasImage || questionHasImage || anyOptionHasImage)
    ) {
      return 'Venn Diagrams'
    }
  }

  if (stemHasProbabilisticSignals(stem)) {
    return 'Probabilistic and Statistical Reasoning'
  }

  return 'Logical Puzzles'
}

export type DecisionMakingToFormOptions = {
  sectionId: string
  categoryId?: string | null
  getCategoryIdForStem?: (stem: ParsedDecisionMakingStem) => string | null
  getTagIdsForQuestion?: (args: {
    stem: ParsedDecisionMakingStem
    question: ParsedDecisionMakingQuestion
  }) => string[]
  accessScope?: 'public' | 'private'
}

function normalizedText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

type DecisionMakingTagRule = {
  path: string[]
  patterns?: readonly RegExp[]
  matches?: (args: {
    text: string
    stemText: string
    questionText: string
    optionText: string
    question: ParsedDecisionMakingQuestion
  }) => boolean
}

function hasSetReasoningContext(text: string): boolean {
  return /\b(?:venn|diagram|set|sets|groups|categories|region|overlap|intersection|union)\b/.test(text)
}

const DM_TAG_RULES: DecisionMakingTagRule[] = [
  {
    path: ['Deductive logic', 'Quantifiers: all / some / none'],
    patterns: [
      /\b(?:all|some|none|no|not all|every|each)\b/,
      /\bat least one\b/,
      /\bthe rest\b/,
    ],
    matches: ({ question }) => question.questionType === 'syllogism',
  },
  {
    path: ['Deductive logic', 'Conditional reasoning'],
    patterns: [
      /\bif\b/,
      /\bonly if\b/,
      /\bthen\b/,
      /\beither\b.*\bor\b/,
      /\bunless\b/,
      /\bprovided that\b/,
    ],
  },
  {
    path: ['Deductive logic', 'Negation and complements'],
    patterns: [
      /\bnot\b/,
      /\bno\b/,
      /\bnone\b/,
      /\bneither\b/,
      /\bexcept\b/,
      /\bdoes not\b/,
      /\bdid not\b/,
      /\bcannot\b/,
    ],
  },
  {
    path: ['Deductive logic', 'Must be true / necessarily follows'],
    patterns: [
      /\bmust be true\b/,
      /\bnecessarily\b/,
      /\bdoes follow\b/,
      /\bconclusion follows?\b/,
      /\bwhich (?:one )?must\b/,
    ],
  },
  {
    path: ['Deductive logic', 'Cannot be concluded'],
    patterns: [
      /\bcannot be concluded\b/,
      /\bcannot conclude\b/,
      /\bdoes not follow\b/,
      /\bnot necessarily\b/,
      /\bnot enough information\b/,
    ],
  },

  {
    path: ['Rule-based problem solving', 'Ordering and ranking'],
    patterns: [
      /\border(?:ed|ing)?\b/,
      /\brank(?:ed|ing)?\b/,
      /\bbefore\b/,
      /\bafter\b/,
      /\bfirst\b/,
      /\blast\b/,
      /\bearlier\b/,
      /\blater\b/,
      /\bhigher\b/,
      /\blower\b/,
      /\boldest\b/,
      /\byoungest\b/,
      /\bgreater than\b/,
      /\bless than\b/,
    ],
  },
  {
    path: ['Rule-based problem solving', 'Matching and assignment'],
    patterns: [
      /\bmatch(?:ed|ing)?\b/,
      /\bassign(?:ed|ment)?\b/,
      /\bbelongs? to\b/,
      /\bpaired with\b/,
      /\bkey\b/,
      /\bbox\b/,
      /\bowner\b/,
      /\bwhich person\b/,
      /\beach (?:person|student|friend|doctor|member)\b/,
    ],
  },
  {
    path: ['Rule-based problem solving', 'Seating or spatial arrangement'],
    patterns: [
      /\bseat(?:ed|ing)?\b/,
      /\bsit(?:s|ting)?\b/,
      /\brow\b/,
      /\btable\b/,
      /\bleft\b/,
      /\bright\b/,
      /\bfront\b/,
      /\bback\b/,
      /\bopposite\b/,
      /\badjacent\b/,
      /\bposition\b/,
    ],
  },
  {
    path: ['Rule-based problem solving', 'Scheduling and selection'],
    patterns: [
      /\bschedul(?:e|ed|ing)\b/,
      /\btimetable\b/,
      /\bday\b/,
      /\bdate\b/,
      /\bmonth\b/,
      /\bappointment\b/,
      /\bselect(?:ed|ion)?\b/,
      /\bchosen\b/,
      /\bchoose\b/,
      /\bteam\b/,
    ],
  },
  {
    path: ['Rule-based problem solving', 'Multi-constraint deduction'],
    patterns: [
      /\bfollowing (?:facts|statements|rules|conditions)\b/,
      /\bconditions?\b/,
      /\brules?\b/,
      /\bconstraints?\b/,
      /\bmust\b/,
      /\bcan only\b/,
      /\bpossible\b/,
      /\bnot possible\b/,
    ],
  },

  {
    path: ['Set and Venn reasoning', 'Diagram selection'],
    patterns: [
      /\bdiagram\b/,
      /\bvenn\b/,
      /\bbest represents?\b/,
      /\brepresents? the relationship\b/,
    ],
    matches: ({ text }) => hasSetReasoningContext(text),
  },
  {
    path: ['Set and Venn reasoning', 'Region counting'],
    patterns: [
      /\bhow many\b/,
      /\bnumber of\b/,
      /\bregion\b/,
      /\blabel(?:led|ed)?\b/,
      /\barea\b/,
    ],
    matches: ({ text }) => hasSetReasoningContext(text),
  },
  {
    path: ['Set and Venn reasoning', 'Intersections and unions'],
    patterns: [
      /\bboth\b/,
      /\band\b.*\b(?:or|both)\b/,
      /\beither\b.*\bor\b/,
      /\boverlap\b/,
      /\bintersect(?:ion|s)?\b/,
      /\bunion\b/,
    ],
    matches: ({ text }) => hasSetReasoningContext(text),
  },
  {
    path: ['Set and Venn reasoning', 'Only / neither / complements'],
    patterns: [
      /\bonly\b/,
      /\bneither\b/,
      /\bnot\b/,
      /\bdid not\b/,
      /\bnone\b/,
      /\boutside\b/,
      /\bcomplement\b/,
    ],
    matches: ({ text }) => hasSetReasoningContext(text),
  },
  {
    path: ['Set and Venn reasoning', 'Three-plus sets'],
    patterns: [
      /\bthree\b.*\b(?:sets|groups|categories)\b/,
      /\bfour\b.*\b(?:sets|groups|categories)\b/,
      /\b3\b.*\b(?:sets|groups|categories)\b/,
      /\b4\b.*\b(?:sets|groups|categories)\b/,
    ],
    matches: ({ text }) => hasSetReasoningContext(text),
  },

  {
    path: ['Probability and data reasoning', 'Basic probability'],
    patterns: [
      /\bprobabilit(?:y|ies)\b/,
      /\bchance\b/,
      /\bodds\b/,
      /\blikelihood\b/,
      /\brandom(?:ly)?\b/,
      /\bfair (?:coin|dice|die)\b/,
      /\bgreater than chance\b/,
    ],
  },
  {
    path: ['Probability and data reasoning', 'Conditional probability'],
    patterns: [
      /\bgiven that\b/,
      /\bprovided that\b/,
      /\bof those\b/,
      /\bamong those\b/,
      /\bfrom those\b/,
      /\bconsidering only\b/,
    ],
  },
  {
    path: ['Probability and data reasoning', 'Without replacement / combinations'],
    patterns: [
      /\bwithout replacement\b/,
      /\bwithout replacing\b/,
      /\breplaces? his original\b/,
      /\bcombination\b/,
      /\bpermutation\b/,
      /\bblind-?guess(?:ed|ing)?\b/,
      /\bselects? \d+\b/,
      /\bchoose \d+\b/,
    ],
  },
  {
    path: ['Probability and data reasoning', 'Expected value or risk comparison'],
    patterns: [
      /\bexpected\b/,
      /\baverage\b/,
      /\brisk\b/,
      /\bbest choice\b/,
      /\bbetter option\b/,
      /\bmost amount\b/,
      /\bshould\b.*\b(?:accept|choose|take)\b/,
      /\bcost\b/,
    ],
  },
  {
    path: ['Probability and data reasoning', 'Table interpretation'],
    patterns: [
      /\btable\b/,
      /\bchart\b/,
      /\bdata\b/,
      /\bgraph\b/,
      /\battendance\b/,
      /\bappointments?\b/,
    ],
  },
  {
    path: ['Probability and data reasoning', 'Fraction / percentage comparison'],
    patterns: [
      /\d+\s*%/,
      /\bpercent(?:age)?\b/,
      /\bfraction\b/,
      /\bratio\b/,
      /\bproportion\b/,
      /\bgreater than\b/,
      /\bless than\b/,
      /\bmore likely\b/,
      /\bless likely\b/,
    ],
  },

  {
    path: ['Argument evaluation', 'Strongest argument'],
    patterns: [
      /\bstrongest argument\b/,
      /\bbest argument\b/,
      /\bmost convincing\b/,
      /\bargument\b/,
    ],
  },
  {
    path: ['Argument evaluation', 'Causal assumption'],
    patterns: [
      /\breduce\b/,
      /\bincrease\b/,
      /\bcause\b/,
      /\blead to\b/,
      /\bresult in\b/,
      /\bencourage\b/,
      /\bprevent\b/,
      /\bimprove\b/,
      /\bpromote\b/,
    ],
  },
  {
    path: ['Argument evaluation', 'Relevance and scope'],
    patterns: [
      /\brelevant\b/,
      /\bdirectly\b/,
      /\bscope\b/,
      /\baddresses?\b/,
      /\btopic\b/,
      /\bissue\b/,
    ],
  },
  {
    path: ['Argument evaluation', 'Evidence strength'],
    patterns: [
      /\bevidence\b/,
      /\bstudy\b/,
      /\bresearch\b/,
      /\bdata\b/,
      /\bshows?\b/,
      /\bproves?\b/,
      /\bsupports?\b/,
    ],
  },
  {
    path: ['Argument evaluation', 'Practical feasibility'],
    patterns: [
      /\bpractical\b/,
      /\bfeasible\b/,
      /\bimplement(?:ed|ation)?\b/,
      /\bresources?\b/,
      /\bcost\b/,
      /\bafford\b/,
      /\bavailable\b/,
    ],
  },
  {
    path: ['Argument evaluation', 'Policy or public benefit'],
    patterns: [
      /\bgovernment\b/,
      /\bpolicy\b/,
      /\bpublic\b/,
      /\btax\b/,
      /\blegalis(?:e|ing|ation)\b/,
      /\bfine(?:d|s)?\b/,
      /\bunemployment\b/,
      /\bsafety\b/,
      /\bhealth\b/,
      /\bsociety\b/,
    ],
  },

  {
    path: ['Decision wording traps', 'Considering only stated factors'],
    patterns: [
      /\bconsidering only\b/,
      /\bonly the (?:information|factors|data)\b/,
      /\bbased only on\b/,
    ],
  },
  {
    path: ['Decision wording traps', 'Yes/no sufficiency'],
    patterns: [
      /\bcan (?:it|this) be concluded\b/,
      /\bshould\b/,
      /\byes\b.*\bno\b/,
      /\byes\/no\b/,
      /\bplace ['"]?yes['"]?\b/,
      /\bplace ['"]?no['"]?\b/,
    ],
  },
  {
    path: ['Decision wording traps', 'False statement'],
    patterns: [
      /\bfalse statement\b/,
      /\bwhich statement is false\b/,
      /\bnot true\b/,
      /\bincorrect\b/,
    ],
  },
  {
    path: ['Decision wording traps', 'Greater than / less than comparison'],
    patterns: [
      /\bgreater than\b/,
      /\bless than\b/,
      /\bmore than\b/,
      /\bfewer than\b/,
      /\bhigher than\b/,
      /\blower than\b/,
      /\bmore likely\b/,
      /\bless likely\b/,
    ],
  },
]

export function getDecisionMakingTagPathsForQuestion(args: {
  stem: ParsedDecisionMakingStem
  question: ParsedDecisionMakingQuestion
}): string[][] {
  const optionText = args.question.options.map((opt) => opt.text).join(' ')
  const stemText = normalizedText(args.stem.stemText)
  const questionText = normalizedText(args.question.text)
  const normalizedOptionText = normalizedText(optionText)
  const text = normalizedText(`${args.stem.stemText} ${args.question.text} ${optionText}`)
  const matched = DM_TAG_RULES.filter((rule) => {
    const patternMatches = rule.patterns ? hasAny(text, rule.patterns) : false
    const predicateMatches = rule.matches?.({
      text,
      stemText,
      questionText,
      optionText: normalizedOptionText,
      question: args.question,
    }) ?? false
    if (rule.patterns && rule.matches) return patternMatches && predicateMatches
    return patternMatches || predicateMatches
  }).map((rule) => rule.path)

  return matched.filter(
    (path) =>
      !matched.some(
        (other) =>
          other.length > path.length &&
          path.every((part, index) => other[index] === part)
      )
  )
}

/**
 * Map parsed Decision Making stems to UcatQuestionStemFormValues.
 * Each question gets questionType from isSyllogismQuestionText.
 */
export function mapParsedDecisionMakingToFormValues(
  stems: ParsedDecisionMakingStem[],
  options: DecisionMakingToFormOptions
): UcatQuestionStemFormValues[] {
  const {
    sectionId,
    categoryId = null,
    getCategoryIdForStem,
    getTagIdsForQuestion,
    accessScope = 'public',
  } = options

  return stems
    .filter(
      (stem) =>
        stem.questions.length > 0 &&
        stem.questions.every(
          (q) => q.text.trim().length > 0 && q.options.length > 0
        )
    )
    .map((stem) => {
      const questions = stem.questions.map((q) => ({
        questionText: toRichText(q.text),
        questionType: q.questionType,
        syllogismAnswerPattern: null,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: getTagIdsForQuestion?.({ stem, question: q }) ?? [],
        options: q.options.map((opt) => ({
          answerText: toRichText(opt.text),
          answerExplanation: null,
          isAnswer: false,
        })),
      }))
      const resolvedCategoryId =
        getCategoryIdForStem != null ? getCategoryIdForStem(stem) : categoryId

      return {
        sectionId,
        categoryId: resolvedCategoryId ?? null,
        stemText: tokenizedPlainTextToProseMirrorWithLineBreaks(stem.stemText) as Json,
        accessScope,
        questions,
      }
    })
}
