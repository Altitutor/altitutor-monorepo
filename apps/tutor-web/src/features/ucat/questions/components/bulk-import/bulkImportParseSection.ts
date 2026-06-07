import type { Json } from '@altitutor/shared'
import type { BulkImportParseSection } from '@/features/ucat/questions/components/bulk-import/bulkImportLogicalLines'
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
  getVerbalReasoningStemCategoryName,
} from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import {
  mapParsedDecisionMakingToFormValues,
  getDecisionMakingStemCategoryName,
  isSyllogismQuestionText,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  parseQuantitativeReasoningFromDoc,
  mapParsedQuantitativeReasoningToFormValues,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import {
  mapParsedSituationalJudgementToFormValues,
  getSituationalJudgementStemCategoryName,
  parseSituationalJudgementFromDoc,
} from '@/features/ucat/questions/lib/parsers/situationalJudgement'
import { parseVerbalReasoningFromDoc } from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import { parseDecisionMakingFromDoc } from '@/features/ucat/questions/lib/parsers/decisionMaking'

type CategoryRow = { id?: string | null; ucat_section_id?: string | null; name?: string | null }

function parserConfigFromOptions(
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
    questionsOnly,
  }
}

export function parseCombinedDocumentForSection(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions
): ParsedStem[] {
  switch (section) {
    case 'verbal_reasoning':
      return parseVerbalReasoningFromDoc(doc, parserConfigFromOptions(section, parsingOptions))
    case 'decision_making':
      return parseDecisionMakingFromDoc(doc, parserConfigFromOptions(section, parsingOptions))
    case 'quantitative_reasoning':
      return parseQuantitativeReasoningFromDoc(
        doc,
        parserConfigFromOptions(section, parsingOptions)
      ).stems
    case 'situational_judgement':
      return parseSituationalJudgementFromDoc(doc, parserConfigFromOptions(section, parsingOptions))
    default:
      return []
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
  stems: ParsedStem[],
  section: BulkImportParseSection,
  sectionId: string,
  categories: CategoryRow[]
): UcatQuestionStemFormValues[] {
  const getCategoryId = (name: string) =>
    categories.find(
      (c) => (c.ucat_section_id ?? null) === sectionId && (c.name ?? '').trim() === name
    )?.id ?? null

  switch (section) {
    case 'verbal_reasoning':
      return mapParsedVerbalReasoningToFormValues(stems, {
        sectionId,
        isPrivate: false,
        getCategoryIdForStem: (stem) =>
          getCategoryId(getVerbalReasoningStemCategoryName(stem)),
      })
    case 'decision_making':
      return mapParsedDecisionMakingToFormValues(
        stems.map((stem) => ({
          stemText: stem.stemText,
          questions: stem.questions.map((q) => ({
            number: q.number,
            text: q.text,
            options: q.options,
            questionType: isSyllogismQuestionText(q.text) ? 'syllogism' : 'multiple_choice',
          })),
        })),
        {
          sectionId,
          isPrivate: false,
          getCategoryIdForStem: (stem) =>
            getCategoryId(getDecisionMakingStemCategoryName(stem)),
        }
      )
    case 'quantitative_reasoning':
      return mapParsedQuantitativeReasoningToFormValues(
        { stems, tableMap: new Map() },
        { sectionId, isPrivate: false }
      )
    case 'situational_judgement':
      return mapParsedSituationalJudgementToFormValues(stems, {
        sectionId,
        isPrivate: false,
        getCategoryIdForStem: (stem) => {
          const name = getSituationalJudgementStemCategoryName(stem)
          return name ? getCategoryId(name) : null
        },
      })
    default:
      return []
  }
}

export function buildFormValuesFromSeparateStemDocuments(
  stemTexts: string[],
  perStemQuestionDocs: Array<Json | null | undefined>,
  section: BulkImportParseSection,
  sectionId: string,
  parsingOptions: ParsingOptions,
  categories: CategoryRow[]
): UcatQuestionStemFormValues[] {
  const parsedStems: ParsedStem[] = stemTexts.map((stemText, index) => {
    const { questions } = parseQuestionsOnlyForSection(
      perStemQuestionDocs[index],
      section,
      parsingOptions
    )
    return { stemText, questions }
  })
  return mapParsedStemsToFormValues(parsedStems, section, sectionId, categories)
}

export { splitStemDocumentFromDoc, type StemSplitOptions }
