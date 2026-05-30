import {
  classifyParseLineRoles,
  mergeConsecutiveStemsWithSameText,
  parseFromLines,
} from '../core'
import { parseQuantitativeReasoningPlainText } from '../quantitativeReasoning'
import { parseVerbalReasoningPlainText } from '../verbalReasoning'

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({}) as typeof fetch
})

describe('parseFromLines', () => {
  it('does not treat numbered passage lines as questions when another question candidate appears first', () => {
    const input = `A historical passage begins.
1. The author lists this as a passage point.
2. This is another passage point.

1. Which statement is supported?
a) First option
b) Second option
c) Third option`

    const stems = parseVerbalReasoningPlainText(input)

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('1. The author lists this as a passage point.')
    expect(stems[0]?.stemText).toContain('2. This is another passage point.')
    expect(stems[0]?.questions).toHaveLength(1)
    expect(stems[0]?.questions[0]?.number).toBe(1)
  })

  it('does not treat out-of-sequence numeric prose after options as a new question', () => {
    const input = `A QR setup.

1. What is the value?
a) 10
b) 20
c) 30
2024. This line belongs to the next setup, not the question list.

2. What is the next value?
a) 11
b) 21
c) 31`

    const stems = parseFromLines(input.split(/\r?\n/u))

    expect(stems).toHaveLength(2)
    expect(stems[0]?.questions).toHaveLength(1)
    expect(stems[1]?.stemText).toContain('2024. This line belongs to the next setup')
    expect(stems[1]?.questions[0]?.number).toBe(2)
  })

  it('keeps live highlight classification aligned with conservative question detection', () => {
    const lines = [
      'Passage.',
      '1. Numbered prose.',
      '2. More numbered prose.',
      '1. Real question?',
      'a) Yes',
      'b) No',
    ]

    expect(classifyParseLineRoles(lines)).toEqual([
      'stem',
      'stem',
      'stem',
      'question',
      'option',
      'option',
    ])
  })
})

describe('mergeConsecutiveStemsWithSameText', () => {
  it('merges consecutive repeated QR stems into one stem with multiple questions', () => {
    const input = `Table 1
[[TABLE:t1]]

1. What is A?
a) 1
b) 2
c) 3

Table 1
[[TABLE:t2]]

2. What is B?
a) 4
b) 5
c) 6`

    const stems = parseQuantitativeReasoningPlainText(input)

    expect(stems).toHaveLength(1)
    expect(stems[0]?.questions).toHaveLength(2)
    expect(stems[0]?.questions.map((q) => q.number)).toEqual([1, 2])
  })

  it('allows long QR table content between a question number and options', () => {
    const tableRows = Array.from({ length: 60 }, (_, i) => `Table row ${i + 1}`).join('\n')
    const input = `Shared QR setup

1. The table below shows production values.
${tableRows}
What is the total for A?
a) 10
b) 20
c) 30`

    const stems = parseQuantitativeReasoningPlainText(input)

    expect(stems).toHaveLength(1)
    expect(stems[0]?.questions).toHaveLength(1)
    expect(stems[0]?.questions[0]?.text).toContain('Table row 60')
    expect(stems[0]?.questions[0]?.options).toHaveLength(3)
  })

  it('does not merge different consecutive stems', () => {
    const stems = mergeConsecutiveStemsWithSameText([
      { stemText: 'First table', questions: [{ number: 1, text: 'Q1', options: [] }] },
      { stemText: 'Second table', questions: [{ number: 2, text: 'Q2', options: [] }] },
    ])

    expect(stems).toHaveLength(2)
  })
})
