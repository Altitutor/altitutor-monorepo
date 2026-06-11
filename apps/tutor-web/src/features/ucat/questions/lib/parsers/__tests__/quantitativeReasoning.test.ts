import {
  getQuantitativeReasoningStemCategoryName,
  getQuantitativeReasoningTagPathsForQuestion,
} from '@/features/ucat/questions/lib/parsers/quantitativeReasoning'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'

function stem(overrides: Partial<ParsedStem>): ParsedStem {
  return {
    stemText: '',
    questions: [],
    ...overrides,
  }
}

describe('Quantitative Reasoning metadata detection', () => {
  it('detects high-confidence table subtypes before generic tables', () => {
    expect(
      getQuantitativeReasoningStemCategoryName(
        stem({
          stemText:
            'Currency exchange rates for AUD, USD, and GBP are shown below.\n[[TABLE:t1]]',
        })
      )
    ).toBe('Currency Exchange Tables')
  })

  it('uses generic Tables for table placeholders without stronger text hints', () => {
    expect(
      getQuantitativeReasoningStemCategoryName(
        stem({
          stemText: 'The following data applies to questions 1-4.\n[[TABLE:t1]]',
        })
      )
    ).toBe('Tables')
  })

  it('does not guess visual categories from image-only stems', () => {
    expect(
      getQuantitativeReasoningStemCategoryName(
        stem({
          stemText: '[[IMG:f=abc]]',
        })
      )
    ).toBeNull()
  })

  it('returns only the most specific matching QR tag paths', () => {
    const parsedStem = stem({
      stemText: 'A shop applies a reverse percentage calculation.',
      questions: [
        {
          number: 1,
          text: 'What was the original price?',
          options: [{ label: 'A', text: '$80' }],
        },
      ],
    })

    expect(
      getQuantitativeReasoningTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual([['Percentages', 'Reverse percentages']])
  })

  it('allows parent tags when they are the best available match', () => {
    const parsedStem = stem({
      stemText: 'This question requires several steps using the table.',
      questions: [
        {
          number: 1,
          text: 'Which option is correct after the multi-step calculation?',
          options: [{ label: 'A', text: '10' }],
        },
      ],
    })

    expect(
      getQuantitativeReasoningTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual([['Multi-Step Calculations']])
  })
})
