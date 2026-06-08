import type { Json } from '@altitutor/shared'
import {
  tokenizedPlainTextToProseMirror,
  tokenizedPlainTextToProseMirrorWithLineBreaks,
} from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
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

function parseDecisionMakingFromLines(
  rawLines: string[],
  configOverrides?: Partial<ParserConfig>
): ParsedDecisionMakingStem[] {
  const stems = parseFromLines(rawLines, {
    acceptSyllogismOptions: true,
    ...configOverrides,
  })
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
