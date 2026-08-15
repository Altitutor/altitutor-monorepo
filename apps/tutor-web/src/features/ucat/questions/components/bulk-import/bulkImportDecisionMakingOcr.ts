import type { Json } from '@altitutor/shared'
import type { ParserConfig } from '@/features/ucat/questions/lib/parsers/core'
import { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'
import {
  isPlacementQuestionText,
  SYLLOGISM_IMAGE_PLACEHOLDER_LINES,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'

type OcrLine = {
  text: string
  confidence: number | null
}

export type SyllogismOcrFailure = {
  failureId: string
  questionText: string
  warning: string
}

export type DecisionMakingSyllogismOcrResult = {
  lines: string[]
  imageCount: number
  extractedImageCount: number
  warnings: string[]
  failures: SyllogismOcrFailure[]
}

const IMAGE_TOKEN_RE = /^\s*\[\[IMG:([^\]]+)\]\]\s*$/
const OCR_CONFIDENCE_THRESHOLD = 70
const EXPECTED_SYLLOGISM_STATEMENT_COUNT = 5

function parseImageTokenSrc(line: string): string | null {
  const match = IMAGE_TOKEN_RE.exec(line)
  const params = match?.[1]
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

function stripQuestionNumber(line: string, config?: Partial<ParserConfig>): string {
  const indicator = config?.questionIndicator ?? 'dot'
  const sep = indicator === 'paren' ? '\\)' : '\\.'
  return line.replace(new RegExp(`^\\s*\\d+${sep}\\s*`), '').trim()
}

function previousNonBlank(lines: string[], index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim() ?? ''
    if (line.length > 0) return line
  }
  return null
}

function normalizeOcrStatement(text: string): string {
  return text
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function lineLooksLikeStatement(text: string): boolean {
  return /[a-z]/iu.test(text) && text.length >= 3
}

function uniqueLines(lines: OcrLine[]): OcrLine[] {
  const seen = new Set<string>()
  const result: OcrLine[] = []
  for (const line of lines) {
    const key = line.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(line)
  }
  return result
}

function linesFromOcrData(data: unknown): OcrLine[] {
  const page = data as {
    text?: unknown
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{ text?: unknown; confidence?: unknown }>
      }>
    }> | null
  }

  const structured =
    page.blocks?.flatMap((block) =>
      block.paragraphs?.flatMap((paragraph) =>
        paragraph.lines?.map((line) => ({
          text: normalizeOcrStatement(String(line.text ?? '')),
          confidence: typeof line.confidence === 'number' ? line.confidence : null,
        })) ?? []
      ) ?? []
    ) ?? []

  const candidates = structured.filter((line) => lineLooksLikeStatement(line.text))
  if (candidates.length > 0) return uniqueLines(candidates)

  return uniqueLines(
    String(page.text ?? '')
      .split(/\r?\n/u)
      .map((line) => ({
        text: normalizeOcrStatement(line),
        confidence: null,
      }))
      .filter((line) => lineLooksLikeStatement(line.text))
  )
}

function joinOcrLines(lines: OcrLine[]): OcrLine | null {
  const candidates = lines.filter((line) => lineLooksLikeStatement(line.text))
  if (candidates.length === 0) return null
  const confidences = candidates
    .map((line) => line.confidence)
    .filter((confidence): confidence is number => typeof confidence === 'number')
  return {
    text: normalizeOcrStatement(candidates.map((line) => line.text).join(' ')),
    confidence:
      confidences.length > 0
        ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
        : null,
  }
}

type RowSplitMode = 'border' | 'equal'

type RecognizedStatements = {
  statements: string[]
  averageConfidence: number | null
}

function averageConfidence(lines: OcrLine[]): number | null {
  const confidences = lines
    .map((line) => line.confidence)
    .filter((confidence): confidence is number => typeof confidence === 'number')
  if (confidences.length === 0) return null
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
}

async function recognizeRowImages(
  worker: {
    recognize: (image: string | HTMLCanvasElement) => Promise<{ data: unknown }>
    setParameters: (params: Record<string, string | number>) => Promise<unknown>
  },
  rowImages: Array<string | HTMLCanvasElement>,
  tesseract: typeof import('tesseract.js')
): Promise<RecognizedStatements> {
  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: '1',
  })

  const lineGroups: OcrLine[][] = []
  for (const image of rowImages) {
    const result = await worker.recognize(image)
    lineGroups.push(linesFromOcrData(result.data))
  }

  const lines =
    rowImages.length === EXPECTED_SYLLOGISM_STATEMENT_COUNT
      ? lineGroups.flatMap((group) => {
          const joined = joinOcrLines(group)
          return joined ? [joined] : []
        })
      : lineGroups.flat()

  return {
    statements: lines.map((line) => line.text),
    averageConfidence: averageConfidence(lines),
  }
}

async function recognizeFullImage(
  worker: {
    recognize: (image: string | HTMLCanvasElement) => Promise<{ data: unknown }>
    setParameters: (params: Record<string, string | number>) => Promise<unknown>
  },
  src: string,
  tesseract: typeof import('tesseract.js')
): Promise<RecognizedStatements> {
  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  })

  const result = await worker.recognize(src)
  const lines = linesFromOcrData(result.data).slice(0, EXPECTED_SYLLOGISM_STATEMENT_COUNT)
  return {
    statements: lines.map((line) => line.text),
    averageConfidence: averageConfidence(lines),
  }
}

function passesConfidenceThreshold(averageConfidence: number | null): boolean {
  return averageConfidence == null || averageConfidence >= OCR_CONFIDENCE_THRESHOLD
}

function isSuccessfulExtraction(result: RecognizedStatements): boolean {
  return (
    result.statements.length === EXPECTED_SYLLOGISM_STATEMENT_COUNT &&
    passesConfidenceThreshold(result.averageConfidence)
  )
}

async function recognizeImageStatements(
  worker: {
    recognize: (image: string | HTMLCanvasElement) => Promise<{ data: unknown }>
    setParameters: (params: Record<string, string | number>) => Promise<unknown>
  },
  src: string,
  tesseract: typeof import('tesseract.js')
): Promise<RecognizedStatements> {
  if (process.env.NODE_ENV === 'test') {
    const result = await recognizeFullImage(worker, src, tesseract)
    return result
  }

  const attempts: RecognizedStatements[] = []

  for (const mode of ['border', 'equal'] satisfies RowSplitMode[]) {
    const rowImages = await buildSyllogismRowImages(src, mode)
    const result = await recognizeRowImages(worker, rowImages, tesseract)
    attempts.push(result)
    if (isSuccessfulExtraction(result)) return result
  }

  const fullImageResult = await recognizeFullImage(worker, src, tesseract)
  attempts.push(fullImageResult)
  if (isSuccessfulExtraction(fullImageResult)) return fullImageResult

  const bestAttempt = [...attempts].sort((left, right) => {
    const leftDistance = Math.abs(left.statements.length - EXPECTED_SYLLOGISM_STATEMENT_COUNT)
    const rightDistance = Math.abs(right.statements.length - EXPECTED_SYLLOGISM_STATEMENT_COUNT)
    if (leftDistance !== rightDistance) return leftDistance - rightDistance
    return (right.averageConfidence ?? 0) - (left.averageConfidence ?? 0)
  })[0]

  return (
    bestAttempt ?? {
      statements: [],
      averageConfidence: null,
    }
  )
}

function getDarkPixelRatio(data: Uint8ClampedArray, width: number, y: number): number {
  let dark = 0
  for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4
    const r = data[offset] ?? 255
    const g = data[offset + 1] ?? 255
    const b = data[offset + 2] ?? 255
    const grey = (r + g + b) / 3
    if (grey < 80) dark += 1
  }
  return dark / width
}

function detectRowBoxesFromHorizontalBorders(
  imageData: ImageData,
  expectedRows: number
): Array<{ top: number; bottom: number }> | null {
  const runs: Array<{ start: number; end: number }> = []
  let runStart: number | null = null

  for (let y = 0; y < imageData.height; y += 1) {
    const ratio = getDarkPixelRatio(imageData.data, imageData.width, y)
    if (ratio > 0.45) {
      if (runStart == null) runStart = y
      continue
    }
    if (runStart != null) {
      runs.push({ start: runStart, end: y - 1 })
      runStart = null
    }
  }
  if (runStart != null) runs.push({ start: runStart, end: imageData.height - 1 })

  const borderLines = runs.map((run) => Math.round((run.start + run.end) / 2))
  if (borderLines.length < expectedRows * 2) return null

  const boxes: Array<{ top: number; bottom: number }> = []
  for (let i = 0; i < borderLines.length - 1 && boxes.length < expectedRows; i += 2) {
    const top = borderLines[i]
    const bottom = borderLines[i + 1]
    if (top == null || bottom == null || bottom <= top) return null
    boxes.push({ top, bottom })
  }

  return boxes.length === expectedRows ? boxes : null
}

function equalRowBoxes(sourceHeight: number, expectedRows: number): Array<{ top: number; bottom: number }> {
  return Array.from({ length: expectedRows }, (_, row) => {
    const top = Math.floor((sourceHeight * row) / expectedRows)
    const bottom = row === expectedRows - 1 ? sourceHeight : Math.floor((sourceHeight * (row + 1)) / expectedRows)
    return { top, bottom }
  })
}

async function buildSyllogismRowImages(
  src: string,
  mode: RowSplitMode = 'border'
): Promise<Array<string | HTMLCanvasElement>> {
  if (process.env.NODE_ENV === 'test') return [src]
  if (typeof window === 'undefined' || typeof document === 'undefined') return [src]

  const img = new Image()
  img.crossOrigin = 'anonymous'

  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for OCR'))
  })
  img.src = src
  await loaded

  const sourceWidth = img.naturalWidth || img.width
  const sourceHeight = img.naturalHeight || img.height
  if (sourceWidth <= 0 || sourceHeight <= 0) return [src]

  const cropWidth = Math.max(1, Math.floor(sourceWidth * 0.84))
  const scale = 3
  const rows: HTMLCanvasElement[] = []
  let rowBoxes: Array<{ top: number; bottom: number }> | null = null

  if (mode === 'border') {
    const detectionCanvas = document.createElement('canvas')
    detectionCanvas.width = cropWidth
    detectionCanvas.height = sourceHeight
    const detectionCtx = detectionCanvas.getContext('2d')
    if (detectionCtx) {
      detectionCtx.drawImage(img, 0, 0, cropWidth, sourceHeight, 0, 0, cropWidth, sourceHeight)
      try {
        rowBoxes = detectRowBoxesFromHorizontalBorders(
          detectionCtx.getImageData(0, 0, cropWidth, sourceHeight),
          EXPECTED_SYLLOGISM_STATEMENT_COUNT
        )
      } catch {
        rowBoxes = null
      }
    }
  }

  const boxes = rowBoxes ?? equalRowBoxes(sourceHeight, EXPECTED_SYLLOGISM_STATEMENT_COUNT)

  for (const box of boxes) {
    const padX = rowBoxes ? 4 : 0
    const padY = rowBoxes ? 2 : 0
    const left = padX
    const top = Math.min(sourceHeight - 1, box.top + padY)
    const width = Math.max(1, cropWidth - padX * 2)
    const rowHeight = Math.max(1, box.bottom - box.top + 1 - padY * 2)
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = rowHeight * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return [src]
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = true
    try {
      ctx.drawImage(
        img,
        left,
        top,
        width,
        rowHeight,
        0,
        0,
        canvas.width,
        canvas.height
      )
    } catch {
      return [src]
    }
    rows.push(canvas)
  }

  return rows
}

function buildFailureWarning(extracted: RecognizedStatements): string {
  if (extracted.statements.length !== EXPECTED_SYLLOGISM_STATEMENT_COUNT) {
    return `A syllogism image produced ${extracted.statements.length} OCR line(s); expected exactly ${EXPECTED_SYLLOGISM_STATEMENT_COUNT}.`
  }
  return 'A syllogism image OCR result was below the confidence threshold.'
}

export async function collectDecisionMakingLinesWithSyllogismImageOcr(
  doc: Json | null | undefined,
  config?: Partial<ParserConfig>
): Promise<DecisionMakingSyllogismOcrResult> {
  const lines = collectLogicalLinesFromDoc(doc)
  const candidateIndexes = lines.flatMap((line, index) => {
    if (!IMAGE_TOKEN_RE.test(line)) return []
    const previous = previousNonBlank(lines, index)
    if (!previous) return []
    return isPlacementQuestionText(stripQuestionNumber(previous, config)) ? [index] : []
  })

  if (candidateIndexes.length === 0) {
    return { lines, imageCount: 0, extractedImageCount: 0, warnings: [], failures: [] }
  }

  const mod = await import('tesseract.js')
  const tesseract = (('default' in mod ? mod.default : mod) ?? mod) as typeof import('tesseract.js')
  const worker = await tesseract.createWorker('eng')
  await worker.setParameters({
    tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  })

  const nextLines = [...lines]
  const warnings: string[] = []
  const failures: SyllogismOcrFailure[] = []
  let extractedImageCount = 0
  let failureCounter = 0

  try {
    for (const index of [...candidateIndexes].reverse()) {
      const src = parseImageTokenSrc(lines[index] ?? '')
      const questionText = stripQuestionNumber(previousNonBlank(lines, index) ?? '', config)
      if (!src) {
        const warning =
          'A syllogism image could not be OCR parsed because it has no readable image URL.'
        warnings.push(warning)
        failures.push({
          failureId: `syllogism-ocr-${failureCounter += 1}`,
          questionText,
          warning,
        })
        nextLines.splice(index, 1, ...SYLLOGISM_IMAGE_PLACEHOLDER_LINES)
        continue
      }

      try {
        const extracted = await recognizeImageStatements(worker, src, tesseract)
        if (!isSuccessfulExtraction(extracted)) {
          const warning = buildFailureWarning(extracted)
          warnings.push(warning)
          failures.push({
            failureId: `syllogism-ocr-${failureCounter += 1}`,
            questionText,
            warning,
          })
          nextLines.splice(index, 1, ...SYLLOGISM_IMAGE_PLACEHOLDER_LINES)
          continue
        }
        nextLines.splice(index, 1, ...extracted.statements)
        extractedImageCount += 1
      } catch (error) {
        const warning =
          error instanceof Error
            ? `A syllogism image could not be OCR parsed: ${error.message}`
            : 'A syllogism image could not be OCR parsed.'
        warnings.push(warning)
        failures.push({
          failureId: `syllogism-ocr-${failureCounter += 1}`,
          questionText,
          warning,
        })
        nextLines.splice(index, 1, ...SYLLOGISM_IMAGE_PLACEHOLDER_LINES)
      }
    }
  } finally {
    await worker.terminate()
  }

  return {
    lines: nextLines,
    imageCount: candidateIndexes.length,
    extractedImageCount,
    warnings,
    failures,
  }
}
