import type { Json } from '@altitutor/shared'
import {
  plainTextToProseMirror,
  plainTextToProseMirrorWithLineBreaks,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  collectLogicalLinesFromDoc,
  parseFromLines,
  type ParsedStem,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

export type { ParsedStem, ParsedOption, ParsedQuestion } from '@/features/ucat/questions/lib/parsers/core'
export { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'

export type VerbalReasoningParserConfig = ParserConfig

function toRichText(text: string): Json {
  return plainTextToProseMirror(text) as Json
}

const APOSTROPHE_LIKE_RE = /[\u0027\u2018\u2019\u201A\u201B\u2032\u2035]/g

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
  sectionId: string
  categoryId?: string | null
  getCategoryIdForStem?: (stem: ParsedStem) => string | null
  isPrivate?: boolean
}

export function parseVerbalReasoningFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  return parseFromLines(rawLines, configOverrides)
}

export function parseVerbalReasoningPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseFromLines(rawLines, configOverrides)
}

export function parseVerbalReasoningFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc)
  return parseFromLines(logicalLines, configOverrides)
}

/**
 * Map parsed Verbal Reasoning stems into UcatQuestionStemFormValues.
 * All questions are multiple_choice; category comes from getVerbalReasoningStemCategoryName.
 */
export function mapParsedVerbalReasoningToFormValues(
  stems: ParsedStem[],
  options: VerbalReasoningToFormOptions
): UcatQuestionStemFormValues[] {
  const { sectionId, categoryId = null, getCategoryIdForStem, isPrivate = false } = options

  const result: UcatQuestionStemFormValues[] = []

  for (const stem of stems) {
    if (stem.stemText.trim().length === 0 || stem.questions.length === 0) continue

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

    if (questions.length === 0) continue

    const resolvedCategoryId =
      getCategoryIdForStem != null ? getCategoryIdForStem(stem) : categoryId

    result.push({
      sectionId,
      categoryId: resolvedCategoryId ?? null,
      stemText: plainTextToProseMirrorWithLineBreaks(stem.stemText) as Json,
      isPrivate,
      questions,
    })
  }

  return result
}
