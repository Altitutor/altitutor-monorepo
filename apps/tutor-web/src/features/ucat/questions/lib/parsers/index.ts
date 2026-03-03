/**
 * UCAT section parsers: shared core + section-specific entry points.
 *
 * - core: collectLogicalLinesFromDoc, parseFromLines, ParsedStem / ParsedQuestion / ParsedOption
 * - verbalReasoning: parseVerbalReasoningFromDoc, getVerbalReasoningStemCategoryName, mapParsedVerbalReasoningToFormValues
 * - decisionMaking: parseDecisionMakingFromDoc, isSyllogismQuestionText, mapParsedDecisionMakingToFormValues
 */

export {
  collectLogicalLinesFromDoc,
  parseFromLines,
  type ParsedStem,
  type ParsedQuestion,
  type ParsedOption,
  type ParserConfig,
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
