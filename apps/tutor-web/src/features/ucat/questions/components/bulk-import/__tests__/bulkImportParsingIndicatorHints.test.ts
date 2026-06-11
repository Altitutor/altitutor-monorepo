import { describe, expect, it } from '@jest/globals'
import {
  detectAlternativeParsingIndicators,
  formatAlternativeParsingIndicatorHint,
} from '@/features/ucat/questions/components/bulk-import/bulkImportParsingIndicatorHints'
import type { ParsingOptions } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

const DEFAULT_OPTS: ParsingOptions = {
  questionIndicator: 'dot',
  answerOptionIndicator: 'paren',
  questionNumberOnOwnLine: false,
  answerOptionOnOwnLine: false,
  requireConsecutiveQuestionNumbers: true,
  decisionMakingQuestionNumberPlacement: 'question',
  quantitativeReasoningQuestionNumberPlacement: 'question',
}

describe('detectAlternativeParsingIndicators', () => {
  it('suggests paren question indicator when paste uses 1) format with dot selected', () => {
    const lines = ['1) What is the answer?', 'a) One', 'b) Two']
    const hints = detectAlternativeParsingIndicators(lines, DEFAULT_OPTS)
    expect(hints.questionIndicator).toBe('paren')
    expect(formatAlternativeParsingIndicatorHint(hints)).toMatch(/question indicator/)
  })

  it('suggests dot answer option indicator when paste uses a. format with paren selected', () => {
    const lines = ['1. Question text', 'a. First option', 'b. Second option']
    const hints = detectAlternativeParsingIndicators(lines, DEFAULT_OPTS)
    expect(hints.answerOptionIndicator).toBe('dot')
  })

  it('returns no hints when selected indicators already match', () => {
    const lines = ['1. Question text', 'a) First option', 'b) Second option']
    const hints = detectAlternativeParsingIndicators(lines, DEFAULT_OPTS)
    expect(hints.questionIndicator).toBeNull()
    expect(hints.answerOptionIndicator).toBeNull()
    expect(formatAlternativeParsingIndicatorHint(hints)).toBeNull()
  })
})
