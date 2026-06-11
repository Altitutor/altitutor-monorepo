import {
  getQuantitativeReasoningStemCategoryName,
  getQuantitativeReasoningTagPathsForQuestion,
  parseQuantitativeReasoningPlainText,
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

describe('Quantitative Reasoning item-stem numbering', () => {
  it('deduplicates consecutive repeated stems with question numbers before each stem', () => {
    const input = `1.
The table below depicts the income of the persons over the years.
[[IMG:f=img-1;s=https%3A%2F%2Fexample.com%2Fone.png]]
Compound interest = Principal x (1 + Rate of interest/100) number of years
What is the ratio between the total income of Charlie and Rahul for all the years?
A.
53 : 87
B.
87 : 53

2.
The table below depicts the income of the persons over the years.
[[IMG:f=img-2;s=https%3A%2F%2Fexample.com%2Ftwo.png]]
Compound interest = Principal x (1 + Rate of interest/100) number of years
Who achieved the maximum increase in income from 2011 to 2015?
A.
Nancy
B.
David`

    const stems = parseQuantitativeReasoningPlainText(input, {
      questionNumberPlacement: 'item_stem',
      answerOptionOnOwnLine: true,
    })

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('The table below depicts the income')
    expect(stems[0]?.stemText).toContain('[[IMG:f=img-1')
    expect(stems[0]?.questions).toHaveLength(2)
    expect(stems[0]?.questions.map((q) => q.number)).toEqual([1, 2])
    expect(stems[0]?.questions[0]?.text).toBe(
      'What is the ratio between the total income of Charlie and Rahul for all the years?'
    )
    expect(stems[0]?.questions[1]?.text).toBe(
      'Who achieved the maximum increase in income from 2011 to 2015?'
    )
  })

  it('keeps different consecutive stems separate in item-stem mode', () => {
    const input = `1.
First repeated data setup.
What is A?
A.
1
B.
2

2.
Second different data setup.
What is B?
A.
3
B.
4`

    const stems = parseQuantitativeReasoningPlainText(input, {
      questionNumberPlacement: 'item_stem',
      answerOptionOnOwnLine: true,
    })

    expect(stems).toHaveLength(2)
    expect(stems[0]?.stemText).toBe('First repeated data setup.')
    expect(stems[1]?.stemText).toBe('Second different data setup.')
  })
})
