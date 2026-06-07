import type { Json } from '@altitutor/shared'
import { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'

export type StemSplitMode = 'line_breaks' | 'stem_numbers' | 'keyword'

export type StemSplitOptions = {
  mode: StemSplitMode
  /** Consecutive blank lines (whitespace-only counts) before a new stem. Default 2. */
  lineBreakThreshold: number
  /** Keyword prefix for keyword mode, e.g. "Prompt" or "Stem". */
  keywordPrefix: string
}

export const DEFAULT_STEM_SPLIT_OPTIONS: StemSplitOptions = {
  mode: 'line_breaks',
  lineBreakThreshold: 2,
  keywordPrefix: 'Prompt',
}

export type SplitStemDocumentResult = {
  stems: string[]
  warnings: string[]
  /** Logical line indices where a new stem begins (for in-editor markers). */
  splitLineIndices: number[]
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildKeywordMarkerRegex(prefix: string): RegExp {
  const escaped = escapeRegex(prefix.trim())
  return new RegExp(`^\\s*${escaped}\\s+(\\d+)\\b[\\s:.\\-]*(.*)$`, 'i')
}

function buildStemNumberMarkerRegex(): RegExp {
  return /^\s*(\d+)([.)])\s*(.*)$/
}

function splitByLineBreaks(
  lines: string[],
  threshold: number
): { blocks: string[][]; splitLineIndices: number[]; warnings: string[] } {
  const blocks: string[][] = []
  const splitLineIndices: number[] = []
  const warnings: string[] = []
  let current: string[] = []
  let consecutiveBlank = 0
  let hasSplit = false

  const flush = (): void => {
    const text = current.join('\n').trim()
    if (text.length > 0) blocks.push([...current])
    current = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (isBlankLine(line)) {
      consecutiveBlank += 1
      if (consecutiveBlank >= threshold && current.some((l) => l.trim().length > 0)) {
        flush()
        hasSplit = true
        splitLineIndices.push(i - threshold + 1)
        consecutiveBlank = 0
        continue
      }
      current.push(line)
      continue
    }
    consecutiveBlank = 0
    current.push(line)
  }
  flush()

  if (blocks.length === 0 && lines.some((l) => l.trim().length > 0)) {
    blocks.push(lines.filter((l) => l.trim().length > 0))
    warnings.push('Only 1 stem detected. Adjust line-break threshold or split mode if you expected more.')
  } else if (!hasSplit && blocks.length === 1) {
    warnings.push('Only 1 stem detected. Adjust line-break threshold or split mode if you expected more.')
  }

  return { blocks, splitLineIndices, warnings }
}

function splitByMarkers(
  lines: string[],
  isMarker: (line: string) => { isMarker: boolean; remainder: string }
): { blocks: string[][]; splitLineIndices: number[]; warnings: string[] } {
  const blocks: string[][] = []
  const splitLineIndices: number[] = []
  const warnings: string[] = []
  let current: string[] = []
  let hasSeenFirstMarker = false

  const flush = (allowPreMarker = false): void => {
    const text = current.join('\n').trim()
    if (text.length > 0 && (hasSeenFirstMarker || allowPreMarker)) {
      blocks.push([...current])
    }
    current = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const marker = isMarker(line)
    if (marker.isMarker) {
      if (!hasSeenFirstMarker) {
        hasSeenFirstMarker = true
        flush(false)
      } else {
        flush(true)
      }
      splitLineIndices.push(i)
      if (marker.remainder.length > 0) current.push(marker.remainder)
      continue
    }
    if (hasSeenFirstMarker) current.push(line)
  }
  flush(true)

  if (!hasSeenFirstMarker && lines.some((l) => l.trim().length > 0)) {
    warnings.push('No stem markers found. Content before the first marker is discarded.')
    return { blocks: [], splitLineIndices, warnings }
  }

  if (blocks.length === 0) {
    warnings.push('No stems detected. Check your split settings and document formatting.')
  }

  const leadingDiscarded = lines.findIndex((l) => isMarker(l).isMarker)
  if (leadingDiscarded > 0) {
    warnings.push(`${leadingDiscarded} line(s) before the first marker were ignored.`)
  }

  return { blocks, splitLineIndices, warnings }
}

function blocksToStemTexts(blocks: string[][]): string[] {
  return blocks
    .map((block) => block.join('\n').trim())
    .filter((text) => text.length > 0)
}

export function splitStemDocumentLines(
  lines: string[],
  options: StemSplitOptions
): SplitStemDocumentResult {
  const threshold = Math.max(1, options.lineBreakThreshold)

  if (options.mode === 'line_breaks') {
    const { blocks, splitLineIndices, warnings } = splitByLineBreaks(lines, threshold)
    return {
      stems: blocksToStemTexts(blocks),
      warnings,
      splitLineIndices,
    }
  }

  if (options.mode === 'stem_numbers') {
    const keywordRe = buildStemNumberMarkerRegex()
    const { blocks, splitLineIndices, warnings } = splitByMarkers(lines, (line) => {
      const match = keywordRe.exec(line.trim())
      if (!match) return { isMarker: false, remainder: '' }
      return { isMarker: true, remainder: (match[3] ?? '').trim() }
    })
    return { stems: blocksToStemTexts(blocks), warnings, splitLineIndices }
  }

  const prefix = options.keywordPrefix.trim()
  if (prefix.length === 0) {
    return {
      stems: [],
      warnings: ['Enter a keyword prefix to split stems.'],
      splitLineIndices: [],
    }
  }

  const keywordRe = buildKeywordMarkerRegex(prefix)
  const { blocks, splitLineIndices, warnings } = splitByMarkers(lines, (line) => {
    const match = keywordRe.exec(line.trim())
    if (!match) return { isMarker: false, remainder: '' }
    return { isMarker: true, remainder: (match[2] ?? '').trim() }
  })
  return { stems: blocksToStemTexts(blocks), warnings, splitLineIndices }
}

export function splitStemDocumentFromDoc(
  doc: Json | null | undefined,
  options: StemSplitOptions
): SplitStemDocumentResult {
  const lines = collectLogicalLinesFromDoc(doc, { detectNestedQuestionTables: false })
  return splitStemDocumentLines(lines, options)
}

const PROMPT_LIKE_RE = /^\s*prompt\s+\d+\b/i
const STEM_NUMBER_LINE_RE = /^\s*\d+[\.)]\s*$/

/** Heuristic: pasted question doc may contain stem/passage content by mistake. */
export function detectStemLikeContentInQuestionPaste(lines: string[]): boolean {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (PROMPT_LIKE_RE.test(trimmed)) return true
    if (STEM_NUMBER_LINE_RE.test(trimmed)) return true
  }
  return false
}
