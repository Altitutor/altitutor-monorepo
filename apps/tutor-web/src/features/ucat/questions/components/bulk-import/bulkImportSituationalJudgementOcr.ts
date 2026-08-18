import type { Json } from '@altitutor/shared'
import type { ParserConfig } from '@/features/ucat/questions/lib/parsers/core'
import { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'

type OcrLine = {
  text?: unknown
  confidence?: unknown
  bbox?: {
    x0?: unknown
    x1?: unknown
    y0?: unknown
    y1?: unknown
  } | null
}

type OcrParagraph = {
  text?: unknown
  confidence?: unknown
  lines?: OcrLine[] | null
}

export type RecognizedParagraph = {
  text: string
  confidence: number | null
}

export type SituationalJudgementScreenshotOcrResult = {
  lines: string[]
  imageCount: number
  extractedImageCount: number
  warnings: string[]
}

const IMAGE_TOKEN_RE = /^\s*\[\[IMG:([^\]]+)\]\]\s*$/
const OCR_CONFIDENCE_THRESHOLD = 70
const UNREADABLE_CHROME_CONFIDENCE_THRESHOLD = 25

function parseImageTokenSrc(line: string): string | null {
  const params = IMAGE_TOKEN_RE.exec(line)?.[1]
  if (!params) return null

  for (const part of params.split(';')) {
    const [key, rawValue] = part.split('=')
    if (key !== 's' || !rawValue) continue
    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }
  return null
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/[|]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function normalizeProbe(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function averageConfidence(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number')
  if (present.length === 0) return null
  return present.reduce((sum, value) => sum + value, 0) / present.length
}

function paragraphFromOcr(paragraph: OcrParagraph): RecognizedParagraph | null {
  const lines = paragraph.lines ?? []
  const text = normalizeText(paragraph.text) || normalizeText(lines.map((line) => line.text).join(' '))
  if (!text) return null
  const lineConfidences = lines.map((line) =>
    typeof line.confidence === 'number' ? line.confidence : null
  )
  const confidence =
    typeof paragraph.confidence === 'number'
      ? paragraph.confidence
      : averageConfidence(lineConfidences)
  return { text, confidence }
}

function paragraphsFromOcrParagraph(paragraph: OcrParagraph): RecognizedParagraph[] {
  const lines = (paragraph.lines ?? []).flatMap((line) => {
    const text = normalizeText(line.text)
    const y0 = typeof line.bbox?.y0 === 'number' ? line.bbox.y0 : null
    const y1 = typeof line.bbox?.y1 === 'number' ? line.bbox.y1 : null
    if (!text || y0 == null || y1 == null || y1 <= y0) return []
    return [{
      text,
      confidence: typeof line.confidence === 'number' ? line.confidence : null,
      y0,
      y1,
    }]
  })
  if (lines.length < 2) {
    const recognized = paragraphFromOcr(paragraph)
    return recognized ? [recognized] : []
  }

  const heights = lines.map((line) => line.y1 - line.y0).sort((a, b) => a - b)
  const medianLineHeight = heights[Math.floor(heights.length / 2)] ?? 0
  const paragraphGap = Math.max(8, medianLineHeight * 0.75)
  const groups: typeof lines[] = []
  for (const line of lines) {
    const group = groups.at(-1)
    const previous = group?.at(-1)
    if (!group || !previous || line.y0 - previous.y1 > paragraphGap) {
      groups.push([line])
    } else {
      group.push(line)
    }
  }

  return groups.map((group) => ({
    text: normalizeText(group.map((line) => line.text).join(' ')),
    confidence: averageConfidence(group.map((line) => line.confidence)),
  }))
}

function paragraphsFromPositionedOcrLines(paragraphs: OcrParagraph[]): RecognizedParagraph[] | null {
  const rawLines = paragraphs.flatMap((paragraph) => paragraph.lines ?? [])
  const nonEmptyLines = rawLines.filter((line) => normalizeText(line.text))
  const lines = nonEmptyLines.flatMap((line) => {
    const x0 = typeof line.bbox?.x0 === 'number' ? line.bbox.x0 : null
    const x1 = typeof line.bbox?.x1 === 'number' ? line.bbox.x1 : null
    const y0 = typeof line.bbox?.y0 === 'number' ? line.bbox.y0 : null
    const y1 = typeof line.bbox?.y1 === 'number' ? line.bbox.y1 : null
    if (x0 == null || x1 == null || y0 == null || y1 == null || x1 <= x0 || y1 <= y0) {
      return []
    }
    return [{
      text: normalizeText(line.text),
      confidence: typeof line.confidence === 'number' ? line.confidence : null,
      x0,
      x1,
      y0,
      y1,
    }]
  })
  if (lines.length === 0 || lines.length !== nonEmptyLines.length) return null

  const visualRows: Array<{ lines: typeof lines; y0: number; y1: number }> = []
  for (const line of [...lines].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    const row = visualRows.at(-1)
    const overlap = row ? Math.min(row.y1, line.y1) - Math.max(row.y0, line.y0) : 0
    const minimumHeight = row ? Math.min(row.y1 - row.y0, line.y1 - line.y0) : 0
    if (row && overlap >= minimumHeight * 0.5) {
      row.lines.push(line)
      row.y0 = Math.min(row.y0, line.y0)
      row.y1 = Math.max(row.y1, line.y1)
    } else {
      visualRows.push({ lines: [line], y0: line.y0, y1: line.y1 })
    }
  }

  const rows = visualRows.map((row) => ({
    text: normalizeText(
      row.lines
        .sort((a, b) => a.x0 - b.x0)
        .map((line) => line.text)
        .join(' ')
    ),
    confidence: averageConfidence(row.lines.map((line) => line.confidence)),
    y0: row.y0,
    y1: row.y1,
  }))
  const heights = rows.map((row) => row.y1 - row.y0).sort((a, b) => a - b)
  const medianLineHeight = heights[Math.floor(heights.length / 2)] ?? 0
  const paragraphGap = Math.max(8, medianLineHeight * 0.75)
  const groups: typeof rows[] = []
  for (const row of rows) {
    const group = groups.at(-1)
    const previous = group?.at(-1)
    if (!group || !previous || row.y0 - previous.y1 > paragraphGap) {
      groups.push([row])
    } else {
      group.push(row)
    }
  }

  return groups.map((group) => ({
    text: normalizeText(group.map((row) => row.text).join(' ')),
    confidence: averageConfidence(group.map((row) => row.confidence)),
  }))
}

function paragraphsFromOcrData(data: unknown): RecognizedParagraph[] {
  const page = data as {
    text?: unknown
    blocks?: Array<{ paragraphs?: OcrParagraph[] | null }> | null
  }
  const ocrParagraphs = page.blocks?.flatMap((block) => block.paragraphs ?? []) ?? []
  const positioned = paragraphsFromPositionedOcrLines(ocrParagraphs)
  if (positioned && positioned.length > 0) return positioned

  const structured = ocrParagraphs.flatMap(paragraphsFromOcrParagraph)
  if (structured.length > 0) return structured

  return String(page.text ?? '')
    .split(/\r?\n/gu)
    .map((text) => ({ text: normalizeText(text), confidence: null }))
    .filter((paragraph) => paragraph.text.length > 0)
}

function isPairedMostLeastDirective(text: string): boolean {
  const probe = normalizeProbe(text)
  const hasLeastAction =
    /\bleast appropriate\b/u.test(probe) ||
    /\bleast(?:\s+[a-z0-9]+){0,3}\s+action\b/u.test(probe)
  return (
    /\b(?:choose|select|place|drag)\b/u.test(probe) &&
    /\bmost appropriate\b/u.test(probe) &&
    hasLeastAction
  )
}

function normalizePairedMostLeastDirective(text: string): string {
  if (/\bleast appropriate\b/iu.test(text)) return text
  return text.replace(
    /\bleast(?:\s+[a-z0-9]+){0,3}\s+action\b/iu,
    'least appropriate action'
  )
}

function isScreenshotChrome(text: string): boolean {
  const probe = normalizeProbe(text)
  return (
    probe === 'most appropriate' ||
    probe === 'least appropriate' ||
    probe.startsWith('you will not receive any marks for this question')
  )
}

function isScreenshotChromeParagraph(paragraph: RecognizedParagraph): boolean {
  return (
    isScreenshotChrome(paragraph.text) ||
    (paragraph.confidence != null &&
      paragraph.confidence < UNREADABLE_CHROME_CONFIDENCE_THRESHOLD)
  )
}

export function extractSituationalJudgementScreenshotLines(
  paragraphs: RecognizedParagraph[],
  config?: Partial<ParserConfig>
): string[] | null {
  const directiveIndex = paragraphs.findIndex((paragraph) =>
    isPairedMostLeastDirective(paragraph.text)
  )
  if (directiveIndex <= 0) return null

  const stem = paragraphs
    .slice(0, directiveIndex)
    .filter((paragraph) => !isScreenshotChromeParagraph(paragraph))
    .map((paragraph) => paragraph.text)
    .join(' ')
    .trim()
  const directive = normalizePairedMostLeastDirective(
    paragraphs[directiveIndex]?.text.trim() ?? ''
  )
  const actions = paragraphs
    .slice(directiveIndex + 1)
    .filter((paragraph) => !isScreenshotChromeParagraph(paragraph))
    .map((paragraph) => paragraph.text)
    .filter(Boolean)

  if (!stem || !directive || actions.length !== 3) return null

  const relevantConfidence = averageConfidence([
    ...paragraphs.slice(0, directiveIndex + 1).map((paragraph) => paragraph.confidence),
    ...paragraphs.slice(directiveIndex + 1)
      .filter((paragraph) => !isScreenshotChromeParagraph(paragraph))
      .map((paragraph) => paragraph.confidence),
  ])
  if (relevantConfidence != null && relevantConfidence < OCR_CONFIDENCE_THRESHOLD) return null

  const questionSeparator = config?.questionIndicator === 'paren' ? ')' : '.'
  const optionSeparator = config?.answerOptionIndicator === 'paren' ? ')' : '.'
  return [
    stem,
    `1${questionSeparator} ${directive}`,
    ...actions.map((action, index) =>
      `${String.fromCharCode(97 + index)}${optionSeparator} ${action}`
    ),
  ]
}

export async function collectSituationalJudgementLinesWithScreenshotOcr(
  doc: Json | null | undefined,
  config?: Partial<ParserConfig>
): Promise<SituationalJudgementScreenshotOcrResult> {
  const lines = collectLogicalLinesFromDoc(doc, { detectNestedQuestionTables: true })
  const imageIndexes = lines.flatMap((line, index) => (IMAGE_TOKEN_RE.test(line) ? [index] : []))
  if (imageIndexes.length === 0) {
    return { lines, imageCount: 0, extractedImageCount: 0, warnings: [] }
  }

  const mod = await import('tesseract.js')
  const tesseract = (('default' in mod ? mod.default : mod) ?? mod) as typeof import('tesseract.js')
  const worker = await tesseract.createWorker('eng')
  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.AUTO,
    preserve_interword_spaces: '1',
  })

  const nextLines = [...lines]
  const warnings: string[] = []
  let extractedImageCount = 0

  try {
    for (const index of [...imageIndexes].reverse()) {
      const src = parseImageTokenSrc(lines[index] ?? '')
      if (!src) continue
      try {
        const result = await worker.recognize(src, {}, { text: true, blocks: true })
        const paragraphs = paragraphsFromOcrData(result.data)
        const replacement = extractSituationalJudgementScreenshotLines(paragraphs, config)
        if (replacement) {
          nextLines.splice(index, 1, ...replacement)
          extractedImageCount += 1
          continue
        }
        if (paragraphs.some((paragraph) => isPairedMostLeastDirective(paragraph.text))) {
          warnings.push(
            'An SJ Most/Least screenshot was detected, but OCR did not recover one stem and exactly three actions with sufficient confidence.'
          )
        }
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `An SJ image could not be OCR parsed: ${error.message}`
            : 'An SJ image could not be OCR parsed.'
        )
      }
    }
  } finally {
    await worker.terminate()
  }

  return {
    lines: nextLines,
    imageCount: imageIndexes.length,
    extractedImageCount,
    warnings,
  }
}
