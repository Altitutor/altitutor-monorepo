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
  type ParsedQuestion,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

export type { ParsedStem, ParsedOption, ParsedQuestion } from '@/features/ucat/questions/lib/parsers/core'
export { collectLogicalLinesFromDoc } from '@/features/ucat/questions/lib/parsers/core'

export type VerbalReasoningParserConfig = ParserConfig

function toRichText(text: string): Json {
  return tokenizedPlainTextToProseMirror(text) as Json
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
  const logicalLines = collectLogicalLinesFromDoc(doc, {
    detectNestedQuestionTables: true,
  })
  return parseFromLines(logicalLines, configOverrides)
}

function splitPromptBlocks(lines: string[], configOverrides?: Partial<ParserConfig>): string[] {
  const blocks: string[][] = []
  let current: string[] = []
  let hasSeenPromptMarker = false

  const flush = (allowPrePrompt = false): void => {
    const text = current.join('\n').trim()
    if (text.length > 0 && (hasSeenPromptMarker || allowPrePrompt)) blocks.push([...current])
    current = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const promptMatch = /^prompt\s+\d+\b[\s:.-]*/i.exec(trimmed)
    if (promptMatch) {
      flush()
      hasSeenPromptMarker = true
      const rest = trimmed.slice(promptMatch[0].length).trim()
      if (rest.length > 0) current.push(rest)
      continue
    }
    current.push(line)
  }
  flush(true)

  return blocks
    .map((block) => {
      const parsed = parseFromLines(block, configOverrides)
      if (parsed.length === 1 && parsed[0]?.questions.length === 0) {
        return parsed[0]?.stemText.trim() ?? ''
      }
      return block.join('\n').trim()
    })
    .filter((text) => text.length > 0)
}

function splitQuestionsEvenly(questions: ParsedQuestion[], groupCount: number): ParsedQuestion[][] {
  if (groupCount <= 0) return []
  if (questions.length === 0) return Array.from({ length: groupCount }, () => [])
  if (questions.length % groupCount === 0) {
    const size = questions.length / groupCount
    return Array.from({ length: groupCount }, (_, i) =>
      questions.slice(i * size, (i + 1) * size)
    )
  }

  const groups: ParsedQuestion[][] = []
  let cursor = 0
  for (let i = 0; i < groupCount; i += 1) {
    const remainingQuestions = questions.length - cursor
    const remainingGroups = groupCount - i
    const size = Math.ceil(remainingQuestions / remainingGroups)
    groups.push(questions.slice(cursor, cursor + size))
    cursor += size
  }
  return groups
}

export function parseVerbalReasoningWithSeparateStemDoc(
  questionDoc: Json | null | undefined,
  stemDoc: Json | null | undefined,
  configOverrides?: Partial<ParserConfig>
): ParsedStem[] {
  const promptLines = collectLogicalLinesFromDoc(stemDoc, {
    detectNestedQuestionTables: true,
  })
  const promptBlocks = splitPromptBlocks(promptLines, configOverrides)
  if (promptBlocks.length === 0) return parseVerbalReasoningFromDoc(questionDoc, configOverrides)

  const parsedQuestionStems = parseVerbalReasoningFromDoc(questionDoc, configOverrides)
  if (parsedQuestionStems.length === 0) return []

  if (parsedQuestionStems.length === promptBlocks.length) {
    return parsedQuestionStems.map((stem, i) => ({
      stemText: promptBlocks[i] ?? stem.stemText,
      questions: stem.questions,
    }))
  }

  const allQuestions = parsedQuestionStems.flatMap((stem) => stem.questions)
  const groupedQuestions = splitQuestionsEvenly(allQuestions, promptBlocks.length)
  return promptBlocks
    .map((stemText, i) => ({
      stemText,
      questions: groupedQuestions[i] ?? [],
    }))
    .filter((stem) => stem.questions.length > 0)
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
      stemText: tokenizedPlainTextToProseMirrorWithLineBreaks(stem.stemText) as Json,
      isPrivate,
      questions,
    })
  }

  return result
}
