import type {
  AnswerOptionIndicatorKind,
  QuestionIndicatorKind,
} from '@/features/ucat/questions/lib/parsers/core'
import { buildOptionRegexes, buildQuestionRegexes } from '@/features/ucat/questions/lib/parsers/core'
import type { ParsingOptions } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

export type AlternativeParsingIndicatorHints = {
  questionIndicator: QuestionIndicatorKind | null
  answerOptionIndicator: AnswerOptionIndicatorKind | null
}

const QUESTION_INDICATOR_LABELS: Record<QuestionIndicatorKind, string> = {
  dot: '1. 2. 3.',
  paren: '1) 2) 3)',
}

const ANSWER_OPTION_INDICATOR_LABELS: Record<AnswerOptionIndicatorKind, string> = {
  paren: 'a) b) c)',
  dot: 'a. b. c.',
}

export function questionIndicatorLabel(kind: QuestionIndicatorKind): string {
  return QUESTION_INDICATOR_LABELS[kind]
}

export function answerOptionIndicatorLabel(kind: AnswerOptionIndicatorKind): string {
  return ANSWER_OPTION_INDICATOR_LABELS[kind]
}

function lineMatchesQuestionIndicator(
  line: string,
  kind: QuestionIndicatorKind,
  questionNumberOnOwnLine: boolean
): boolean {
  const qRe = buildQuestionRegexes(kind)
  if (qRe.inline.test(line)) return true
  if (questionNumberOnOwnLine && qRe.numberOnly.test(line)) return true
  return false
}

function lineMatchesOptionIndicator(
  line: string,
  kind: AnswerOptionIndicatorKind,
  answerOptionOnOwnLine: boolean
): boolean {
  const oRe = buildOptionRegexes(kind)
  if (oRe.inline.test(line)) return true
  if (answerOptionOnOwnLine && oRe.labelOnly.test(line)) return true
  if (!answerOptionOnOwnLine && oRe.labelOnly.test(line)) return true
  return false
}

function countIndicatorMatches(
  lines: string[],
  kind: 'question' | 'answerOption',
  indicator: QuestionIndicatorKind | AnswerOptionIndicatorKind,
  parsingOptions: ParsingOptions
): number {
  let count = 0
  for (const line of lines) {
    if (line.trim().length === 0) continue
    const matches =
      kind === 'question'
        ? lineMatchesQuestionIndicator(
            line,
            indicator as QuestionIndicatorKind,
            parsingOptions.questionNumberOnOwnLine
          )
        : lineMatchesOptionIndicator(
            line,
            indicator as AnswerOptionIndicatorKind,
            parsingOptions.answerOptionOnOwnLine
          )
    if (matches) count += 1
  }
  return count
}

/**
 * When parsing finds no questions, suggest switching indicators if the paste
 * contains lines that match a non-selected question or answer-option format.
 */
export function detectAlternativeParsingIndicators(
  lines: string[],
  parsingOptions: ParsingOptions
): AlternativeParsingIndicatorHints {
  const questionAlternatives: QuestionIndicatorKind[] =
    parsingOptions.questionIndicator === 'dot' ? ['paren'] : ['dot']
  const answerAlternatives: AnswerOptionIndicatorKind[] =
    parsingOptions.answerOptionIndicator === 'paren' ? ['dot'] : ['paren']

  const selectedQuestionMatches = countIndicatorMatches(
    lines,
    'question',
    parsingOptions.questionIndicator,
    parsingOptions
  )
  const selectedAnswerMatches = countIndicatorMatches(
    lines,
    'answerOption',
    parsingOptions.answerOptionIndicator,
    parsingOptions
  )

  let questionIndicator: QuestionIndicatorKind | null = null
  for (const alt of questionAlternatives) {
    const altMatches = countIndicatorMatches(lines, 'question', alt, parsingOptions)
    if (altMatches > 0 && altMatches > selectedQuestionMatches) {
      questionIndicator = alt
      break
    }
  }

  let answerOptionIndicator: AnswerOptionIndicatorKind | null = null
  for (const alt of answerAlternatives) {
    const altMatches = countIndicatorMatches(lines, 'answerOption', alt, parsingOptions)
    if (altMatches > 0 && altMatches > selectedAnswerMatches) {
      answerOptionIndicator = alt
      break
    }
  }

  return { questionIndicator, answerOptionIndicator }
}

export function formatAlternativeParsingIndicatorHint(
  hints: AlternativeParsingIndicatorHints
): string | null {
  const parts: string[] = []
  if (hints.questionIndicator) {
    parts.push(`question indicator to ${questionIndicatorLabel(hints.questionIndicator)}`)
  }
  if (hints.answerOptionIndicator) {
    parts.push(`answer option indicator to ${answerOptionIndicatorLabel(hints.answerOptionIndicator)}`)
  }
  if (parts.length === 0) return null
  if (parts.length === 1) {
    return `No questions detected. Try changing the ${parts[0]} in Question settings.`
  }
  return `No questions detected. Try changing the ${parts[0]} and ${parts[1]} in Question settings.`
}
