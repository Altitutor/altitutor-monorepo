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
  /**
   * When true, numbered question starts are expected to increase by 1 after the
   * first detected question. A later "1." is also allowed so pasted extracts
   * that reset numbering per stem still work.
   */
  enforceSequentialQuestionNumbers?: boolean
  /** Non-blank logical lines to scan after a numbered candidate for answer options. */
  questionLookaheadLimit?: number
}

const DEFAULT_CONFIG: ParserConfig = {
  maxConsecutiveBlankLines: 2,
  questionIndicator: 'dot',
  answerOptionIndicator: 'paren',
  enforceSequentialQuestionNumbers: true,
  questionLookaheadLimit: 24,
}

/** ProseMirror JSON node shape (TipTap `getJSON()`) for parser helpers. */
export type PMNode = {
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

function normaliseStructuralText(text: string): string {
  return text
    .replace(/\[\[TABLE:[^\]]+\]\]/g, '[[TABLE]]')
    .replace(/\[\[IMG:[^\]]+\]\]/g, '[[IMG]]')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
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

export function nodeToText(node: PMNode | null | undefined): string {
  if (!node) return ''

  if (node.type === 'image') {
    const token = encodeImageToken(node.attrs)
    return token ?? ''
  }

  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content) || node.content.length === 0) return ''
  return node.content.map((child) => nodeToText(child)).join(' ')
}

/** Matches option labels: A. B. a) b) etc. (label only) */
const OPTION_LABEL_RE = /^\s*([A-Ea-e])[\.\)]\s*$/
/** Matches label + text in same cell: A. $180 or a) option text */
const OPTION_LABEL_WITH_TEXT_RE = /^\s*([A-Ea-e])[\.\)]\s*(.+)$/
/** Matches question number: 1. 2. 10. etc. */
const QUESTION_NUMBER_RE = /^\s*(\d+)\.\s*$/

/**
 * Extract question number, question text, and option lines from a table row
 * where cell1 = "N.", cell2 = [question text paragraphs] + [nested options table].
 * Returns null if the row doesn't match this pattern.
 */
export function extractQuestionRowFromNestedTable(
  row: PMNode
): { qNum: string; qText: string; optionLines: string[] } | null {
  const rowContent = (row as PMNode)?.content
  const cells = Array.isArray(rowContent) ? rowContent : []
  if (cells.length < 2) return null
  const cell1 = cells[0] as PMNode
  const cell2 = cells[1] as PMNode
  const cell1Text = nodeToText(cell1).trim()
  const qNumMatch = QUESTION_NUMBER_RE.exec(cell1Text)
  if (!qNumMatch) return null

  const cell2Content = Array.isArray(cell2?.content) ? cell2.content : []
  let qText = ''
  let nestedTable: PMNode | null = null
  for (const child of cell2Content) {
    const c = child as PMNode
    if (c?.type === 'table') {
      nestedTable = c
      break
    }
    if (c?.type === 'paragraph') {
      const t = nodeToText(c).trim()
      if (t.length > 0) qText += (qText ? ' ' : '') + t
    }
  }
  if (!nestedTable) return null

  const nestedRows = Array.isArray(nestedTable.content)
    ? (nestedTable.content as PMNode[]).map((r) => {
        const rContent = (r as PMNode)?.content
        const rowCells = Array.isArray(rContent) ? rContent : []
        return rowCells.map((cell) => nodeToText(cell).trim())
      })
    : []
  if (!isOptionsTable(nestedRows)) return null

  const optionLines = extractOptionLinesFromTable(nestedRows)
  return { qNum: qNumMatch[1] ?? '', qText: qText.trim(), optionLines }
}

/**
 * Returns true if the table is a "question table": each row has 2 cells,
 * cell1 = question number (1. 2. etc.), cell2 contains question text + nested options table.
 */
export function isQuestionTableWithNestedOptions(tableNode: PMNode): boolean {
  const rows = Array.isArray(tableNode.content) ? tableNode.content : []
  if (rows.length === 0) return false
  return rows.every((row) => extractQuestionRowFromNestedTable(row as PMNode) !== null)
}

/**
 * Returns true if the table looks like an options table: 2-6 rows, each with
 * a label (A. B. C. or a) b) c) etc.) and option text (in same or adjacent cell).
 */
export function isOptionsTable(rows: string[][]): boolean {
  if (rows.length < 2 || rows.length > 6) return false
  for (const row of rows) {
    const hasLabelOrCombined = row.some(
      (cell) =>
        OPTION_LABEL_RE.test(cell.trim()) ||
        OPTION_LABEL_WITH_TEXT_RE.test(cell.trim())
    )
    if (!hasLabelOrCombined) return false
  }
  return true
}

/**
 * Extract option lines from an options table. Supports label and text in
 * separate cells or combined (e.g. "A. $180"). Returns lines like "A) option text".
 */
export function extractOptionLinesFromTable(rows: string[][]): string[] {
  const lines: string[] = []
  for (const row of rows) {
    let labelChar = ''
    let textCell = ''
    for (const cell of row) {
      const trimmed = cell.trim()
      const combined = OPTION_LABEL_WITH_TEXT_RE.exec(trimmed)
      if (combined) {
        labelChar = (combined[1] ?? '').toUpperCase()
        textCell = (combined[2] ?? '').trim()
        break
      }
      const labelOnly = OPTION_LABEL_RE.exec(trimmed)
      if (labelOnly) {
        labelChar = (labelOnly[1] ?? '').toUpperCase()
      } else if (trimmed.length > 0) {
        textCell = trimmed
      }
    }
    if (labelChar && textCell) {
      lines.push(`${labelChar}) ${textCell}`)
    }
  }
  return lines
}

type CollectState = {
  prefixForNextLine?: string
  /** When true (Verbal Reasoning), detect nested question tables and emit structured lines. */
  detectNestedQuestionTables?: boolean
}

function collectLogicalLinesFromNode(
  node: PMNode,
  lines: string[],
  state?: CollectState
): void {
  if (!node) return
  const st = state ?? {}

  if (node.type === 'image') {
    const text = nodeToText(node).trim()
    if (text.length > 0) {
      lines.push((st.prefixForNextLine ?? '') + text)
      st.prefixForNextLine = undefined
    }
    return
  }

  if (node.type === 'table') {
    const rows = Array.isArray(node.content) ? node.content : []
    if (st.detectNestedQuestionTables) {
      for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r] as PMNode
        const extracted = extractQuestionRowFromNestedTable(row)
        if (extracted) {
          const { qNum, qText, optionLines } = extracted
          lines.push((st.prefixForNextLine ?? '') + `${qNum}.`)
          st.prefixForNextLine = undefined
          if (qText.length > 0) lines.push(qText)
          for (const opt of optionLines) lines.push(opt)
          continue
        }
        const cells = Array.isArray(row?.content) ? row.content : []
        const cell1Text = (cells[0] ? nodeToText(cells[0] as PMNode).trim() : '')
        const cell2Text = (cells[1] ? nodeToText(cells[1] as PMNode).trim() : '')
        if (cell1Text.length === 0 && cell2Text.length > 0) {
          lines.push((st.prefixForNextLine ?? '') + cell2Text)
          st.prefixForNextLine = undefined
        }
      }
      return
    }
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r]
      const cells = Array.isArray(row?.content) ? row.content : []
      for (const cell of cells) {
        const text = nodeToText(cell).trim()
        if (text.length > 0) {
          lines.push((st.prefixForNextLine ?? '') + text)
          st.prefixForNextLine = undefined
        }
      }
    }
    return
  }

  if (node.type === 'orderedList') {
    const items = Array.isArray(node.content) ? node.content : []
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item) continue
      st.prefixForNextLine = `${i + 1}. `
      collectLogicalLinesFromNode(item, lines, st)
    }
    return
  }

  if (node.type === 'paragraph') {
    const text = nodeToText(node).trim()
    if (text.length > 0) {
      lines.push((st.prefixForNextLine ?? '') + text)
      st.prefixForNextLine = undefined
    }
    return
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectLogicalLinesFromNode(child, lines, st)
    }
  }
}

export type CollectLogicalLinesOptions = {
  /** When true (Verbal Reasoning), detect nested question tables and emit structured lines. */
  detectNestedQuestionTables?: boolean
}

/**
 * Extract logical lines from a ProseMirror JSON document (paragraphs and table cells).
 * Used by both Verbal Reasoning and Decision Making.
 */
export function collectLogicalLinesFromDoc(
  doc: Json | null | undefined,
  options?: CollectLogicalLinesOptions
): string[] {
  if (!doc || typeof doc !== 'object') return []
  const root = doc as PMNode
  const lines: string[] = []
  const state: CollectState = {
    detectNestedQuestionTables: options?.detectNestedQuestionTables,
  }

  if (root.type === 'doc' && Array.isArray(root.content)) {
    for (const child of root.content) {
      collectLogicalLinesFromNode(child, lines, state)
    }
  } else {
    collectLogicalLinesFromNode(root, lines, state)
  }

  return lines
}

export type QuantitativeReasoningDocBlocks = {
  logicalLines: string[]
  tableMap: Map<string, Json>
}

let tablePlaceholderCounter = 0

function collectBlocksFromNodeForQR(
  node: PMNode,
  lines: string[],
  tableMap: Map<string, Json>,
  state?: CollectState
): void {
  if (!node) return
  const st = state ?? {}

  if (node.type === 'image') {
    const text = nodeToText(node).trim()
    if (text.length > 0) {
      lines.push((st.prefixForNextLine ?? '') + text)
      st.prefixForNextLine = undefined
    }
    return
  }

  if (node.type === 'table') {
    if (isQuestionTableWithNestedOptions(node)) {
      const tableRows = Array.isArray(node.content) ? node.content : []
      for (let i = 0; i < tableRows.length; i += 1) {
        const row = tableRows[i] as PMNode
        const extracted = extractQuestionRowFromNestedTable(row)
        if (!extracted) continue
        const { qNum, qText, optionLines } = extracted
        lines.push((st.prefixForNextLine ?? '') + `${qNum}.`)
        st.prefixForNextLine = undefined
        if (qText.length > 0) lines.push(qText)
        for (const opt of optionLines) lines.push(opt)
      }
      return
    }

    const rows = Array.isArray(node.content)
      ? (node.content as PMNode[]).map((row) => {
          const rowContent = (row as PMNode)?.content
          const cells = Array.isArray(rowContent) ? rowContent : []
          return cells.map((cell) => nodeToText(cell).trim())
        })
      : []
    if (isOptionsTable(rows)) {
      const optionLines = extractOptionLinesFromTable(rows)
      for (let i = 0; i < optionLines.length; i += 1) {
        const line = optionLines[i] ?? ''
        if (i === 0 && st.prefixForNextLine) {
          lines.push(st.prefixForNextLine + line)
          st.prefixForNextLine = undefined
        } else {
          lines.push(line)
        }
      }
      return
    }
    const id = `t${(tablePlaceholderCounter += 1)}`
    tableMap.set(id, node as unknown as Json)
    lines.push((st.prefixForNextLine ?? '') + `[[TABLE:${id}]]`)
    st.prefixForNextLine = undefined
    return
  }

  if (node.type === 'orderedList') {
    const items = Array.isArray(node.content) ? node.content : []
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item) continue
      st.prefixForNextLine = `${i + 1}. `
      collectBlocksFromNodeForQR(item, lines, tableMap, st)
    }
    return
  }

  if (node.type === 'paragraph') {
    const text = nodeToText(node).trim()
    if (text.length > 0) {
      lines.push((st.prefixForNextLine ?? '') + text)
      st.prefixForNextLine = undefined
    }
    return
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectBlocksFromNodeForQR(child, lines, tableMap, st)
    }
  }
}

/**
 * Extract logical lines from a ProseMirror document while preserving tables as placeholders.
 * Used by Quantitative Reasoning where tables and images must be preserved in the output.
 */
export function collectBlocksFromDocForQuantitativeReasoning(
  doc: Json | null | undefined
): QuantitativeReasoningDocBlocks {
  tablePlaceholderCounter = 0
  const lines: string[] = []
  const tableMap = new Map<string, Json>()

  if (!doc || typeof doc !== 'object') return { logicalLines: lines, tableMap }

  const root = doc as PMNode

  if (root.type === 'doc' && Array.isArray(root.content)) {
    for (const child of root.content) {
      collectBlocksFromNodeForQR(child, lines, tableMap)
    }
  } else {
    collectBlocksFromNodeForQR(root, lines, tableMap)
  }

  return { logicalLines: lines, tableMap }
}

type QuestionMatch = {
  numberRaw: string
  number: number | null
  inlineText: string
  isInline: boolean
}

function getQuestionMatch(
  line: string,
  qRe: ReturnType<typeof buildQuestionRegexes>,
  questionNumberOnOwnLine: boolean
): QuestionMatch | null {
  const inlineQuestionMatch = qRe.inline.exec(line)
  const numberOnlyMatch = qRe.numberOnly.exec(line)
  const isQuestionLine =
    !!numberOnlyMatch || (!questionNumberOnOwnLine && !!inlineQuestionMatch)

  if (!isQuestionLine) return null

  const numberRaw =
    inlineQuestionMatch != null ? inlineQuestionMatch[1] ?? '' : numberOnlyMatch?.[1] ?? ''
  const number = Number.parseInt(numberRaw, 10)
  return {
    numberRaw,
    number: Number.isNaN(number) ? null : number,
    inlineText: inlineQuestionMatch?.[2] ?? '',
    isInline: inlineQuestionMatch != null,
  }
}

function isPlausibleQuestionNumber(
  questionNumber: number | null,
  lastQuestionNumber: number | null,
  enforceSequential: boolean
): boolean {
  if (!enforceSequential || questionNumber == null) return true
  if (questionNumber < 1 || questionNumber > 300) return false
  if (lastQuestionNumber == null) return true
  return questionNumber === lastQuestionNumber + 1 || questionNumber === 1
}

function hasNearbyAnswerOptionEvidence(
  rawLines: string[],
  startIdx: number,
  config: ParserConfig,
  qRe: ReturnType<typeof buildQuestionRegexes>,
  oRe: ReturnType<typeof buildOptionRegexes>
): boolean {
  const questionNumberOnOwnLine = config.questionNumberOnOwnLine === true
  const answerOptionOnOwnLine = config.answerOptionOnOwnLine === true
  const limit = config.questionLookaheadLimit ?? DEFAULT_CONFIG.questionLookaheadLimit ?? 24
  let nonBlankCount = 0
  let unlabelledCount = 0

  for (let i = startIdx + 1; i < rawLines.length && nonBlankCount < limit; i += 1) {
    const candidate = rawLines[i] ?? ''
    if (isBlank(candidate)) continue
    nonBlankCount += 1

    if (getQuestionMatch(candidate, qRe, questionNumberOnOwnLine)) {
      return false
    }

    const inlineOptionMatch = oRe.inline.exec(candidate)
    const labelOnlyMatch = oRe.labelOnly.exec(candidate)
    if (answerOptionOnOwnLine ? !!labelOnlyMatch : !!(inlineOptionMatch || labelOnlyMatch)) {
      return true
    }

    unlabelledCount += 1
    if (config.acceptSyllogismOptions && unlabelledCount >= 5) {
      return true
    }
  }

  return false
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
  let lastQuestionNumber: number | null = null

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

    const questionNumberOnOwnLine = config.questionNumberOnOwnLine === true
    const answerOptionOnOwnLine = config.answerOptionOnOwnLine === true
    const questionMatch = getQuestionMatch(line, qRe, questionNumberOnOwnLine)
    const isQuestionLine =
      questionMatch != null &&
      isPlausibleQuestionNumber(
        questionMatch.number,
        lastQuestionNumber,
        config.enforceSequentialQuestionNumbers !== false
      ) &&
      hasNearbyAnswerOptionEvidence(rawLines, idx, config, qRe, oRe)
    const inlineOptionMatch = oRe.inline.exec(line)
    const labelOnlyMatch = oRe.labelOnly.exec(line)

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

      const questionNumber = questionMatch.number
      lastQuestionNumber = questionNumber

      currentQuestion = { number: questionNumber, text: '', options: [] }
      questionTextLines = []
      currentOption = null
      currentOptionLines = []
      haveSeenOptionForCurrentQuestion = false

      if (questionNumberOnOwnLine) {
        expectingQuestionTextLine = true
      } else if (questionMatch.isInline && questionMatch.inlineText) {
        questionTextLines.push(questionMatch.inlineText)
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

export function mergeConsecutiveStemsWithSameText(stems: ParsedStem[]): ParsedStem[] {
  const merged: ParsedStem[] = []

  for (const stem of stems) {
    const previous = merged[merged.length - 1]
    if (
      previous &&
      normaliseStructuralText(previous.stemText) === normaliseStructuralText(stem.stemText)
    ) {
      previous.questions.push(...stem.questions)
      continue
    }
    merged.push({
      stemText: stem.stemText,
      questions: [...stem.questions],
    })
  }

  return merged
}

/** Per logical line, how the bulk-import line parser classifies it for live preview. */
export type ParseLineHighlightRole = 'stem' | 'question' | 'option' | 'none'

/**
 * Classify each raw line the same way {@link parseFromLines} consumes it, for syntax highlighting
 * in the bulk-import “parser view”. Must stay aligned with {@link parseFromLines}.
 */
export function classifyParseLineRoles(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParseLineHighlightRole[] {
  const roles: ParseLineHighlightRole[] = Array.from({ length: rawLines.length }, () => 'none')
  const config: ParserConfig = { ...DEFAULT_CONFIG, ...configOverrides }
  const qRe = buildQuestionRegexes(config.questionIndicator ?? 'dot')
  const oRe = buildOptionRegexes(config.answerOptionIndicator ?? 'paren')

  let stemLines: string[] = []
  let questions: ParsedQuestion[] = []
  let currentQuestion: ParsedQuestion | null = null
  let questionTextLines: string[] = []
  let questionTextSources: number[] = []
  let currentOption: ParsedOption | null = null
  let currentOptionLines: string[] = []
  let haveSeenOptionForCurrentQuestion = false
  let expectingOptionTextLine = false
  let expectingQuestionTextLine = false
  let lastQuestionNumber: number | null = null

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
    questionTextSources = []
    haveSeenOptionForCurrentQuestion = false
  }

  const finaliseStem = (): void => {
    let stemText = normaliseTextBlock(stemLines, config)
    stemText = stemText.replace(/\n{2,}/g, '\n').trim()
    if (stemText === '' && questions.length === 0) return
    stemLines = []
    questions = []
  }

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const line = rawLines[idx] ?? ''
    const trimmed = line.trim()

    if (expectingOptionTextLine && currentOption && currentQuestion) {
      roles[idx] = 'option'
      currentOptionLines = [line]
      flushCurrentOption()
      haveSeenOptionForCurrentQuestion = true
      expectingOptionTextLine = false
      continue
    }

    const questionNumberOnOwnLine = config.questionNumberOnOwnLine === true
    const answerOptionOnOwnLine = config.answerOptionOnOwnLine === true
    const questionMatch = getQuestionMatch(line, qRe, questionNumberOnOwnLine)
    const isQuestionLine =
      questionMatch != null &&
      isPlausibleQuestionNumber(
        questionMatch.number,
        lastQuestionNumber,
        config.enforceSequentialQuestionNumbers !== false
      ) &&
      hasNearbyAnswerOptionEvidence(rawLines, idx, config, qRe, oRe)
    const inlineOptionMatch = oRe.inline.exec(line)
    const labelOnlyMatch = oRe.labelOnly.exec(line)

    if (expectingQuestionTextLine && currentQuestion) {
      if (!isBlank(trimmed)) {
        if (labelOnlyMatch || (inlineOptionMatch && !answerOptionOnOwnLine)) {
          expectingQuestionTextLine = false
        } else {
          roles[idx] = 'question'
          questionTextLines.push(line)
          questionTextSources.push(idx)
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
      roles[idx] = 'question'

      const questionNumber = questionMatch.number
      lastQuestionNumber = questionNumber

      currentQuestion = { number: questionNumber, text: '', options: [] }
      questionTextLines = []
      questionTextSources = []
      currentOption = null
      currentOptionLines = []
      haveSeenOptionForCurrentQuestion = false

      if (questionNumberOnOwnLine) {
        expectingQuestionTextLine = true
      } else if (questionMatch.isInline && questionMatch.inlineText) {
        questionTextLines.push(questionMatch.inlineText)
        questionTextSources.push(idx)
      }
      continue
    }

    const isOptionLine =
      (answerOptionOnOwnLine ? !!labelOnlyMatch : !!(inlineOptionMatch || labelOnlyMatch)) &&
      currentQuestion

    if (isOptionLine) {
      roles[idx] = 'option'
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
      roles[idx] = 'stem'
      stemLines.push(line)
      continue
    }

    if (currentQuestion && !haveSeenOptionForCurrentQuestion) {
      roles[idx] = 'question'
      questionTextLines.push(line)
      questionTextSources.push(idx)
      if (config.acceptSyllogismOptions && questionTextLines.length >= 5) {
        const nonBlankIndices: number[] = []
        for (let i = questionTextLines.length - 1; i >= 0 && nonBlankIndices.length < 5; i -= 1) {
          if (!isBlank(questionTextLines[i] ?? '')) nonBlankIndices.push(i)
        }
        if (nonBlankIndices.length === 5) {
          const last5NonBlank = nonBlankIndices.reverse() as [number, number, number, number, number]
          const firstIdx = last5NonBlank[0]
          const allNonOption = last5NonBlank.every((i) => {
            const l = questionTextLines[i] ?? ''
            return !oRe.inline.test(l) && !oRe.labelOnly.test(l)
          })
          if (allNonOption && firstIdx > 0) {
            const optionTexts = last5NonBlank.map((i) => questionTextLines[i] ?? '')
            for (const qi of last5NonBlank) {
              const src = questionTextSources[qi]
              if (src !== undefined) roles[src] = 'option'
            }
            questionTextLines.splice(firstIdx, questionTextLines.length - firstIdx)
            questionTextSources.splice(firstIdx, questionTextSources.length - firstIdx)
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
      roles[idx] = 'stem'
      stemLines.push(line)
    }
  }

  flushCurrentQuestion()
  finaliseStem()

  return roles
}
