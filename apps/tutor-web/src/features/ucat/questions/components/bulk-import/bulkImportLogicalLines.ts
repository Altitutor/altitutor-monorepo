import type { Json } from '@altitutor/shared'
import {
  collectBlocksFromDocForQuantitativeReasoning,
  collectLogicalLinesFromDoc,
} from '@/features/ucat/questions/lib/parsers/core'
import {
  normalizeDecisionMakingSyllogismLines,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import {
  normalizeQuantitativeReasoningItemStemLines,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import type { ParsingOptions } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

export type BulkImportParseSection =
  | 'verbal_reasoning'
  | 'decision_making'
  | 'quantitative_reasoning'
  | 'situational_judgement'

export function bulkImportSectionFromUcatName(
  name: string | null | undefined
): BulkImportParseSection | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  if (key === 'verbal reasoning') return 'verbal_reasoning'
  if (key === 'decision making') return 'decision_making'
  if (key === 'quantitative reasoning') return 'quantitative_reasoning'
  if (key === 'situational judgement' || key === 'situational judgment') {
    return 'situational_judgement'
  }
  return null
}

export function bulkImportParserAcceptSyllogism(section: BulkImportParseSection): boolean {
  return section === 'decision_making'
}

/** Logical lines fed into {@link parseFromLines} for the selected UCAT bulk-import section. */
export function getBulkImportLogicalLines(
  doc: Json | null | undefined,
  section: BulkImportParseSection,
  parsingOptions?: Partial<ParsingOptions> & {
    imageTokenMode?: 'preserve' | 'placeholder'
    questionNumberPlacement?: 'question' | 'item_stem'
  }
): string[] {
  switch (section) {
    case 'verbal_reasoning':
    case 'situational_judgement':
      return collectLogicalLinesFromDoc(doc, { detectNestedQuestionTables: true })
    case 'decision_making':
      return normalizeDecisionMakingSyllogismLines(collectLogicalLinesFromDoc(doc), {
        ...(parsingOptions ?? {}),
        questionNumberPlacement:
          parsingOptions?.questionNumberPlacement ??
          parsingOptions?.decisionMakingQuestionNumberPlacement ??
          'question',
      }, {
        imageTokenMode: parsingOptions?.imageTokenMode ?? 'preserve',
      })
    case 'quantitative_reasoning':
      return normalizeQuantitativeReasoningItemStemLines(
        collectBlocksFromDocForQuantitativeReasoning(doc).logicalLines,
        {
          ...(parsingOptions ?? {}),
          questionNumberPlacement:
            parsingOptions?.questionNumberPlacement ??
            parsingOptions?.quantitativeReasoningQuestionNumberPlacement ??
            'question',
        }
      )
  }
}
