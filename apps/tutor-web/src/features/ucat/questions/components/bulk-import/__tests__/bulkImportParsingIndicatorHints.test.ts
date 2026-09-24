import { describe, expect, it } from '@jest/globals'
import {
  detectAlternativeParsingIndicators,
  formatAlternativeParsingIndicatorHint,
  inferParsingIndicators,
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

describe('inferParsingIndicators', () => {
  it('infers paren question and paren answer indicators from majority matches', () => {
    const lines = [
      '1) First question?',
      'a) One',
      'b) Two',
      '2) Second question?',
      'a) Yes',
      'b) No',
    ]
    expect(inferParsingIndicators(lines)).toEqual({
      questionIndicator: 'paren',
      answerOptionIndicator: 'paren',
    })
  })

  it('infers dot question and dot answer indicators', () => {
    const lines = [
      '1. First question?',
      'a. One',
      'b. Two',
      '2. Second question?',
      'a. Yes',
      'b. No',
    ]
    expect(inferParsingIndicators(lines)).toEqual({
      questionIndicator: 'dot',
      answerOptionIndicator: 'dot',
    })
  })

  it('returns null when there is no clear majority', () => {
    expect(inferParsingIndicators(['Just a passage with no markers.'])).toEqual({
      questionIndicator: null,
      answerOptionIndicator: null,
    })
  })

  it('returns null on ties between indicator styles', () => {
    const lines = ['1. Dot question?', '2) Paren question?']
    expect(inferParsingIndicators(lines).questionIndicator).toBeNull()
  })
})
