import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirror,
  tokenizedPlainTextToProseMirrorWithLineBreaks,
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

export type SituationalJudgementParserConfig = ParserConfig

export type SituationalJudgementCategoryName = 'How important' | 'How appropriate'

/**
 * Get Situational Judgement category name from stem content.
 * Rules: "How important" if question text contains it; "How appropriate" if question text contains it.
 * Case insensitive. First match wins. Returns null if neither matches.
 */
export function getSituationalJudgementStemCategoryName(
  stem: ParsedStem
): SituationalJudgementCategoryName | null {
  for (const q of stem.questions) {
    const qLower = q.text.toLowerCase()
    if (qLower.includes('how important')) return 'How important'
    if (qLower.includes('how appropriate')) return 'How appropriate'
  }
  return null
}

function toRichText(text: string): Json {
  return tokenizedPlainTextToProseMirror(text) as Json
}

export type SituationalJudgementToFormOptions = {
  sectionId: string
  categoryId?: string | null
  getCategoryIdForStem?: (stem: ParsedStem) => string | null
  isPrivate?: boolean
}

export function parseSituationalJudgementFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  return parseFromLines(rawLines, configOverrides)
}

export function parseSituationalJudgementPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseFromLines(rawLines, configOverrides)
}

export function parseSituationalJudgementFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const logicalLines = collectLogicalLinesFromDoc(doc, {
    detectNestedQuestionTables: true,
  })
  return parseFromLines(logicalLines, configOverrides)
}

/**
 * Map parsed Situational Judgement stems into UcatQuestionStemFormValues.
 * All questions are multiple_choice.
 */
export function mapParsedSituationalJudgementToFormValues(
  stems: ParsedStem[],
  options: SituationalJudgementToFormOptions
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
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaks(stem.stemText) as Json,
      isPrivate,
      questions,
    })
  }

  return result
}
