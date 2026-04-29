/**
 * UCAT section parsers: shared core + section-specific entry points.
 *
 * - core: collectLogicalLinesFromDoc, parseFromLines, ParsedStem / ParsedQuestion / ParsedOption
 * - verbalReasoning: parseVerbalReasoningFromDoc, getVerbalReasoningStemCategoryName, mapParsedVerbalReasoningToFormValues
 * - decisionMaking: parseDecisionMakingFromDoc, isSyllogismQuestionText, mapParsedDecisionMakingToFormValues
 * - quantitativeReasoning: parseQuantitativeReasoningFromDoc, mapParsedQuantitativeReasoningToFormValues (preserves tables/images)
 * - situationalJudgement: parseSituationalJudgementFromDoc, mapParsedSituationalJudgementToFormValues
 */

export {
  collectLogicalLinesFromDoc,
  collectBlocksFromDocForQuantitativeReasoning,
  parseFromLines,
  classifyParseLineRoles,
  nodeToText,
  extractQuestionRowFromNestedTable,
  isQuestionTableWithNestedOptions,
  isOptionsTable,
  extractOptionLinesFromTable,
  type PMNode,
  type ParsedStem,
  type ParsedQuestion,
  type ParsedOption,
  type ParserConfig,
  type QuantitativeReasoningDocBlocks,
  type ParseLineHighlightRole,
} from './core'

export {
  parseVerbalReasoningFromDoc,
  parseVerbalReasoningFromLines,
  parseVerbalReasoningPlainText,
  getVerbalReasoningStemCategoryName,
  mapParsedVerbalReasoningToFormValues,
  type VerbalReasoningParserConfig,
  type VerbalReasoningToFormOptions,
} from './verbalReasoning'

export {
  parseDecisionMakingFromDoc,
  parseDecisionMakingPlainText,
  isSyllogismQuestionText,
  getDecisionMakingStemCategoryName,
  mapParsedDecisionMakingToFormValues,
  type ParsedDecisionMakingStem,
  type ParsedDecisionMakingQuestion,
  type ParsedDecisionMakingOption,
  type DecisionMakingCategoryName,
  type DecisionMakingToFormOptions,
} from './decisionMaking'

export {
  parseQuantitativeReasoningFromDoc,
  parseQuantitativeReasoningFromLines,
  parseQuantitativeReasoningPlainText,
  mapParsedQuantitativeReasoningToFormValues,
  type QuantitativeReasoningParserConfig,
  type QuantitativeReasoningToFormOptions,
  type ParseQuantitativeReasoningResult,
} from './quantitativeReasoning'

export {
  parseSituationalJudgementFromDoc,
  parseSituationalJudgementFromLines,
  parseSituationalJudgementPlainText,
  getSituationalJudgementStemCategoryName,
  mapParsedSituationalJudgementToFormValues,
  type SituationalJudgementParserConfig,
  type SituationalJudgementCategoryName,
  type SituationalJudgementToFormOptions,
} from './situationalJudgement'
