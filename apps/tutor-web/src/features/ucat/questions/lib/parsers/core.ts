import type { Json } from '@altitutor/shared'

/**
 * Shared output types for the line-based UCAT parser.
 * Section-specific parsers (Verbal Reasoning, Decision Making) add their own
 * classification (category, questionType) when mapping to form values.
 */
export type ParsedOption = {
  label: string
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

/** Question number style: "1. 2." vs "1) 2)". */
export type QuestionIndicatorKind = 'dot' | 'paren'

/** Answer option style: "a) b)" vs "a. b.". */
export type AnswerOptionIndicatorKind = 'paren' | 'dot'

export type ParserConfig = {
  /** Maximum consecutive blank lines to keep when normalising. */
  maxConsecutiveBlankLines: number
  /**
   * When true (Decision Making), if we have 5+ lines of question text and the last 5
   * don't look like a) b) c) options, treat those 5 as syllogism options (A–E).
   */
  acceptSyllogismOptions?: boolean
  /** Question number format: "1. 2." (dot) or "1) 2)" (paren). Default 'dot'. */
  questionIndicator?: QuestionIndicatorKind
  /** Answer option format: "a) b)" (paren) or "a. b." (dot). Default 'paren'. */
  answerOptionIndicator?: AnswerOptionIndicatorKind
  /** If true, only treat a line as question start when it is just "1." or "1)" with nothing after; next line is question text. */
  questionNumberOnOwnLine?: boolean
  /** If true, only treat "a)" or "a." on its own line; next line is the option text. */
  answerOptionOnOwnLine?: boolean
}

const DEFAULT_CONFIG: ParserConfig = {
  maxConsecutiveBlankLines: 2,
  questionIndicator: 'dot',
  answerOptionIndicator: 'paren',
}

type PMNode = {
  type?: string
  content?: PMNode[]
  text?: string
  attrs?: Record<string, unknown>
  [key: string]: unknown
}

function encodeImageToken(attrs: Record<string, unknown> | undefined): string | null {
  if (!attrs) return null
  const src = typeof attrs.src === 'string' ? attrs.src : ''
  const fileId = typeof attrs.fileId === 'string' ? attrs.fileId : ''
  if (!src && !fileId) return null

  const parts: string[] = []
  if (fileId) parts.push(`f=${encodeURIComponent(fileId)}`)
  if (src) parts.push(`s=${encodeURIComponent(src)}`)
  if (parts.length === 0) return null

  return `[[IMG:${parts.join(';')}]]`
}

function buildQuestionRegexes(kind: QuestionIndicatorKind): {
  inline: RegExp
  numberOnly: RegExp
} {
  const sep = kind === 'dot' ? '\\.' : '\\)'
  return {
    inline: new RegExp(`^\\s*(\\d+)${sep}\\s+(.*\\S)\\s*$`),
    numberOnly: new RegExp(`^\\s*(\\d+)${sep}\\s*$`),
  }
}

function buildOptionRegexes(kind: AnswerOptionIndicatorKind): {
  inline: RegExp
  labelOnly: RegExp
} {
  const sep = kind === 'paren' ? '\\)' : '\\.'
  return {
    inline: new RegExp(`^\\s*([a-zA-Z])${sep}\\s+(.*\\S)\\s*$`),
    labelOnly: new RegExp(`^\\s*([a-zA-Z])${sep}\\s*$`),
  }
}

function isBlank(line: string): boolean {
  return line.trim().length === 0
}

function normaliseTextBlock(lines: string[], config: ParserConfig): string {
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

  if (node.type === 'image') {
    const token = encodeImageToken(node.attrs)
    return token ?? ''
  }

  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content) || node.content.length === 0) return ''
  return node.content.map((child) => nodeToText(child)).join(' ')
}

function collectLogicalLinesFromNode(node: PMNode, lines: string[]): void {
  if (!node) return

  if (node.type === 'image') {
    const text = nodeToText(node).trim()
    if (text.length > 0) {
      lines.push(text)
    }
    return
  }

  if (node.type === 'table') {
    const rows = Array.isArray(node.content) ? node.content : []
    for (const row of rows) {
      const cells = Array.isArray(row.content) ? row.content : []
      for (const cell of cells) {
        const text = nodeToText(cell).trim()
        if (text.length > 0) lines.push(text)
      }
    }
    return
  }

  if (node.type === 'paragraph') {
    const text = nodeToText(node).trim()
    if (text.length > 0) lines.push(text)
    return
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectLogicalLinesFromNode(child, lines)
    }
  }
}

/**
 * Extract logical lines from a ProseMirror JSON document (paragraphs and table cells).
 * Used by both Verbal Reasoning and Decision Making.
 */
export function collectLogicalLinesFromDoc(doc: Json | null | undefined): string[] {
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

/**
 * Core line-based parser: stem text, numbered questions, and a) b) c) or (when
 * acceptSyllogismOptions) 5 unlabelled lines as syllogism options. New stem when
 * a narrative line appears after at least one full option block.
 */
export function parseFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const config: ParserConfig = { ...DEFAULT_CONFIG, ...configOverrides }
  const qRe = buildQuestionRegexes(config.questionIndicator ?? 'dot')
  const oRe = buildOptionRegexes(config.answerOptionIndicator ?? 'paren')

  const stems: ParsedStem[] = []
  let stemLines: string[] = []
  let questions: ParsedQuestion[] = []
  let currentQuestion: ParsedQuestion | null = null
  let questionTextLines: string[] = []
  let currentOption: ParsedOption | null = null
  let currentOptionLines: string[] = []
  let haveSeenOptionForCurrentQuestion = false
  let expectingOptionTextLine = false
  let expectingQuestionTextLine = false

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
    expectingQuestionTextLine = false
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
    let stemText = normaliseTextBlock(stemLines, config)
    stemText = stemText.replace(/\n{2,}/g, '\n').trim()
    if (stemText === '' && questions.length === 0) return
    stems.push({ stemText, questions: [...questions] })
    stemLines = []
    questions = []
  }

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const line = rawLines[idx] ?? ''
    const trimmed = line.trim()

    if (expectingOptionTextLine && currentOption && currentQuestion) {
      currentOptionLines = [line]
      flushCurrentOption()
      haveSeenOptionForCurrentQuestion = true
      expectingOptionTextLine = false
      continue
    }

    const inlineQuestionMatch = qRe.inline.exec(line)
    const numberOnlyMatch = qRe.numberOnly.exec(line)
    const inlineOptionMatch = oRe.inline.exec(line)
    const labelOnlyMatch = oRe.labelOnly.exec(line)
    const questionNumberOnOwnLine = config.questionNumberOnOwnLine === true
    const answerOptionOnOwnLine = config.answerOptionOnOwnLine === true
    const isQuestionLine =
      !!numberOnlyMatch || (!questionNumberOnOwnLine && !!inlineQuestionMatch)

    if (expectingQuestionTextLine && currentQuestion) {
      if (!isBlank(trimmed)) {
        if (labelOnlyMatch || (inlineOptionMatch && !answerOptionOnOwnLine)) {
          expectingQuestionTextLine = false
          // fall through to option handling below
        } else {
          questionTextLines.push(line)
          expectingQuestionTextLine = false
          continue
        }
      } else {
        continue
      }
    }

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

      if (questionNumberOnOwnLine) {
        expectingQuestionTextLine = true
      } else if (inlineQuestionMatch && inlineQuestionMatch[2]) {
        questionTextLines.push(inlineQuestionMatch[2])
      }
      continue
    }

    const isOptionLine =
      (answerOptionOnOwnLine ? !!labelOnlyMatch : !!(inlineOptionMatch || labelOnlyMatch)) &&
      currentQuestion

    if (isOptionLine) {
      flushCurrentOption()
      const label = (inlineOptionMatch ?? labelOnlyMatch)?.[1] ?? ''
      const textFromLine =
        !answerOptionOnOwnLine && inlineOptionMatch ? (inlineOptionMatch[2] ?? '').trim() : ''
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

    if (currentQuestion && !haveSeenOptionForCurrentQuestion) {
      questionTextLines.push(line)
      if (config.acceptSyllogismOptions && questionTextLines.length >= 5) {
        // Syllogism options are unlabeled (no a) b) c)); use last 5 non-blank lines.
        const nonBlankIndices: number[] = []
        for (let i = questionTextLines.length - 1; i >= 0 && nonBlankIndices.length < 5; i -= 1) {
          if (!isBlank(questionTextLines[i] ?? '')) nonBlankIndices.push(i)
        }
        if (nonBlankIndices.length === 5) {
          const last5NonBlank = nonBlankIndices.reverse() as [number, number, number, number, number]
          const firstIdx = last5NonBlank[0]
          const allNonOption = last5NonBlank.every(
            (i) => {
              const l = questionTextLines[i] ?? ''
              return !oRe.inline.test(l) && !oRe.labelOnly.test(l)
            }
          )
          // Require firstIdx > 0 so we keep at least the question text line (index 0); otherwise
          // we'd splice away everything when questionTextLines has exactly 5 lines (question + 4 options).
          if (allNonOption && firstIdx > 0) {
            const optionTexts = last5NonBlank.map((i) => questionTextLines[i] ?? '')
            questionTextLines.splice(firstIdx, questionTextLines.length - firstIdx)
            const labels = ['A', 'B', 'C', 'D', 'E']
            optionTexts.forEach((text, i) => {
              currentQuestion!.options.push({
                label: labels[i] ?? String(i + 1),
                text: normaliseTextBlock([text], config),
              })
            })
            haveSeenOptionForCurrentQuestion = true
          }
        }
      }
      continue
    }

    if (!isBlank(trimmed)) {
      stemLines.push(line)
    }
  }

  flushCurrentQuestion()
  finaliseStem()

  return stems
}
