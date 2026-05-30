import type { Json } from '@altitutor/shared'
import {
  bulkImportParserAcceptSyllogism,
  getBulkImportLogicalLines,
  type BulkImportParseSection,
} from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { answerDocToPlainTsv } from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import {
  analyzeAnswersPaste,
  type AnswersPasteAnalysis,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import {
  mergeConsecutiveStemsWithSameText,
  parseFromLines,
  type ParserConfig,
} from '@/features/ucat/questions/lib/parsers/core'

export type QuestionPasteClassify = Pick<
  ParserConfig,
  'questionIndicator' | 'answerOptionIndicator' | 'questionNumberOnOwnLine' | 'answerOptionOnOwnLine'
>

export type QuestionStemBreakdown = {
  stemIndex: number
  questionCount: number
  optionCount: number
}

export type QuestionPasteStats = {
  totalStems: number
  totalQuestions: number
  totalOptions: number
  stemBreakdown: QuestionStemBreakdown[]
}

export function computeQuestionPasteStats(
  docJson: Json | null | undefined,
  section: BulkImportParseSection | null,
  classify: QuestionPasteClassify
): QuestionPasteStats {
  if (!section) {
    return { totalStems: 0, totalQuestions: 0, totalOptions: 0, stemBreakdown: [] }
  }
  const lines = getBulkImportLogicalLines(docJson, section)
  const parsedStems = parseFromLines(lines, {
    ...classify,
    acceptSyllogismOptions: bulkImportParserAcceptSyllogism(section),
    questionLookaheadLimit: section === 'quantitative_reasoning' ? 160 : undefined,
  })
  const stems =
    section === 'quantitative_reasoning'
      ? mergeConsecutiveStemsWithSameText(parsedStems)
      : parsedStems
  const stemBreakdown = stems.map((s, i) => {
    const questionCount = s.questions.length
    const optionCount = s.questions.reduce((acc, q) => acc + q.options.length, 0)
    return { stemIndex: i + 1, questionCount, optionCount }
  })
  const totalQuestions = stemBreakdown.reduce((a, b) => a + b.questionCount, 0)
  const totalOptions = stemBreakdown.reduce((a, b) => a + b.optionCount, 0)
  return {
    totalStems: stems.length,
    totalQuestions,
    totalOptions,
    stemBreakdown,
  }
}

export type AnswerPasteStats = AnswersPasteAnalysis

export function computeAnswerPasteStats(docJson: Json | null | undefined): AnswersPasteAnalysis {
  const plainTsv = answerDocToPlainTsv(docJson)
  return analyzeAnswersPaste(plainTsv)
}
