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
  it('detects table-only stems as data tables', () => {
    expect(
      getQuantitativeReasoningStemCategoryName(
        stem({
          stemText:
            'Currency exchange rates for AUD, USD, and GBP are shown below.\n[[TABLE:t1]]',
        })
      )
    ).toBe('Data Tables')
  })

  it('detects mixed stems when table and diagram evidence are both present', () => {
    expect(
      getQuantitativeReasoningStemCategoryName(
        stem({
          stemText:
            'The following table shows car sales.\n[[TABLE:t1]]\nThe following diagram represents the lot sizes.',
        })
      )
    ).toBe('Mixed Data Sources')
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

  it('detects text-only stems when no structured presentation is present', () => {
    expect(
      getQuantitativeReasoningStemCategoryName(
        stem({
          stemText: 'A train moving at a speed of 72mph takes 50 seconds to pass a post.',
        })
      )
    ).toBe('Text-Only Scenarios')
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

  it('uses the repeated common prefix as the stem when QR questions span multiple lines', () => {
    const input = `1.
The table below depicts the income of the persons over the years.
[[IMG:f=img-1;s=https%3A%2F%2Fexample.com%2Fone.png]]
Compound interest = Principal x (1 + Rate of interest/100) number of years
If the percentage growth of sales for Car A between May and July
is equal to the percentage growth between November and January, how many were sold?
A.
120
B.
160

2.
The table below depicts the income of the persons over the years.
[[IMG:f=img-2;s=https%3A%2F%2Fexample.com%2Ftwo.png]]
Compound interest = Principal x (1 + Rate of interest/100) number of years
In March, a marketing campaign increased the total sales by 25%.
How many additional cars were sold?
A.
40
B.
50`

    const stems = parseQuantitativeReasoningPlainText(input, {
      questionNumberPlacement: 'item_stem',
      answerOptionOnOwnLine: true,
    })

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toBe(
      [
        'The table below depicts the income of the persons over the years.',
        '[[IMG:f=img-1;s=https%3A%2F%2Fexample.com%2Fone.png]]',
        'Compound interest = Principal x (1 + Rate of interest/100) number of years',
      ].join('\n')
    )
    expect(stems[0]?.questions).toHaveLength(2)
    expect(stems[0]?.questions[0]?.text).toBe(
      [
        'If the percentage growth of sales for Car A between May and July',
        'is equal to the percentage growth between November and January, how many were sold?',
      ].join('\n')
    )
    expect(stems[0]?.questions[1]?.text).toBe(
      [
        'In March, a marketing campaign increased the total sales by 25%.',
        'How many additional cars were sold?',
      ].join('\n')
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

  it('keeps consecutive standalone QR items separate when they do not share a repeated stem', () => {
    const input = `29.
John is twice as efficient as Mark. Alice can type 20% fewer pages in an hour than Mark and John combined.
If Mark can type 4 pages in an hour, how much time will Alice take to type 25 pages?
A.
111.75 minutes
B.
125 minutes

30.
The average age of 11 students in a class is 12 and their teacher's age is 24. In two year's time, what will be the average age of all of them together?
A.
15.17
B.
17

31.
A person spends half his income and saves the remaining half. If his expenses increase by 20%, by what percentage will his savings reduce?
A.
25%
B.
20%

32.
A towel when bleached lost 20% of its length and 10% of its breadth. What is the percentage decrease in its area?
A.
30%
B.
16%`

    const stems = parseQuantitativeReasoningPlainText(input, {
      questionNumberPlacement: 'item_stem',
      answerOptionOnOwnLine: true,
    })

    expect(stems).toHaveLength(4)
    expect(stems.map((stem) => stem.questions[0]?.number)).toEqual([29, 30, 31, 32])
    expect(stems[0]?.stemText).toBe(
      'John is twice as efficient as Mark. Alice can type 20% fewer pages in an hour than Mark and John combined.'
    )
    expect(stems[0]?.questions[0]?.text).toBe(
      'If Mark can type 4 pages in an hour, how much time will Alice take to type 25 pages?'
    )
    expect(stems[1]?.stemText).toBe(
      "The average age of 11 students in a class is 12 and their teacher's age is 24."
    )
    expect(stems[1]?.questions[0]?.text).toBe(
      "In two year's time, what will be the average age of all of them together?"
    )
    expect(stems[2]?.stemText).toBe(
      'A person spends half his income and saves the remaining half.'
    )
    expect(stems[2]?.questions[0]?.text).toBe(
      'If his expenses increase by 20%, by what percentage will his savings reduce?'
    )
    expect(stems[3]?.stemText).toBe(
      'A towel when bleached lost 20% of its length and 10% of its breadth.'
    )
    expect(stems[3]?.questions[0]?.text).toBe('What is the percentage decrease in its area?')
  })
})
