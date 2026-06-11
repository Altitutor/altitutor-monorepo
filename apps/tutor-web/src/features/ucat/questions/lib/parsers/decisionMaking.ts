import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirror,
  tokenizedPlainTextToProseMirrorWithLineBreaks,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
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

const SYLLOGISM_IMAGE_PLACEHOLDER_LINES = [
  '[Syllogism image statement 1 pending OCR]',
  '[Syllogism image statement 2 pending OCR]',
  '[Syllogism image statement 3 pending OCR]',
  '[Syllogism image statement 4 pending OCR]',
  '[Syllogism image statement 5 pending OCR]',
]

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

export function normalizeDecisionMakingSyllogismLines(
  rawLines: string[],
  config: Partial<ParserConfig>,
  options?: { imageTokenMode?: 'preserve' | 'placeholder' }
): string[] {
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
  configOverrides?: Partial<ParserConfig>
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
  configOverrides?: Partial<ParserConfig>
): ParsedDecisionMakingStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc)
  return parseDecisionMakingFromLines(logicalLines, configOverrides)
}

export function parseDecisionMakingPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
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
  | 'Drawing Conclusions'
  | 'Probabilistic and Statistical Reasoning'
  | 'Logical Puzzles'

/**
 * Get Decision Making category name from stem content.
 * Rules applied in order: Syllogisms, Recognising Assumptions, Venn Diagrams,
 * Drawing Conclusions, Probabilistic and Statistical Reasoning, Logical Puzzles.
 */
export function getDecisionMakingStemCategoryName(
  stem: ParsedDecisionMakingStem
): DecisionMakingCategoryName {
  const stemLower = stem.stemText.toLowerCase()
  const hasDiagramInStem = stemLower.includes('diagram')
  const hasProbabilityInStem = stemLower.includes('probability')

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
    if (qLower.includes('concluded') || qLower.includes('conclusion')) {
      return 'Drawing Conclusions'
    }
  }

  if (hasProbabilityInStem) {
    return 'Probabilistic and Statistical Reasoning'
  }
  for (const q of stem.questions) {
    if (q.text.toLowerCase().includes('probability')) {
      return 'Probabilistic and Statistical Reasoning'
    }
  }

  return 'Logical Puzzles'
}

export type DecisionMakingToFormOptions = {
  sectionId: string
  categoryId?: string | null
  getCategoryIdForStem?: (stem: ParsedDecisionMakingStem) => string | null
  isPrivate?: boolean
}

/**
 * Map parsed Decision Making stems to UcatQuestionStemFormValues.
 * Each question gets questionType from isSyllogismQuestionText.
 */
export function mapParsedDecisionMakingToFormValues(
  stems: ParsedDecisionMakingStem[],
  options: DecisionMakingToFormOptions
): UcatQuestionStemFormValues[] {
  const { sectionId, categoryId = null, getCategoryIdForStem, isPrivate = false } = options

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
        tagIds: [],
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
        isPrivate,
        questions,
      }
    })
}
