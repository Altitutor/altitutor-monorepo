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
  getVerbalReasoningStemCategoryName,
} from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import {
  mapParsedDecisionMakingToFormValues,
  getDecisionMakingStemCategoryName,
  isSyllogismQuestionText,
  parseDecisionMakingPlainText,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  parseQuantitativeReasoningFromDoc,
  mapParsedQuantitativeReasoningToFormValues,
  getQuantitativeReasoningStemCategoryName,
  getQuantitativeReasoningTagPathsForQuestion,
  type ParseQuantitativeReasoningResult,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import {
  mapParsedSituationalJudgementToFormValues,
  getSituationalJudgementStemCategoryName,
  parseSituationalJudgementFromDoc,
} from '@/features/ucat/questions/lib/parsers/situationalJudgement'
import { parseVerbalReasoningFromDoc } from '@/features/ucat/questions/lib/parsers/verbalReasoning'
import {
  collectDecisionMakingLinesWithSyllogismImageOcr,
  type DecisionMakingSyllogismOcrResult,
} from '@/features/ucat/questions/components/bulk-import/bulkImportDecisionMakingOcr'

type CategoryRow = { id?: string | null; ucat_section_id?: string | null; name?: string | null }
type TagRow = {
  id?: string | null
  name?: string | null
  parent_question_tag_id?: string | null
  ucat_section_id?: string | null
}

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
        stems: parseSituationalJudgementFromDoc(doc, parserConfigFromOptions(section, parsingOptions)),
      }
    default:
      return { section: 'verbal_reasoning', stems: [] }
  }
}

export async function parseCombinedDocumentResultForSectionWithOcr(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions: ParsingOptions
): Promise<{ parsed: ParsedSectionResult; ocr: DecisionMakingSyllogismOcrResult | null }> {
  if (section !== 'decision_making') {
    return {
      parsed: parseCombinedDocumentResultForSection(doc, section, parsingOptions),
      ocr: null,
    }
  }

  const config = parserConfigFromOptions(section, parsingOptions)
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
  const getCategoryId = (name: string) =>
    categories.find(
      (c) => (c.ucat_section_id ?? null) === sectionId && (c.name ?? '').trim() === name
    )?.id ?? null
  const getTagIdByPath = buildTagIdByPath(tags, sectionId)

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
        toQuantitativeReasoningResult(parsed, stems),
        {
          sectionId,
          isPrivate: false,
          getCategoryIdForStem: (stem) => {
            const name = getQuantitativeReasoningStemCategoryName(stem)
            return name ? getCategoryId(name) : null
          },
          getTagIdsForQuestion: ({ stem, question }) =>
            getQuantitativeReasoningTagPathsForQuestion({ stem, question })
              .map((path) => getTagIdByPath(path))
              .filter((id): id is string => id != null),
        }
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

function toQuantitativeReasoningResult(
  parsed: ParsedStem[] | ParsedSectionResult,
  stems: ParsedStem[]
): ParseQuantitativeReasoningResult {
  if (!Array.isArray(parsed) && parsed.section === 'quantitative_reasoning' && 'tableMap' in parsed) {
    return { stems: parsed.stems, tableMap: parsed.tableMap }
  }
  return { stems, tableMap: new Map() }
}

type ResolvedTagRow = TagRow & { id: string; name: string }

function buildTagIdByPath(tags: TagRow[], sectionId: string): (path: string[]) => string | null {
  const rows = tags.filter((tag): tag is ResolvedTagRow => {
    return typeof tag.id === 'string' && tag.id.length > 0 && typeof tag.name === 'string'
  })
  const byParent = new Map<string | null, ResolvedTagRow[]>()
  for (const row of rows) {
    const parentId = row.parent_question_tag_id ?? null
    const current = byParent.get(parentId) ?? []
    current.push(row)
    byParent.set(parentId, current)
  }

  return (path: string[]) => {
    let parentId: string | null = null
    let matchedId: string | null = null
    for (let index = 0; index < path.length; index += 1) {
      const expected = path[index]?.trim().toLowerCase()
      if (!expected) return null
      const candidates: ResolvedTagRow[] = byParent.get(parentId) ?? []
      const match = candidates.find((candidate: ResolvedTagRow) => {
        const nameMatches = candidate.name.trim().toLowerCase() === expected
        if (!nameMatches) return false
        if (index === 0) return (candidate.ucat_section_id ?? null) === sectionId
        return true
      })
      if (!match) return null
      matchedId = match.id
      parentId = match.id
    }
    return matchedId
  }
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
