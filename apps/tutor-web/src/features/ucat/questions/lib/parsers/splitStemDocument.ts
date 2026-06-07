import type { Json } from '@altitutor/shared'
import { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'

export type StemSplitMode = 'line_breaks' | 'stem_numbers' | 'keyword'

export type StemNumberIndicator = 'dot' | 'paren'

export type StemSplitOptions = {
  mode: StemSplitMode
  /** Consecutive blank lines (whitespace-only counts) before a new stem. Default 2. */
  lineBreakThreshold: number
  /** Keyword prefix for keyword mode, e.g. "Prompt" or "Stem". */
  keywordPrefix: string
  /** Stem number marker style for stem_numbers mode. */
  stemNumberIndicator: StemNumberIndicator
}

export const DEFAULT_STEM_SPLIT_OPTIONS: StemSplitOptions = {
  mode: 'line_breaks',
  lineBreakThreshold: 2,
  keywordPrefix: 'Prompt',
  stemNumberIndicator: 'dot',
}

export type StemSplitDiscardLineSpan = {
  lineIndex: number
  start: number
  end: number
}

export type SplitStemDocumentResult = {
  stems: string[]
  warnings: string[]
  /** Logical line indices where a new stem begins (for in-editor markers). */
  splitLineIndices: number[]
  /** Entire logical lines omitted from imported stem text. */
  discardedLineIndices: number[]
  /** Prefix spans within a line omitted from imported stem text (e.g. keyword markers). */
  discardedLineSpans: StemSplitDiscardLineSpan[]
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

function buildStemNumberMarkerRegex(indicator: StemNumberIndicator): RegExp {
  const suffix = indicator === 'dot' ? '\\.' : '\\)'
  return new RegExp(`^\\s*(\\d+)${suffix}\\s*(.*)$`)
}

type MarkerParseResult = {
  isMarker: boolean
  remainder: string
  discardStart: number
  discardEnd: number
}

function parseMarkerLine(line: string, re: RegExp): MarkerParseResult {
  const trimmed = line.trim()
  const match = re.exec(trimmed)
  if (!match) {
    return { isMarker: false, remainder: '', discardStart: 0, discardEnd: 0 }
  }
  const remainder = (match[2] ?? '').trim()
  const leading = line.length - line.trimStart().length
  const remainderRaw = match[2] ?? ''
  const discardEndInTrimmed = trimmed.length - remainderRaw.length
  return {
    isMarker: true,
    remainder,
    discardStart: leading,
    discardEnd: leading + discardEndInTrimmed,
  }
}

function recordMarkerDiscard(
  lineIndex: number,
  line: string,
  marker: MarkerParseResult,
  discardedLineIndices: number[],
  discardedLineSpans: StemSplitDiscardLineSpan[]
): void {
  if (!marker.isMarker) return
  if (marker.remainder.length === 0) {
    discardedLineIndices.push(lineIndex)
    return
  }
  if (marker.discardEnd > marker.discardStart) {
    discardedLineSpans.push({
      lineIndex,
      start: marker.discardStart,
      end: marker.discardEnd,
    })
  }
}

function splitByLineBreaks(
  lines: string[],
  threshold: number
): {
  blocks: string[][]
  splitLineIndices: number[]
  warnings: string[]
  discardedLineIndices: number[]
  discardedLineSpans: StemSplitDiscardLineSpan[]
} {
  const blocks: string[][] = []
  const splitLineIndices: number[] = []
  const warnings: string[] = []
  const discardedLineIndices: number[] = []
  const discardedLineSpans: StemSplitDiscardLineSpan[] = []
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
        for (let j = i - threshold + 1; j <= i; j += 1) {
          if (isBlankLine(lines[j] ?? '')) discardedLineIndices.push(j)
        }
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

  return { blocks, splitLineIndices, warnings, discardedLineIndices, discardedLineSpans }
}

function splitByMarkers(
  lines: string[],
  isMarker: (line: string) => MarkerParseResult
): {
  blocks: string[][]
  splitLineIndices: number[]
  warnings: string[]
  discardedLineIndices: number[]
  discardedLineSpans: StemSplitDiscardLineSpan[]
} {
  const blocks: string[][] = []
  const splitLineIndices: number[] = []
  const warnings: string[] = []
  const discardedLineIndices: number[] = []
  const discardedLineSpans: StemSplitDiscardLineSpan[] = []
  let current: string[] = []
  let hasSeenFirstMarker = false
  let firstMarkerIndex = -1

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
      if (firstMarkerIndex < 0) firstMarkerIndex = i
      if (!hasSeenFirstMarker) {
        hasSeenFirstMarker = true
        flush(false)
      } else {
        flush(true)
      }
      splitLineIndices.push(i)
      recordMarkerDiscard(i, line, marker, discardedLineIndices, discardedLineSpans)
      if (marker.remainder.length > 0) current.push(marker.remainder)
      continue
    }
    if (hasSeenFirstMarker) current.push(line)
  }
  flush(true)

  if (firstMarkerIndex > 0) {
    for (let i = 0; i < firstMarkerIndex; i += 1) {
      discardedLineIndices.push(i)
    }
  }

  if (!hasSeenFirstMarker && lines.some((l) => l.trim().length > 0)) {
    warnings.push('No stem markers found. Content before the first marker is discarded.')
    return {
      blocks: [],
      splitLineIndices,
      warnings,
      discardedLineIndices: lines.map((_, index) => index),
      discardedLineSpans,
    }
  }

  if (blocks.length === 0) {
    warnings.push('No stems detected. Check your split settings and document formatting.')
  }

  if (firstMarkerIndex > 0) {
    warnings.push(`${firstMarkerIndex} line(s) before the first marker were ignored.`)
  }

  return { blocks, splitLineIndices, warnings, discardedLineIndices, discardedLineSpans }
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
  const resolved = { ...DEFAULT_STEM_SPLIT_OPTIONS, ...options }
  const threshold = Math.max(1, resolved.lineBreakThreshold)

  const emptyDiscards = {
    discardedLineIndices: [] as number[],
    discardedLineSpans: [] as StemSplitDiscardLineSpan[],
  }

  if (resolved.mode === 'line_breaks') {
    const { blocks, splitLineIndices, warnings, discardedLineIndices, discardedLineSpans } =
      splitByLineBreaks(lines, threshold)
    return {
      stems: blocksToStemTexts(blocks),
      warnings,
      splitLineIndices,
      discardedLineIndices,
      discardedLineSpans,
    }
  }

  if (resolved.mode === 'stem_numbers') {
    const stemNumberRe = buildStemNumberMarkerRegex(resolved.stemNumberIndicator)
    const { blocks, splitLineIndices, warnings, discardedLineIndices, discardedLineSpans } =
      splitByMarkers(lines, (line) => parseMarkerLine(line, stemNumberRe))
    return {
      stems: blocksToStemTexts(blocks),
      warnings,
      splitLineIndices,
      discardedLineIndices,
      discardedLineSpans,
    }
  }

  const prefix = resolved.keywordPrefix.trim()
  if (prefix.length === 0) {
    return {
      stems: [],
      warnings: ['Enter a keyword prefix to split stems.'],
      splitLineIndices: [],
      ...emptyDiscards,
    }
  }

  const keywordRe = buildKeywordMarkerRegex(prefix)
  const { blocks, splitLineIndices, warnings, discardedLineIndices, discardedLineSpans } =
    splitByMarkers(lines, (line) => parseMarkerLine(line, keywordRe))
  return {
    stems: blocksToStemTexts(blocks),
    warnings,
    splitLineIndices,
    discardedLineIndices,
    discardedLineSpans,
  }
}

export function splitStemDocumentFromDoc(
  doc: Json | null | undefined,
  options: StemSplitOptions
): SplitStemDocumentResult {
  const lines = collectLogicalLinesFromDoc(doc, {
    detectNestedQuestionTables: false,
    preserveBlankLines: true,
  })
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
