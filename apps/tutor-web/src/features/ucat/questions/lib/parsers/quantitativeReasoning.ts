import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirrorWithTables,
  tokenizedPlainTextToProseMirrorWithLineBreaksAndTables,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  collectBlocksFromDocForQuantitativeReasoning,
  parseFromLines,
  type ParsedStem,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

export type { ParsedStem, ParsedOption, ParsedQuestion } from '@/features/ucat/questions/lib/parsers/core'

export type QuantitativeReasoningParserConfig = ParserConfig

export type QuantitativeReasoningToFormOptions = {
  sectionId: string
  categoryId?: string | null
  isPrivate?: boolean
}

export function parseQuantitativeReasoningFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  return parseFromLines(rawLines, configOverrides)
}

export function parseQuantitativeReasoningPlainText(
  input: string,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const rawLines = input.split(/\r?\n/u)
  return parseFromLines(rawLines, configOverrides)
}

export type ParseQuantitativeReasoningResult = {
  stems: ParsedStem[]
  tableMap: Map<string, Json>
}

export function parseQuantitativeReasoningFromDoc(
  doc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParseQuantitativeReasoningResult {
  const { logicalLines, tableMap } = collectBlocksFromDocForQuantitativeReasoning(doc)
  const stems = parseFromLines(logicalLines, configOverrides)
  return { stems, tableMap }
}

/**
 * Map parsed Quantitative Reasoning stems into UcatQuestionStemFormValues.
 * Preserves tables and images in stem text, question text, and answer options.
 * All questions are multiple_choice.
 */
export function mapParsedQuantitativeReasoningToFormValues(
  result: ParseQuantitativeReasoningResult,
  options: QuantitativeReasoningToFormOptions
): UcatQuestionStemFormValues[] {
  const { stems, tableMap } = result
  const { sectionId, categoryId = null, isPrivate = false } = options

  const formValues: UcatQuestionStemFormValues[] = []

  for (const stem of stems) {
    if (stem.stemText.trim().length === 0 || stem.questions.length === 0) continue

    const questions = stem.questions
      .filter((q) => q.text.trim().length > 0 && q.options.length > 0)
      .map((q) => ({
        questionText: tokenizedPlainTextToProseMirrorWithLineBreaksAndTables(
          q.text,
          tableMap
        ) as Json,
        questionType: 'multiple_choice' as const,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        options: q.options.map((opt) => ({
          answerText: tokenizedPlainTextToProseMirrorWithTables(opt.text, tableMap) as Json,
          answerExplanation: null,
          isAnswer: false,
        })),
      }))

    if (questions.length === 0) continue

    formValues.push({
      sectionId,
      categoryId: categoryId ?? null,
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaksAndTables(
        stem.stemText,
        tableMap
      ) as Json,
      isPrivate,
      questions,
    })
  }

  return formValues
}
