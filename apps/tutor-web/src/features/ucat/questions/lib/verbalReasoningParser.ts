import type { Json } from '@altitutor/shared'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

type OptionLabel = string

export type ParsedOption = {
  label: OptionLabel
  text: string
}

export type ParsedQuestion = {
  number: number | null
  text: string
  options: ParsedOption[]
}

export type ParsedStem = {
  stemText: string
  questions: ParsedQuestion[]
}

export type VerbalReasoningParserConfig = {
  /**
   * Maximum number of consecutive blank lines we keep when normalising text.
   * Extra blank lines are collapsed.
   */
  maxConsecutiveBlankLines: number
}

const DEFAULT_CONFIG: VerbalReasoningParserConfig = {
  maxConsecutiveBlankLines: 2,
}

type PMNode = {
  type?: string
  content?: PMNode[]
  text?: string
  [key: string]: unknown
}

const QUESTION_INLINE_RE = /^\s*(\d+)[.)]?\s+(.*\S)\s*$/
const QUESTION_NUMBER_ONLY_RE = /^\s*(\d+)[.)]?\s*$/
// Option patterns:
// - We intentionally only treat labels like "a)", "b.", "c)" as options.
// - Bare "a " / "b " etc. (without punctuation) are common in prose
//   ("a woman's purse") and should NOT start an option.
const OPTION_INLINE_RE = /^\s*([a-zA-Z])[).]\s+(.*\S)\s*$/
const OPTION_LABEL_ONLY_RE = /^\s*([a-zA-Z])[).]\s*$/

function isBlank(line: string): boolean {
  return line.trim().length === 0
}

function normaliseTextBlock(lines: string[], config: VerbalReasoningParserConfig): string {
  const trimmed = lines.map((line) => line.replace(/\s+$/u, ''))

  const result: string[] = []
  let blankCount = 0

  for (const line of trimmed) {
    if (isBlank(line)) {
      blankCount += 1
      if (blankCount <= config.maxConsecutiveBlankLines) {
        result.push('')
      }
    } else {
      blankCount = 0
      result.push(line)
    }
  }

  // Trim leading and trailing blank lines
  while (result.length > 0 && isBlank(result[0] ?? '')) {
    result.shift()
  }
  while (result.length > 0 && isBlank(result[result.length - 1] ?? '')) {
    result.pop()
  }

  return result.join('\n').trim()
}

function nodeToText(node: PMNode | null | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') {
    return node.text
  }
  if (!Array.isArray(node.content) || node.content.length === 0) {
    return ''
  }
  return node.content.map((child) => nodeToText(child)).join(' ')
}

function collectLogicalLinesFromNode(node: PMNode, lines: string[]): void {
  if (!node) return

  if (node.type === 'table') {
    const rows = Array.isArray(node.content) ? node.content : []
    for (const row of rows) {
      const cells = Array.isArray(row.content) ? row.content : []
      for (const cell of cells) {
        const text = nodeToText(cell).trim()
        if (text.length > 0) {
          lines.push(text)
        }
      }
    }
    return
  }

  if (node.type === 'paragraph') {
    const text = nodeToText(node).trim()
    if (text.length > 0) {
      lines.push(text)
    }
    return
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectLogicalLinesFromNode(child, lines)
    }
  }
}

function collectLogicalLinesFromDoc(doc: Json | null | undefined): string[] {
  if (!doc || typeof doc !== 'object') return []
  const root = doc as PMNode
  const lines: string[] = []

  if (root.type === 'doc' && Array.isArray(root.content)) {
    for (const child of root.content) {
      collectLogicalLinesFromNode(child, lines)
    }
  } else {
    collectLogicalLinesFromNode(root, lines)
  }

  return lines
}

function parseVerbalReasoningFromLines(
  rawLines: string[],
  configOverrides?: Partial<VerbalReasoningParserConfig>
): ParsedStem[] {
  const config: VerbalReasoningParserConfig = { ...DEFAULT_CONFIG, ...configOverrides }

  const stems: ParsedStem[] = []

  let stemLines: string[] = []
  let questions: ParsedQuestion[] = []
  let currentQuestion: ParsedQuestion | null = null
  let questionTextLines: string[] = []
  let currentOption: ParsedOption | null = null
  let currentOptionLines: string[] = []
  let haveSeenOptionForCurrentQuestion = false
  /** After a label-only line (e.g. "a)"), the next single line is the option text. */
  let expectingOptionTextLine = false

  const flushCurrentOption = (): void => {
    if (!currentOption || !currentQuestion) return
    const text = normaliseTextBlock(currentOptionLines, config)
    currentQuestion.options.push({ label: currentOption.label, text })
    currentOption = null
    currentOptionLines = []
  }

  const flushCurrentQuestion = (): void => {
    if (!currentQuestion) return
    flushCurrentOption()
    expectingOptionTextLine = false
    const text = normaliseTextBlock(questionTextLines, config)
    questions.push({
      number: currentQuestion.number,
      text,
      options: currentQuestion.options,
    })
    currentQuestion = null
    questionTextLines = []
    haveSeenOptionForCurrentQuestion = false
  }

  const finaliseStem = (): void => {
    const stemText = normaliseTextBlock(stemLines, config)
    if (stemText === '' && questions.length === 0) return
    stems.push({ stemText, questions: [...questions] })
    stemLines = []
    questions = []
  }

  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7499e0',
      },
      body: JSON.stringify({
        sessionId: '7499e0',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'verbalReasoningParser.ts:parseVerbalReasoningFromLines',
        message: 'Initial logical lines snapshot',
        data: {
          lineCount: rawLines.length,
          firstLines: rawLines.slice(0, 30),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  } catch {
    // ignore logging errors
  }
  // #endregion agent log

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const line = rawLines[idx] ?? ''
    const trimmed = line.trim()

    // After a label-only cell (e.g. "a)"), the next cell is the single line of option text.
    if (expectingOptionTextLine && currentOption && currentQuestion) {
      currentOptionLines = [line]
      flushCurrentOption()
      haveSeenOptionForCurrentQuestion = true
      expectingOptionTextLine = false
      continue
    }

    const inlineQuestionMatch = QUESTION_INLINE_RE.exec(line)
    const numberOnlyMatch = QUESTION_NUMBER_ONLY_RE.exec(line)
    const inlineOptionMatch = OPTION_INLINE_RE.exec(line)
    const labelOnlyMatch = OPTION_LABEL_ONLY_RE.exec(line)

    const isQuestionLine = !!inlineQuestionMatch || !!numberOnlyMatch

    // Start of a new question (number in one cell, question text may follow in next cells) (number may be in one cell, question text in following cells)
    if (isQuestionLine) {
      flushCurrentQuestion()
      expectingOptionTextLine = false

      const qNumberRaw =
        inlineQuestionMatch != null ? inlineQuestionMatch[1] ?? '' : numberOnlyMatch?.[1] ?? ''
      const qNumber = Number.parseInt(qNumberRaw, 10)
      const questionNumber = Number.isNaN(qNumber) ? null : qNumber

      currentQuestion = { number: questionNumber, text: '', options: [] }
      questionTextLines = []
      currentOption = null
      currentOptionLines = []
      haveSeenOptionForCurrentQuestion = false

      if (inlineQuestionMatch && inlineQuestionMatch[2]) {
        questionTextLines.push(inlineQuestionMatch[2])
      }
      continue
    }

    // Answer option: label+text in one cell, or label only (next cell = option text, one line)
    if ((inlineOptionMatch || labelOnlyMatch) && currentQuestion) {
      flushCurrentOption()
      const label = (inlineOptionMatch ?? labelOnlyMatch)?.[1] ?? ''
      const textFromLine = inlineOptionMatch ? (inlineOptionMatch[2] ?? '').trim() : ''
      currentOption = { label, text: '' }
      currentOptionLines = []
      if (textFromLine !== '') {
        currentOptionLines.push(textFromLine)
        haveSeenOptionForCurrentQuestion = true
      } else {
        expectingOptionTextLine = true
      }
      continue
    }

    // New-stem detection: we've completed at least one full option and see a line
    // that is neither a question nor an option → start of next stem.
    if (
      currentQuestion &&
      haveSeenOptionForCurrentQuestion &&
      !isBlank(trimmed) &&
      !(inlineOptionMatch || labelOnlyMatch)
    ) {
      flushCurrentQuestion()
      finaliseStem()
      stemLines.push(line)
      continue
    }

    // Still inside current question (question text can span multiple lines until options).
    if (currentQuestion && !haveSeenOptionForCurrentQuestion) {
      questionTextLines.push(line)
      continue
    }

    // Otherwise stem body text
    if (!isBlank(trimmed)) {
      stemLines.push(line)
    }
  }

  // Final flush at EOF
  flushCurrentQuestion()
  finaliseStem()

  // #region agent log
  try {
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7499e0',
      },
      body: JSON.stringify({
        sessionId: '7499e0',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'verbalReasoningParser.ts:parseVerbalReasoningFromLines',
        message: 'Parsed stems summary',
        data: {
          stemCount: stems.length,
          stems: stems.slice(0, 3).map((stem) => ({
            stemPreview: stem.stemText.slice(0, 120),
            questionCount: stem.questions.length,
            optionCounts: stem.questions.map((q) => q.options.length),
          })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  } catch {
    // ignore logging errors
  }
  // #endregion agent log

  return stems
}

/**
 * Parse a plain-text Verbal Reasoning passage with its questions and options
 * into a structured representation. This is kept for backwards compatibility
 * and tests; new code should prefer `parseVerbalReasoningFromDoc`.
 */
export function parseVerbalReasoningPlainText(
  input: string,
  configOverrides?: Partial<VerbalReasoningParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseVerbalReasoningFromLines(rawLines, configOverrides)
}

/**
 * Parse a Verbal Reasoning passage directly from a ProseMirror JSON document.
 * This inspects tables, rows, and cells so that each logical object
 * (stem paragraph, question text, answer option) occupies its own "line"
 * before being fed into the line-based parser.
 */
export function parseVerbalReasoningFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<VerbalReasoningParserConfig>
): ParsedStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc)
  return parseVerbalReasoningFromLines(logicalLines, configOverrides)
}

function toRichText(text: string): Json {
  return plainTextToProseMirror(text) as Json
}

/** All apostrophe-like characters (straight, curly, prime) so "Can't" normalises to "cant". */
const APOSTROPHE_LIKE_RE = /[\u0027\u2018\u2019\u201A\u201B\u2032\u2035]/g

/** Normalise option text for category detection: lowercase, no punctuation, single spaces. */
function normaliseOptionTextForCategory(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(APOSTROPHE_LIKE_RE, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * For Verbal Reasoning: if any question in the stem has answer options exactly
 * "True", "False", and "Can't Tell" (ignoring case, spaces, punctuation, order),
 * return "True, False, Can't Tell"; otherwise "Reading Comprehension".
 */
export function getVerbalReasoningStemCategoryName(
  stem: ParsedStem
): 'True, False, Can\'t Tell' | 'Reading Comprehension' {
  for (const q of stem.questions) {
    const optionSet = new Set(q.options.map((opt) => normaliseOptionTextForCategory(opt.text)))
    if (
      optionSet.size === 3 &&
      optionSet.has('true') &&
      optionSet.has('false') &&
      optionSet.has('cant tell')
    ) {
      return 'True, False, Can\'t Tell'
    }
  }
  return 'Reading Comprehension'
}

export type VerbalReasoningToFormOptions = {
  /** UCAT section ID (Verbal Reasoning) that all stems belong to. */
  sectionId: string
  /** Optional category ID to assign to all stems. */
  categoryId?: string | null
  /**
   * Optional per-stem category resolver (e.g. from getVerbalReasoningStemCategoryName).
   * When provided, overrides categoryId for each stem.
   */
  getCategoryIdForStem?: (stem: ParsedStem) => string | null
  /** Whether newly created stems should be private. Defaults to false (public). */
  isPrivate?: boolean
}

/**
 * Map parsed Verbal Reasoning stems into `UcatQuestionStemFormValues` so they
 * can be edited in the standard UCAT question stem editor.
 *
 * We intentionally leave difficulty, time burden, tags, answer explanations,
 * and correct answers unset so tutors can review and complete them in the
 * bulk-edit UI.
 */
export function mapParsedVerbalReasoningToFormValues(
  stems: ParsedStem[],
  options: VerbalReasoningToFormOptions
): UcatQuestionStemFormValues[] {
  const { sectionId, categoryId = null, getCategoryIdForStem, isPrivate = false } = options

  return stems
    .filter((stem) => stem.stemText.trim().length > 0 && stem.questions.length > 0)
    .map((stem) => {
      const questions = stem.questions
        .filter((q) => q.text.trim().length > 0 && q.options.length > 0)
        .map((q) => ({
          questionText: toRichText(q.text),
          questionType: 'multiple_choice' as const,
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '',
          tagIds: [],
          options: q.options.map((opt) => ({
            answerText: toRichText(opt.text),
            answerExplanation: null,
            isAnswer: false,
          })),
        }))

      if (questions.length === 0) {
        // Skip stems that do not produce any valid questions.
        return null
      }

      const resolvedCategoryId =
        getCategoryIdForStem != null ? getCategoryIdForStem(stem) : categoryId

      const values: UcatQuestionStemFormValues = {
        sectionId,
        categoryId: resolvedCategoryId ?? null,
        stemText: toRichText(stem.stemText),
        isPrivate,
        questions,
      }

      return values
    })
    .filter((v): v is UcatQuestionStemFormValues => v !== null)
}

