import type { Json } from '@altitutor/shared'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import { getBulkImportLogicalLines } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
import type { ParsingOptions } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'
import {
  collectLogicalLinesFromDoc,
  parseFromLines,
} from '@/features/ucat/questions/lib/parsers/core'
import {
  detectStemLikeContentInQuestionPaste,
  splitStemDocumentFromDoc,
  type StemSplitOptions,
} from '@/features/ucat/questions/lib/parsers/splitStemDocument'
import {
  mapParsedVerbalReasoningToFormValues,
} from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import {
  mapParsedDecisionMakingToFormValues,
  isPlacementQuestionText,
  parseDecisionMakingPlainText,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  parseQuantitativeReasoningFromDoc,
  mapParsedQuantitativeReasoningToFormValues,
  type ParseQuantitativeReasoningResult,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import {
  mapParsedSituationalJudgementToFormValues,
  parseSituationalJudgementFromDoc,
  parseSituationalJudgementPlainText,
} from '@/features/ucat/questions/lib/parsers/situationalJudgement'
import { parseVerbalReasoningFromDoc } from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import {
  collectDecisionMakingLinesWithSyllogismImageOcr,
  type DecisionMakingSyllogismOcrResult,
} from '@/features/ucat/questions/components/bulk-import/bulkImportDecisionMakingOcr'
import {
  collectSituationalJudgementLinesWithScreenshotOcr,
  type SituationalJudgementScreenshotOcrResult,
} from '@/features/ucat/questions/components/bulk-import/bulkImportSituationalJudgementOcr'
import {
  inferBulkImportCategoryIdForParsedStem,
  inferBulkImportTagIdsForParsedQuestion,
  type BulkImportCategoryRow,
  type BulkImportTagRow,
} from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'

type CategoryRow = BulkImportCategoryRow
type TagRow = BulkImportTagRow

const STANDALONE_IMAGE_TOKEN_RE = /^\s*\[\[IMG:[^\]]+\]\]\s*$/u

type ParsedSectionResult =
  | { section: BulkImportParseSection; stems: ParsedStem[] }
  | { section: 'quantitative_reasoning'; stems: ParsedStem[]; tableMap: Map<string, Json> }

export function parserConfigFromOptions(
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions,
  questionsOnly = false
) {
  return {
    questionIndicator: parsingOptions.questionIndicator,
    answerOptionIndicator: parsingOptions.answerOptionIndicator,
    questionNumberOnOwnLine: parsingOptions.questionNumberOnOwnLine,
    answerOptionOnOwnLine: parsingOptions.answerOptionOnOwnLine,
    enforceSequentialQuestionNumbers: parsingOptions.requireConsecutiveQuestionNumbers,
    acceptSyllogismOptions: section === 'decision_making',
    questionNumberPlacement:
      section === 'decision_making'
        ? parsingOptions.decisionMakingQuestionNumberPlacement
        : section === 'quantitative_reasoning'
          ? parsingOptions.quantitativeReasoningQuestionNumberPlacement
        : 'question',
    questionsOnly,
  }
}

export function parseCombinedDocumentForSection(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions
): ParsedStem[] {
  return parseCombinedDocumentResultForSection(doc, section, parsingOptions).stems
}

export function parseCombinedDocumentResultForSection(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions
): ParsedSectionResult {
  switch (section) {
    case 'verbal_reasoning':
      return {
        section,
        stems: parseVerbalReasoningFromDoc(doc, parserConfigFromOptions(section, parsingOptions)),
      }
    case 'decision_making':
      return {
        section,
        stems: parseDecisionMakingPlainText(
          getBulkImportLogicalLines(doc, section, {
            ...parsingOptions,
            imageTokenMode: 'placeholder',
          }).join('\n'),
          parserConfigFromOptions(section, parsingOptions)
        ),
      }
    case 'quantitative_reasoning': {
      const result = parseQuantitativeReasoningFromDoc(
        doc,
        parserConfigFromOptions(section, parsingOptions)
      )
      return { section, stems: result.stems, tableMap: result.tableMap }
    }
    case 'situational_judgement':
      return {
        section,
        stems: parseSituationalJudgementPreviewFromDoc(
          doc,
          parserConfigFromOptions(section, parsingOptions)
        ),
      }
    default:
      return { section: 'verbal_reasoning', stems: [] }
  }
}

function parseSituationalJudgementPreviewFromDoc(
  doc: Json | null | undefined,
  config: ReturnType<typeof parserConfigFromOptions>
): ParsedStem[] {
  const lines = collectLogicalLinesFromDoc(doc, { detectNestedQuestionTables: true })
  if (!lines.some((line) => STANDALONE_IMAGE_TOKEN_RE.test(line))) {
    return parseSituationalJudgementFromDoc(doc, config)
  }

  const stems: ParsedStem[] = []
  let textSegment: string[] = []
  const flushTextSegment = () => {
    if (textSegment.some((line) => line.trim().length > 0)) {
      stems.push(...parseSituationalJudgementPlainText(textSegment.join('\n'), config))
    }
    textSegment = []
  }

  for (const line of lines) {
    if (STANDALONE_IMAGE_TOKEN_RE.test(line)) {
      flushTextSegment()
      stems.push({ stemText: line, questions: [] })
    } else {
      textSegment.push(line)
    }
  }
  flushTextSegment()
  return stems
}

export async function parseCombinedDocumentResultForSectionWithOcr(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions
): Promise<{
  parsed: ParsedSectionResult
  ocr: DecisionMakingSyllogismOcrResult | SituationalJudgementScreenshotOcrResult | null
}> {
  if (section !== 'decision_making' && section !== 'situational_judgement') {
    return {
      parsed: parseCombinedDocumentResultForSection(doc, section, parsingOptions),
      ocr: null,
    }
  }

  const config = parserConfigFromOptions(section, parsingOptions)
  if (section === 'situational_judgement') {
    const ocr = await collectSituationalJudgementLinesWithScreenshotOcr(doc, config)
    return {
      parsed: {
        section,
        stems: parseSituationalJudgementPlainText(ocr.lines.join('\n'), config),
      },
      ocr,
    }
  }
  const ocr = await collectDecisionMakingLinesWithSyllogismImageOcr(doc, config)

  return {
    parsed: {
      section,
      stems: parseDecisionMakingPlainText(ocr.lines.join('\n'), config),
    },
    ocr,
  }
}

export function parseQuestionsOnlyForSection(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions
): { questions: ParsedStem['questions']; stemLikeWarning: boolean } {
  const lines = collectLogicalLinesFromDoc(doc, {
    detectNestedQuestionTables: section !== 'quantitative_reasoning',
  })
  const stems = parseFromLines(lines, parserConfigFromOptions(section, parsingOptions, true))
  const questions = stems.flatMap((s) => s.questions)
  return {
    questions,
    stemLikeWarning: detectStemLikeContentInQuestionPaste(lines),
  }
}

export function mapParsedStemsToFormValues(
  parsed: ParsedStem[] | ParsedSectionResult,
  section: BulkImportParseSection,
  sectionId: string,
  categories: CategoryRow[],
  tags: TagRow[] = []
): UcatQuestionStemFormValues[] {
  const stems = Array.isArray(parsed) ? parsed : parsed.stems

  switch (section) {
    case 'verbal_reasoning':
      return mapParsedVerbalReasoningToFormValues(stems, {
        sectionId,
        accessScope: 'public',
        getCategoryIdForStem: (stem) =>
          inferBulkImportCategoryIdForParsedStem({ stem, section, sectionId, categories }),
        getTagIdsForQuestion: ({ stem, question }) =>
          inferBulkImportTagIdsForParsedQuestion({ stem, question, section, sectionId, tags }),
      })
    case 'decision_making':
      return mapParsedDecisionMakingToFormValues(
        stems.map((stem) => ({
          stemText: stem.stemText,
          questions: stem.questions.map((q) => ({
            number: q.number,
            text: q.text,
            options: q.options,
            responseType: isPlacementQuestionText(q.text) ? 'drag_and_drop' : 'multiple_choice',
            answerScheme: isPlacementQuestionText(q.text)
              ? 'decision_making_binary_placement'
              : 'single_choice',
          })),
        })),
        {
          sectionId,
          accessScope: 'public',
          getCategoryIdForStem: (stem) =>
            inferBulkImportCategoryIdForParsedStem({ stem: stem as ParsedStem, section, sectionId, categories }),
          getTagIdsForQuestion: ({ stem, question }) =>
            inferBulkImportTagIdsForParsedQuestion({
              stem: stem as ParsedStem,
              question: question as ParsedStem['questions'][number],
              section,
              sectionId,
              tags,
            }),
        }
      )
    case 'quantitative_reasoning':
      return mapParsedQuantitativeReasoningToFormValues(
        toQuantitativeReasoningResult(parsed, stems),
        {
          sectionId,
          accessScope: 'public',
          getCategoryIdForStem: (stem) =>
            inferBulkImportCategoryIdForParsedStem({ stem, section, sectionId, categories }),
          getTagIdsForQuestion: ({ stem, question }) =>
            inferBulkImportTagIdsForParsedQuestion({ stem, question, section, sectionId, tags }),
        }
      )
    case 'situational_judgement':
      return mapParsedSituationalJudgementToFormValues(stems, {
        sectionId,
        accessScope: 'public',
        getCategoryIdForStem: (stem) =>
          inferBulkImportCategoryIdForParsedStem({ stem, section, sectionId, categories }),
        getTagIdsForQuestion: ({ stem, question }) =>
          inferBulkImportTagIdsForParsedQuestion({ stem, question, section, sectionId, tags }),
      })
    default:
      return []
  }
}

function toQuantitativeReasoningResult(
  parsed: ParsedStem[] | ParsedSectionResult,
  stems: ParsedStem[]
): ParseQuantitativeReasoningResult {
  if (!Array.isArray(parsed) && parsed.section === 'quantitative_reasoning' && 'tableMap' in parsed) {
    return { stems: parsed.stems, tableMap: parsed.tableMap }
  }
  return { stems, tableMap: new Map() }
}

export function buildFormValuesFromSeparateStemDocuments(
  stemTexts: string[],
  perStemQuestionDocs: Array<Json | null | undefined>,
  section: BulkImportParseSection,
  sectionId: string,
  parsingOptions: ParsingOptions,
  categories: CategoryRow[],
  tags: TagRow[] = []
): UcatQuestionStemFormValues[] {
  const parsedStems: ParsedStem[] = stemTexts.map((stemText, index) => {
    const { questions } = parseQuestionsOnlyForSection(
      perStemQuestionDocs[index],
      section,
      parsingOptions
    )
    return { stemText, questions }
  })
  return mapParsedStemsToFormValues(parsedStems, section, sectionId, categories, tags)
}

export { splitStemDocumentFromDoc, type StemSplitOptions }
