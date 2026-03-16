/**
 * UCAT section parsers: shared core + section-specific entry points.
 *
 * - core: collectLogicalLinesFromDoc, parseFromLines, ParsedStem / ParsedQuestion / ParsedOption
 * - verbalReasoning: parseVerbalReasoningFromDoc, getVerbalReasoningStemCategoryName, mapParsedVerbalReasoningToFormValues
 * - decisionMaking: parseDecisionMakingFromDoc, isSyllogismQuestionText, mapParsedDecisionMakingToFormValues
 * - quantitativeReasoning: parseQuantitativeReasoningFromDoc, mapParsedQuantitativeReasoningToFormValues (preserves tables/images)
 */

export {
  collectLogicalLinesFromDoc,
  collectBlocksFromDocForQuantitativeReasoning,
  parseFromLines,
  type ParsedStem,
  type ParsedQuestion,
  type ParsedOption,
  type ParserConfig,
  type QuantitativeReasoningDocBlocks,
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
  mapParsedDecisionMakingToFormValues,
  type ParsedDecisionMakingStem,
  type ParsedDecisionMakingQuestion,
  type ParsedDecisionMakingOption,
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
