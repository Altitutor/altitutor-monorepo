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

const HEADER_LIKE = /^(answer|explanation|correct|#|number|no\.?)$/i
const OPTION_LETTER = /^[A-Ea-e]$/

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false
  const trimmed = cells.map((c) => c.trim().toLowerCase())
  return trimmed.every((c) => c === '' || HEADER_LIKE.test(c) || /^answer|explanation|correct/.test(c))
}

function parseRowToAnswer(cells: string[]): ParsedAnswerRow | null {
  const trimmed = cells.map((c) => c.trim())
  if (trimmed.length >= 3) {
    const [first, second, ...rest] = trimmed
    const num = first ? Number.parseInt(first, 10) : NaN
    if (!Number.isNaN(num) && num >= 1 && num <= 999) {
      const letter = (second ?? '').charAt(0).toUpperCase()
      const explanation = rest.join('\t').trim()
      if (OPTION_LETTER.test(letter)) return { letter, explanation }
      return null
    }
    if (OPTION_LETTER.test((first ?? '').charAt(0))) {
      return {
        letter: (first ?? '').charAt(0).toUpperCase(),
        explanation: trimmed.slice(2).join('\t').trim() || (trimmed[1] ?? ''),
      }
    }
  }
  if (trimmed.length >= 2) {
    const letter = (trimmed[0] ?? '').charAt(0).toUpperCase()
    const explanation = trimmed.slice(1).join('\t').trim()
    if (OPTION_LETTER.test(letter)) return { letter, explanation }
  }
  return null
}

function extractRowsFromPlainText(text: string): string[][] {
  const lines = text.trim().split(/\r\n|\n|\r/)
  return lines
    .map((line) => line.split(/\t/).map((c) => c.trim()))
    .filter((cells) => cells.some((c) => c.length > 0))
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
export function parseAnswersTable(input: string): ParsedAnswerRow[] {
  if (!input || typeof input !== 'string') return []
  const raw = input.trim()
  if (!raw.length) return []

  let rows: string[][]
  if (raw.startsWith('<') && raw.includes('<table')) {
    rows = extractRowsFromHtml(raw)
  } else {
    rows = extractRowsFromPlainText(raw)
  }

  if (rows.length === 0) return []
  const startIndex = isHeaderRow(rows[0]) ? 1 : 0
  const result: ParsedAnswerRow[] = []
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const parsed = parseRowToAnswer(row)
    if (parsed) result.push(parsed)
  }
  return result
}

/** Convert letter A–E to option index 0–4. */
export function letterToOptionIndex(letter: string): number {
  const upper = (letter ?? '').charAt(0).toUpperCase()
  const idx = upper.charCodeAt(0) - 'A'.charCodeAt(0)
  if (idx >= 0 && idx <= 4) return idx
  return 0
}

const YN_LINE = /^\s*[YN]\s*$/i
const LETTER_LINE = /^\s*[A-Ea-e]\s*$/

function isYorN(s: string): boolean {
  return /^\s*[YN]\s*$/i.test(s)
}
function isAthroughE(s: string): boolean {
  return /^\s*[A-Ea-e]\s*$/.test(s)
}

/**
 * Parse Decision Making pasted answers: syllogism questions get a 5-char Y/N pattern,
 * multiple choice get a single letter A–E. Supports (1) lines with question number then Y/N lines,
 * (2) table rows with col0 = question #, col1 = Y/N or letter.
 */
export function parseDecisionMakingAnswers(
  input: string,
  questionTypes: ('syllogism' | 'multiple_choice')[]
): { letter?: string; pattern?: string }[] {
  if (!input || typeof input !== 'string' || questionTypes.length === 0)
    return []
  const trimmed = input.trim()
  if (!trimmed.length) return []

  const rows = trimmed.includes('\t')
    ? extractRowsFromPlainText(trimmed)
    : trimmed.split(/\r\n|\n|\r/).map((l) => [l.trim()])
  const nonEmpty = rows.filter((cells) => cells.some((c) => c.length > 0))
  if (nonEmpty.length === 0) return []

  const result: { letter?: string; pattern?: string }[] = []
  let rowIndex = 0
  const skipHeader = nonEmpty[0]?.length >= 2 && /^(answer|explanation|#|number|no\.?)$/i.test((nonEmpty[0]?.[0] ?? '').trim())
  if (skipHeader) rowIndex = 1

  const byQuestion = new Map<number, string[]>()
  for (let i = rowIndex; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i] ?? []
    const first = (cells[0] ?? '').trim()
    const second = (cells[1] ?? '').trim()
    const num = Number.parseInt(first, 10)
    if (!Number.isNaN(num) && num >= 1 && num <= 999) {
      const token = second.length > 0 ? second : first
      if (isYorN(token) || isAthroughE(token)) {
        const list = byQuestion.get(num) ?? []
        list.push(token.charAt(0).toUpperCase())
        byQuestion.set(num, list)
      }
      continue
    }
    if (isYorN(first) || isAthroughE(first)) {
      const keys = Array.from(byQuestion.keys()).sort((a, b) => a - b)
      const lastQ = keys[keys.length - 1]
      if (lastQ != null) {
        const list = byQuestion.get(lastQ) ?? []
        list.push(first.charAt(0).toUpperCase())
        byQuestion.set(lastQ, list)
      }
    }
  }

  const sortedQuestions = Array.from(byQuestion.keys()).sort((a, b) => a - b)
  for (let i = 0; i < questionTypes.length && i < sortedQuestions.length; i++) {
    const qNum = sortedQuestions[i]
    const tokens = byQuestion.get(qNum) ?? []
    const type = questionTypes[i]
    if (type === 'syllogism') {
      const yn = tokens.filter((t) => t === 'Y' || t === 'N').slice(0, 5)
      result.push({ pattern: yn.length === 5 ? yn.join('') : undefined })
    } else {
      const letter = tokens.find((t) => /^[A-E]$/.test(t))
      result.push(letter ? { letter } : {})
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
      const yn: string[] = []
      for (const ln of segmentLines) {
        if (YN_LINE.test(ln)) {
          yn.push(ln.charAt(0).toUpperCase())
          if (yn.length >= 5) break
        }
      }
      result.push({ pattern: yn.length === 5 ? yn.join('') : undefined })
    } else {
      let letter: string | undefined
      for (const ln of segmentLines) {
        if (LETTER_LINE.test(ln)) {
          letter = (ln.charAt(0) ?? '').toUpperCase()
          break
        }
      }
      result.push(letter ? { letter } : {})
    }
  }
  return result
}

