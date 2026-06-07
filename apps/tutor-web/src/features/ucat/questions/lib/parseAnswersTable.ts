/**
 * Parses a pasted table of answers (correct option letter + explanation) from plain text
 * or HTML. Used in bulk import to fill Correct and Answer explanation for each question.
 *
 * Supports:
 * - First row optional headers (e.g. "Answer" | "Explanation" or "Answer" \t "Explanation")
 * - Rows: [question #] \t [A-E] \t [explanation]  OR  [A-E] \t [explanation]
 * - Plain text: cells separated by tab, rows by newline
 * - HTML: <table> with <tr> and <td> (e.g. paste from Word/Google Docs)
 */

export type ParsedAnswerRow = {
  letter: string
  explanation: string
}

export type AnswerFieldSeparator = 'tab' | 'comma' | 'semicolon' | 'pipe'

export type AnswerParseOptions = {
  fieldSeparator?: AnswerFieldSeparator
}

export const DEFAULT_ANSWER_FIELD_SEPARATOR: AnswerFieldSeparator = 'tab'

export function answerFieldSeparatorChar(separator: AnswerFieldSeparator = DEFAULT_ANSWER_FIELD_SEPARATOR): string {
  switch (separator) {
    case 'comma':
      return ','
    case 'semicolon':
      return ';'
    case 'pipe':
      return '|'
    default:
      return '\t'
  }
}

function resolveFieldSeparator(options?: AnswerParseOptions): AnswerFieldSeparator {
  return options?.fieldSeparator ?? DEFAULT_ANSWER_FIELD_SEPARATOR
}

function textUsesFieldSeparator(text: string, separator: AnswerFieldSeparator): boolean {
  return text.includes(answerFieldSeparatorChar(separator))
}

function splitAnswerLine(line: string, separator: AnswerFieldSeparator): string[] {
  const delim = answerFieldSeparatorChar(separator)
  if (separator === 'tab') {
    return line.split(/\t/).map((c) => c.trim())
  }
  return line.split(delim).map((c) => c.trim())
}

function extractRowsFromDelimitedText(text: string, separator: AnswerFieldSeparator): string[][] {
  return text
    .trim()
    .split(/\r\n|\n|\r/)
    .map((line) => splitAnswerLine(line, separator))
    .filter((cells) => cells.some((c) => c.length > 0))
}

function extractAnswerRowsFromInput(input: string, options?: AnswerParseOptions): string[][] {
  const separator = resolveFieldSeparator(options)
  const raw = input.trim()
  if (!raw.length) return []

  if (raw.startsWith('<') && raw.includes('<table')) {
    return extractRowsFromHtml(raw)
  }
  if (!textUsesFieldSeparator(raw, separator)) {
    return parseLooseAnswerRowsFromText(raw)
  }
  return extractRowsFromDelimitedText(raw, separator)
}

const HEADER_LIKE = /^(answer|explanation|correct|#|number|no\.?)$/i
const OPTION_LETTER = /^[A-Ea-e]$/
const QUESTION_NUMBER_LINE = /^\s*(?:q(?:uestion)?\s*)?(\d{1,3})[\.\)]?\s*$/i
const INLINE_ANSWER_LINE =
  /^\s*(?:q(?:uestion)?\s*)?(\d{1,3})[\.\)]?\s+([A-Ea-e])(?:[\.\)]|\b)\s*(.*)$/i

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false
  const trimmed = cells.map((c) => c.trim().toLowerCase())
  return trimmed.every((c) => c === '' || HEADER_LIKE.test(c) || /^answer|explanation|correct/.test(c))
}

function parseRowToAnswer(cells: string[], joinChar = '\t'): ParsedAnswerRow | null {
  const trimmed = cells.map((c) => c.trim())
  if (trimmed.length >= 3) {
    const [first, second, ...rest] = trimmed
    const num = first ? Number.parseInt(first, 10) : NaN
    if (!Number.isNaN(num) && num >= 1 && num <= 999) {
      const letter = (second ?? '').charAt(0).toUpperCase()
      const explanation = rest.join(joinChar).trim()
      if (OPTION_LETTER.test(letter)) return { letter, explanation }
      return null
    }
    if (OPTION_LETTER.test((first ?? '').charAt(0))) {
      return {
        letter: (first ?? '').charAt(0).toUpperCase(),
        explanation: trimmed.slice(2).join(joinChar).trim() || (trimmed[1] ?? ''),
      }
    }
  }
  if (trimmed.length >= 2) {
    const letter = (trimmed[0] ?? '').charAt(0).toUpperCase()
    const explanation = trimmed.slice(1).join(joinChar).trim()
    if (OPTION_LETTER.test(letter)) return { letter, explanation }
  }
  return null
}

function isIgnorableLooseAnswerLine(line: string): boolean {
  const normalised = line.trim().toLowerCase().replace(/\s+/g, ' ')
  return (
    normalised.length === 0 ||
    normalised === 'answer' ||
    normalised === 'answers' ||
    normalised === 'correct answer' ||
    normalised === 'correct answers' ||
    normalised === 'explanation' ||
    normalised === 'explanations' ||
    normalised === 'solution' ||
    normalised === 'solutions' ||
    normalised === '* solutions'
  )
}

function isLooseQuestionNumberLine(line: string): number | null {
  const match = QUESTION_NUMBER_LINE.exec(line)
  if (!match) return null
  const parsed = Number.parseInt(match[1] ?? '', 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 999) return null
  return parsed
}

function isLooseLetterLine(line: string): string | null {
  const trimmed = line.trim()
  if (!OPTION_LETTER.test(trimmed)) return null
  return trimmed.toUpperCase()
}

function parseLooseAnswerRowsFromText(text: string): string[][] {
  const lines = text
    .trim()
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => !isIgnorableLooseAnswerLine(line))

  const rows: string[][] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const inline = INLINE_ANSWER_LINE.exec(line)
    if (inline) {
      const questionNumber = inline[1] ?? ''
      const letter = (inline[2] ?? '').toUpperCase()
      const explanationLines: string[] = []
      const rest = (inline[3] ?? '').trim()
      if (rest.length > 0) explanationLines.push(rest)
      i += 1
      while (i < lines.length) {
        const next = lines[i] ?? ''
        if (INLINE_ANSWER_LINE.test(next)) break
        const nextNumber = isLooseQuestionNumberLine(next)
        const followingLetter = i + 1 < lines.length ? isLooseLetterLine(lines[i + 1] ?? '') : null
        if (nextNumber != null && followingLetter) break
        explanationLines.push(next)
        i += 1
      }
      rows.push([questionNumber, letter, explanationLines.join('\n').trim()])
      continue
    }

    const questionNumber = isLooseQuestionNumberLine(line)
    const letter = i + 1 < lines.length ? isLooseLetterLine(lines[i + 1] ?? '') : null
    if (questionNumber != null && letter) {
      i += 2
      const explanationLines: string[] = []
      while (i < lines.length) {
        const next = lines[i] ?? ''
        if (INLINE_ANSWER_LINE.test(next)) break
        const nextNumber = isLooseQuestionNumberLine(next)
        const followingLetter = i + 1 < lines.length ? isLooseLetterLine(lines[i + 1] ?? '') : null
        if (nextNumber != null && followingLetter) break
        explanationLines.push(next)
        i += 1
      }
      rows.push([String(questionNumber), letter, explanationLines.join('\n').trim()])
      continue
    }

    i += 1
  }

  return rows
}

function extractRowsFromHtml(html: string): string[][] {
  if (typeof document === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (!table) return []
    const rows: string[][] = []
    const trs = table.querySelectorAll('tr')
    trs.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td, th')).map((el) =>
        (el.textContent ?? '').trim()
      )
      if (cells.length > 0) rows.push(cells)
    })
    return rows
  } catch {
    return []
  }
}

/**
 * Parse a pasted string (plain text TSV or HTML table) into an array of answer rows.
 * Skips a leading header row if it looks like "Answer" / "Explanation".
 */
export function parseAnswersTable(input: string, options?: AnswerParseOptions): ParsedAnswerRow[] {
  if (!input || typeof input !== 'string') return []
  const separator = resolveFieldSeparator(options)
  const joinChar = answerFieldSeparatorChar(separator)
  const rows = extractAnswerRowsFromInput(input, options)
  if (rows.length === 0) return []
  const startIndex = isHeaderRow(rows[0]) ? 1 : 0
  const result: ParsedAnswerRow[] = []
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const parsed = parseRowToAnswer(row, joinChar)
    if (parsed) result.push(parsed)
  }
  return result
}

/** Data rows after the same optional header skip as {@link parseAnswersTable}. */
export function getAnswersTableDataRows(input: string, options?: AnswerParseOptions): string[][] {
  if (!input || typeof input !== 'string') return []
  const rows = extractAnswerRowsFromInput(input, options)
  if (rows.length === 0) return []
  const startIndex = isHeaderRow(rows[0]) ? 1 : 0
  return rows.slice(startIndex)
}

export type AnswerPasteQuestionCoverage = {
  sortKey: number
  label: string
  hasAnswer: boolean
  hasQuestionExplanation: boolean
  hasOptionExplanations: boolean
}

export type AnswersPasteAnalysis = {
  /** Rows parsed as A–E answer letters (same rows as {@link parseAnswersTable}). */
  totalMcqAnswerRows: number
  /** Decision Making syllogism lines: question # + Y/N + optional explanation. */
  totalSyllogismTokenRows: number
  /** Question-level explanation cells (single MCQ row per question with non-empty explanation). */
  totalQuestionExplanations: number
  /** Option-level explanation cells (syllogism per-option text, or rare multi-row MCQ). */
  totalOptionExplanations: number
  coverage: AnswerPasteQuestionCoverage[]
}

function leadingQuestionNumberCell(cells: string[]): number | null {
  const trimmed = cells.map((c) => c.trim())
  if (trimmed.length < 2) return null
  const num = Number.parseInt(trimmed[0] ?? '', 10)
  if (!Number.isNaN(num) && num >= 1 && num <= 999) return num
  return null
}

function isYnToken(s: string): boolean {
  return /^\s*(y|ye|yes|n|no)\s*$/i.test(s)
}

/**
 * Structural stats + per-question coverage for the pasted answers sheet (TSV / HTML table).
 * Groups rows by leading question number when present; otherwise assigns `#1`, `#2`, … in order.
 */
export function analyzeAnswersPaste(input: string, options?: AnswerParseOptions): AnswersPasteAnalysis {
  const dataRows = getAnswersTableDataRows(input, options)
  const joinChar = answerFieldSeparatorChar(resolveFieldSeparator(options))
  let seq = 0

  type Group = {
    sortKey: number
    label: string
    mcqRows: ParsedAnswerRow[]
    syllogismExplanations: string[]
  }

  const groups = new Map<string, Group>()

  const getGroup = (cells: string[]): Group => {
    const q = leadingQuestionNumberCell(cells)
    if (q != null) {
      const key = `q:${q}`
      let g = groups.get(key)
      if (!g) {
        g = { sortKey: q, label: `Q${q}`, mcqRows: [], syllogismExplanations: [] }
        groups.set(key, g)
      }
      return g
    }
    seq += 1
    const key = `seq:${seq}`
    const g: Group = {
      sortKey: 10_000 + seq,
      label: `#${seq}`,
      mcqRows: [],
      syllogismExplanations: [],
    }
    groups.set(key, g)
    return g
  }

  let syllogismTokenRows = 0

  for (const cells of dataRows) {
    const mcq = parseRowToAnswer(cells, joinChar)
    if (mcq) {
      getGroup(cells).mcqRows.push(mcq)
      continue
    }

    const t = cells.map((c) => c.trim())
    if (t.length >= 3) {
      const num = Number.parseInt(t[0] ?? '', 10)
      const tok = (t[1] ?? '').trim()
      const expl = t.slice(2).join('\t').trim()
      if (!Number.isNaN(num) && num >= 1 && num <= 999 && isYnToken(tok)) {
        getGroup(cells).syllogismExplanations.push(expl)
        syllogismTokenRows += 1
      }
    }
  }

  let totalQuestionExplanations = 0
  let totalOptionExplanations = 0
  const coverage: AnswerPasteQuestionCoverage[] = []

  for (const g of groups.values()) {
    const hasMcq = g.mcqRows.length > 0
    const hasSyl = g.syllogismExplanations.length > 0
    const hasAnswer = hasMcq || hasSyl

    let hasQuestionExplanation = false
    let hasOptionExplanations = false

    if (hasMcq && !hasSyl) {
      if (g.mcqRows.length === 1) {
        const expl = g.mcqRows[0]!.explanation.trim()
        if (expl.length > 0) {
          hasQuestionExplanation = true
          totalQuestionExplanations += 1
        }
      } else {
        const expls = g.mcqRows.map((r) => r.explanation.trim()).filter((e) => e.length > 0)
        if (expls.length > 0) {
          hasOptionExplanations = true
          totalOptionExplanations += expls.length
        }
      }
    }

    if (hasSyl) {
      const nonEmpty = g.syllogismExplanations.filter((e) => e.trim().length > 0)
      if (nonEmpty.length > 0) {
        hasOptionExplanations = true
        totalOptionExplanations += nonEmpty.length
      }
    }

    coverage.push({
      sortKey: g.sortKey,
      label: g.label,
      hasAnswer,
      hasQuestionExplanation,
      hasOptionExplanations,
    })
  }

  coverage.sort((a, b) => a.sortKey - b.sortKey)

  const totalMcqAnswerRows = dataRows.reduce(
    (acc, cells) => acc + (parseRowToAnswer(cells, joinChar) ? 1 : 0),
    0
  )

  return {
    totalMcqAnswerRows,
    totalSyllogismTokenRows: syllogismTokenRows,
    totalQuestionExplanations,
    totalOptionExplanations,
    coverage,
  }
}

/** Character spans in one pasted line (with literal tabs) for live preview. */
export type AnswerPasteSpanKind =
  | 'questionNumber'
  | 'letter'
  | 'explanation'
  | 'header'
  | 'separator'
  | 'other'

export type AnswerPasteSpan = { start: number; end: number; kind: AnswerPasteSpanKind }

/** Exported for mapping delimited line character offsets to ProseMirror positions in pasted tables. */
export function splitLineWithFieldOffsets(
  line: string,
  separator: AnswerFieldSeparator = DEFAULT_ANSWER_FIELD_SEPARATOR
): { text: string; start: number; end: number }[] {
  const delim = answerFieldSeparatorChar(separator)
  const parts = separator === 'tab' ? line.split('\t') : line.split(delim)
  const out: { text: string; start: number; end: number }[] = []
  let pos = 0
  for (let i = 0; i < parts.length; i += 1) {
    const text = parts[i] ?? ''
    const start = pos
    const end = pos + text.length
    out.push({ text, start, end })
    pos = end + (i < parts.length - 1 ? 1 : 0)
  }
  return out
}

/** @deprecated Use {@link splitLineWithFieldOffsets} */
export function splitLineWithTabOffsets(line: string): { text: string; start: number; end: number }[] {
  return splitLineWithFieldOffsets(line, 'tab')
}

/**
 * Build highlight spans for one delimited line of pasted answers (same row semantics as {@link parseAnswersTable}).
 */
export function buildAnswerPasteSpansForLine(
  line: string,
  rowKind: 'header' | 'data' | 'empty',
  options?: AnswerParseOptions
): AnswerPasteSpan[] {
  if (rowKind === 'empty' || line.length === 0) return []
  const separator = resolveFieldSeparator(options)
  const joinChar = answerFieldSeparatorChar(separator)
  const cells = splitLineWithFieldOffsets(line, separator)
  const spans: AnswerPasteSpan[] = []

  if (rowKind === 'header') {
    for (let i = 0; i < cells.length; i += 1) {
      const c = cells[i]!
      if (c.text.trim().length > 0) {
        spans.push({ start: c.start, end: c.end, kind: 'header' })
      }
      if (i < cells.length - 1) {
        const gapStart = c.end
        spans.push({ start: gapStart, end: gapStart + 1, kind: 'separator' })
      }
    }
    return spans
  }

  const cellTexts = cells.map((c) => c.text)
  const parsed = parseRowToAnswer(cellTexts, joinChar)

  const pushRange = (start: number, end: number, kind: AnswerPasteSpanKind): void => {
    if (end > start) spans.push({ start, end, kind })
  }

  if (parsed) {
    const trimmed = cellTexts.map((c) => c.trim())
    if (
      trimmed.length >= 3 &&
      trimmed[0] != null &&
      !Number.isNaN(Number.parseInt(trimmed[0], 10)) &&
      Number.parseInt(trimmed[0], 10) >= 1 &&
      Number.parseInt(trimmed[0], 10) <= 999
    ) {
      pushRange(cells[0]!.start, cells[0]!.end, 'questionNumber')
      if (cells.length > 1) {
        const gap0 = cells[0]!.end
        pushRange(gap0, gap0 + 1, 'separator')
        pushRange(cells[1]!.start, cells[1]!.end, 'letter')
      }
      if (cells.length > 2) {
        const gap1 = cells[1]!.end
        pushRange(gap1, gap1 + 1, 'separator')
        pushRange(cells[2]!.start, cells[cells.length - 1]!.end, 'explanation')
      }
      return spans
    }
    pushRange(cells[0]!.start, cells[0]!.end, 'letter')
    if (cells.length > 1) {
      const gap0 = cells[0]!.end
      pushRange(gap0, gap0 + 1, 'separator')
      pushRange(cells[1]!.start, cells[cells.length - 1]!.end, 'explanation')
    }
    return spans
  }

  const t = cellTexts.map((c) => c.trim())
  if (t.length >= 2) {
    const num = t[0] ? Number.parseInt(t[0], 10) : NaN
    if (!Number.isNaN(num) && num >= 1 && num <= 999) {
      const token = (t[1] ?? '').trim()
      const letterOk = token.length > 0 && OPTION_LETTER.test(token.charAt(0).toUpperCase())
      const ynOk = isYnToken(token)
      if (letterOk || ynOk) {
        pushRange(cells[0]!.start, cells[0]!.end, 'questionNumber')
        const gap0 = cells[0]!.end
        pushRange(gap0, gap0 + 1, 'separator')
        pushRange(cells[1]!.start, cells[1]!.end, 'letter')
        if (cells.length > 2) {
          const gap1 = cells[1]!.end
          pushRange(gap1, gap1 + 1, 'separator')
          pushRange(cells[2]!.start, cells[cells.length - 1]!.end, 'explanation')
        }
        return spans
      }
    }
  }

  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i]!
    if (c.text.length > 0) {
      spans.push({ start: c.start, end: c.end, kind: 'other' })
    }
    if (i < cells.length - 1) {
      const gapStart = c.end
      spans.push({ start: gapStart, end: gapStart + 1, kind: 'separator' })
    }
  }
  return spans
}

/** Whether the first non-empty row of a cell matrix looks like a header row. */
export function isAnswersHeaderRowCells(cells: string[]): boolean {
  return isHeaderRow(cells)
}

/**
 * Row kinds aligned to {@link getAnswerDocPlainLinesFromJson} lines (one entry per doc row).
 * Prefer this over joining lines into a string and calling {@link getAnswerTsvLineRowKinds},
 * which can disagree when a logical row embeds newline characters.
 */
export function getAnswerLineRowKindsFromLines(
  lines: readonly string[],
  options?: AnswerParseOptions
): ('header' | 'data' | 'empty')[] {
  const separator = resolveFieldSeparator(options)
  let headerLine: number | null = null
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (!line.trim()) continue
    const cells = splitAnswerLine(line, separator)
    if (isHeaderRow(cells)) headerLine = i
    break
  }
  return lines.map((line, i) => {
    if (!line.trim()) return 'empty' as const
    if (headerLine !== null && i === headerLine) return 'header' as const
    return 'data' as const
  })
}

/**
 * For each TSV line (incl. empty), whether the parser treats it as header, data, or empty
 * (same as {@link buildAnswerPasteSpansForLine} + {@link isAnswersHeaderRowCells}).
 */
export function getAnswerTsvLineRowKinds(value: string): ('header' | 'data' | 'empty')[] {
  const lines = value.split(/\r\n|\n|\r/)
  return getAnswerLineRowKindsFromLines(lines)
}

/** Convert letter A–E to option index 0–4. */
export function letterToOptionIndex(letter: string): number {
  const upper = (letter ?? '').charAt(0).toUpperCase()
  const idx = upper.charCodeAt(0) - 'A'.charCodeAt(0)
  if (idx >= 0 && idx <= 4) return idx
  return 0
}

// Accept Y / N plus common expansions like "ye", "yes", "no" (any casing, optional whitespace)
const YN_LINE = /^\s*(y|ye|yes|n|no)\s*$/i
const LETTER_LINE = /^\s*[A-Ea-e]\s*$/

function isYorN(s: string): boolean {
  return YN_LINE.test(s)
}
function isAthroughE(s: string): boolean {
  return /^\s*[A-Ea-e]\s*$/.test(s)
}

/**
 * Parse Decision Making pasted answers:
 * - Syllogism questions: 5-char Y/N pattern + optional per-option explanations
 * - Multiple choice: single letter A–E + optional question-level explanation
 *
 * Supports:
 * 1) Table rows: [question #] \t [Y/N or letter] \t [explanation...]
 * 2) Line format: question number on its own line, followed by Y/N or letter lines.
 */
export function parseDecisionMakingAnswers(
  input: string,
  questionTypes: ('syllogism' | 'multiple_choice')[],
  options?: AnswerParseOptions
): { letter?: string; pattern?: string; explanation?: string; optionExplanations?: string[] }[] {
  if (!input || typeof input !== 'string' || questionTypes.length === 0)
    return []
  const trimmed = input.trim()
  if (!trimmed.length) return []

  const separator = resolveFieldSeparator(options)
  const rows = textUsesFieldSeparator(trimmed, separator)
    ? extractRowsFromDelimitedText(trimmed, separator)
    : trimmed.split(/\r\n|\n|\r/).map((l) => [l.trim()])
  const nonEmpty = rows.filter((cells) => cells.some((c) => c.length > 0))
  if (nonEmpty.length === 0) return []

  const result: {
    letter?: string
    pattern?: string
    explanation?: string
    optionExplanations?: string[]
  }[] = []
  let rowIndex = 0
  const skipHeader = nonEmpty[0]?.length >= 2 && /^(answer|explanation|#|number|no\.?)$/i.test((nonEmpty[0]?.[0] ?? '').trim())
  if (skipHeader) rowIndex = 1

  const byQuestionTokens = new Map<number, string[]>()
  const byQuestionExplanations = new Map<number, string[]>()
  for (let i = rowIndex; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i] ?? []
    const first = (cells[0] ?? '').trim()
    const second = (cells[1] ?? '').trim()
    const num = Number.parseInt(first, 10)
    if (!Number.isNaN(num) && num >= 1 && num <= 999) {
      const token = second.length > 0 ? second : first
      const explanationText = cells.slice(2).join('\t').trim()
      if (isYorN(token) || isAthroughE(token)) {
        const letter = token.charAt(0).toUpperCase()
        const list = byQuestionTokens.get(num) ?? []
        const explList = byQuestionExplanations.get(num) ?? []
        list.push(letter)
        explList.push(explanationText)
        byQuestionTokens.set(num, list)
        byQuestionExplanations.set(num, explList)
      }
      continue
    }
    if (isYorN(first) || isAthroughE(first)) {
      const keys = Array.from(byQuestionTokens.keys()).sort((a, b) => a - b)
      const lastQ = keys[keys.length - 1]
      if (lastQ != null) {
        const letter = first.charAt(0).toUpperCase()
        const list = byQuestionTokens.get(lastQ) ?? []
        const explList = byQuestionExplanations.get(lastQ) ?? []
        const explanationText = cells.slice(1).join('\t').trim()
        list.push(letter)
        explList.push(explanationText)
        byQuestionTokens.set(lastQ, list)
        byQuestionExplanations.set(lastQ, explList)
      }
    }
  }

  const sortedQuestions = Array.from(byQuestionTokens.keys()).sort((a, b) => a - b)
  for (let i = 0; i < questionTypes.length && i < sortedQuestions.length; i++) {
    const qNum = sortedQuestions[i]
    const tokens = byQuestionTokens.get(qNum) ?? []
    const explanations = byQuestionExplanations.get(qNum) ?? []
    const type = questionTypes[i]
    if (type === 'syllogism') {
      const pairs = tokens
        .map((t, idx) => ({ token: t, explanation: explanations[idx] ?? '' }))
        .filter((p) => p.token === 'Y' || p.token === 'N')
        .slice(0, 5)
      const yn = pairs.map((p) => p.token)
      result.push({
        pattern: yn.length === 5 ? yn.join('') : undefined,
        optionExplanations: yn.length === 5 ? pairs.map((p) => p.explanation) : undefined,
      })
    } else {
      const letterIndex = tokens.findIndex((t) => /^[A-E]$/.test(t))
      if (letterIndex >= 0) {
        const letter = tokens[letterIndex]
        const explanation =
          explanations[letterIndex]?.trim() || explanations[0]?.trim() || undefined
        result.push({ letter, explanation })
      } else {
        result.push({})
      }
    }
  }

  if (result.length > 0) return result

  const lines = trimmed.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean)
  const segmentStarts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\d+$/.test(lines[i] ?? '')) segmentStarts.push(i)
  }
  for (let s = 0; s < segmentStarts.length && s < questionTypes.length; s++) {
    const start = segmentStarts[s] ?? 0
    const end = segmentStarts[s + 1] ?? lines.length
    const segmentLines = lines.slice(start + 1, end)
    const type = questionTypes[s]
    if (type === 'syllogism') {
      const pairs: { token: string; explanation: string }[] = []
      for (let i = 0; i < segmentLines.length; i += 1) {
        const ln = segmentLines[i] ?? ''
        if (YN_LINE.test(ln)) {
          const token = ln.charAt(0).toUpperCase()
          const explanationLines: string[] = []
          i += 1
          while (i < segmentLines.length && !YN_LINE.test(segmentLines[i] ?? '')) {
            const explanationLine = segmentLines[i] ?? ''
            if (explanationLine.trim().length > 0) explanationLines.push(explanationLine)
            i += 1
          }
          i -= 1
          pairs.push({ token, explanation: explanationLines.join('\n').trim() })
          if (pairs.length >= 5) break
        }
      }
      const yn = pairs.map((p) => p.token)
      result.push({
        pattern: yn.length === 5 ? yn.join('') : undefined,
        optionExplanations: yn.length === 5 ? pairs.map((p) => p.explanation) : undefined,
      })
    } else {
      let letter: string | undefined
      let explanation = ''
      for (let i = 0; i < segmentLines.length; i += 1) {
        const ln = segmentLines[i] ?? ''
        if (LETTER_LINE.test(ln)) {
          letter = (ln.charAt(0) ?? '').toUpperCase()
          explanation = segmentLines
            .slice(i + 1)
            .filter((line) => line.trim().length > 0)
            .join('\n')
            .trim()
          break
        }
      }
      result.push(letter ? { letter, explanation: explanation || undefined } : {})
    }
  }
  return result
}
