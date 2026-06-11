import {
  buildQuestionPasteSpansForLine,
  classifyParseLineRoles,
  collectLogicalLinesFromDoc,
  extractOptionLinesFromTable,
  mergeConsecutiveStemsWithSameText,
  parseFromLines,
} from '../core'
import { parseQuantitativeReasoningPlainText } from '../quantitativeReasoning'
import { parseVerbalReasoningPlainText } from '../verbalReasoning'

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({}) as typeof fetch
})

/** Paren-style options (a) b) c)) used in many UCAT paste fixtures. */
const PAREN_OPTION_CONFIG = {
  answerOptionIndicator: 'paren' as const,
}

/** Layout used when question numbers and A./B. options are each on their own line. */
const OWN_LINE_PARSER_CONFIG = {
  questionsOnly: true,
  questionNumberOnOwnLine: true,
  answerOptionOnOwnLine: true,
  answerOptionIndicator: 'dot' as const,
}

const MINACK_OWN_LINE_OPTIONS = `1.

According to the passage, for five months over the summer, the theatre:

A.

has a visitor centre.

B.

hosts shows of different styles.

C.

opens to the public.

D.

moves to being open air.

2.

According to the passage, the financial situation of the Minack theatre:

A.

has been continually challenged.

B.

has improved over time.

C.

is unsustainable going forward.

D.

was unsustainable in the past.`

describe('parseFromLines', () => {
  it('parses questions with number and option letters on their own lines (A. / B. layout)', () => {
    const stems = parseFromLines(MINACK_OWN_LINE_OPTIONS.split(/\r?\n/u), OWN_LINE_PARSER_CONFIG)

    expect(stems.flatMap((s) => s.questions)).toHaveLength(2)
    expect(stems[0]?.questions[0]?.options).toHaveLength(4)
    expect(stems[0]?.questions[0]?.text).toContain('five months over the summer')
    expect(stems[0]?.questions[1]?.options[0]?.text).toContain('continually challenged')
  })

  it('does not treat numbered passage lines as questions when another question candidate appears first', () => {
    const input = `A historical passage begins.
1. The author lists this as a passage point.
2. This is another passage point.

1. Which statement is supported?
a) First option
b) Second option
c) Third option`

    const stems = parseVerbalReasoningPlainText(input, PAREN_OPTION_CONFIG)

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

    const stems = parseFromLines(input.split(/\r?\n/u), PAREN_OPTION_CONFIG)

    expect(stems).toHaveLength(2)
    expect(stems[0]?.questions).toHaveLength(1)
    expect(stems[1]?.stemText).toContain('2024. This line belongs to the next setup')
    expect(stems[1]?.questions[0]?.number).toBe(2)
  })

  it('accepts non-consecutive question numbers when consecutive numbering is not required', () => {
    const input = `1. First question
a) opt A
b) opt B
4. Fourth question
a) opt C
b) opt D
2. Second question
a) opt E
b) opt F
88. Eighty-eighth question
a) opt G
b) opt H`

    const stems = parseFromLines(input.split(/\r?\n/u), {
      ...PAREN_OPTION_CONFIG,
      questionsOnly: true,
      enforceSequentialQuestionNumbers: false,
    })

    const numbers = stems.flatMap((s) => s.questions.map((q) => q.number))
    expect(numbers).toEqual([1, 4, 2, 88])
  })

  it('skips non-consecutive question numbers when consecutive numbering is required', () => {
    const input = `1. First question
a) opt A
b) opt B
4. Out of sequence — skipped
a) opt C
b) opt D
2. Next consecutive question
a) opt E
b) opt F
5. Out of sequence — skipped
a) opt G
b) opt H
3. Next consecutive question
a) opt I
b) opt J`

    const stems = parseFromLines(input.split(/\r?\n/u), {
      ...PAREN_OPTION_CONFIG,
      questionsOnly: true,
      enforceSequentialQuestionNumbers: true,
    })

    const numbers = stems.flatMap((s) => s.questions.map((q) => q.number))
    expect(numbers).toEqual([1, 2, 3])
  })

  it('parses ordered-list Prompt 2 with questions starting at 5', () => {
    const input = `1. Prompt 2
5.
Robert the Bruce went into hiding between 1306 and 1307.

A.
True

B.
False

C.
Can't Tell

6.
Robert the Bruce secured control of much of Scotland after a number of military victories.

A.
True

B.
False

C.
Can't Tell

7.
Peace was concluded between Scotland and England under the rule of Edward II.

A.
True

B.
False

C.
Can't Tell

8.
The re-establishment of an independent Scottish kingdom would not have occurred without the Battle of Bannockburn.

A.
True

B.
False

C.
Can't Tell`

    const stems = parseFromLines(input.split(/\r?\n/u), OWN_LINE_PARSER_CONFIG)
    const questions = stems.flatMap((s) => s.questions)

    expect(questions).toHaveLength(4)
    expect(questions.map((q) => q.number)).toEqual([5, 6, 7, 8])
  })

  it('does not treat ordered-list prompt labels as question 1 when questions start at 9', () => {
    const input = `1. Prompt 3
9.
George Huntington was the first doctor to develop a cure for Huntington's disease.

A.
True

B.
False

C.
Can't Tell

10.
White blood cells are cells that help the body resolve infection.

A.
True

B.
False

C.
Can't Tell

11.
Some other question text here.

A.
True

B.
False

C.
Can't Tell

12.
Another question text here.

A.
True

B.
False

C.
Can't Tell`

    const stems = parseFromLines(input.split(/\r?\n/u), OWN_LINE_PARSER_CONFIG)
    const questions = stems.flatMap((s) => s.questions)

    expect(questions).toHaveLength(4)
    expect(questions.map((q) => q.number)).toEqual([9, 10, 11, 12])
    expect(questions[0]?.text).toContain('George Huntington')
    expect(questions[0]?.number).not.toBe(1)
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

    expect(classifyParseLineRoles(lines, PAREN_OPTION_CONFIG)).toEqual([
      'stem',
      'stem',
      'stem',
      'question',
      'option',
      'option',
    ])
  })
})

describe('buildQuestionPasteSpansForLine', () => {
  it('highlights only inline question text, not the number marker', () => {
    const spans = buildQuestionPasteSpansForLine('1. What is the answer?', 'question', {
      questionIndicator: 'dot',
      answerOptionIndicator: 'paren',
      questionNumberOnOwnLine: false,
      answerOptionOnOwnLine: false,
    })
    expect(spans).toEqual([{ start: 3, end: 22, kind: 'question' }])
  })

  it('skips question-number-only lines when number is on its own line', () => {
    const spans = buildQuestionPasteSpansForLine('1.', 'question', {
      questionIndicator: 'dot',
      answerOptionIndicator: 'paren',
      questionNumberOnOwnLine: true,
      answerOptionOnOwnLine: false,
    })
    expect(spans).toEqual([])
  })

  it('highlights only inline option text, not the letter marker', () => {
    const spans = buildQuestionPasteSpansForLine('a) First option', 'option', {
      questionIndicator: 'dot',
      answerOptionIndicator: 'paren',
      questionNumberOnOwnLine: false,
      answerOptionOnOwnLine: false,
    })
    expect(spans).toEqual([{ start: 3, end: 15, kind: 'option' }])
  })

  it('returns no spans for stem lines', () => {
    expect(
      buildQuestionPasteSpansForLine('Passage text.', 'stem', {
        questionIndicator: 'dot',
        answerOptionIndicator: 'paren',
        questionNumberOnOwnLine: false,
        answerOptionOnOwnLine: false,
      })
    ).toEqual([])
  })
})

describe('table-backed question paste', () => {
  it('preserves dot-style option labels when extracting from options tables', () => {
    const rows = [
      ['A.', 'First option'],
      ['B.', 'Second option'],
      ['C.', 'Third option'],
    ]
    expect(extractOptionLinesFromTable(rows)).toEqual([
      'A. First option',
      'B. Second option',
      'C. Third option',
    ])
  })

  it('preserves paren-style option labels when extracting from options tables', () => {
    const rows = [
      ['a)', 'First option'],
      ['b)', 'Second option'],
      ['c)', 'Third option'],
    ]
    expect(extractOptionLinesFromTable(rows)).toEqual([
      'A) First option',
      'B) Second option',
      'C) Third option',
    ])
  })

  it('parses table-extracted dot options when dot indicator is selected', () => {
    const optionLines = extractOptionLinesFromTable([
      ['A.', 'Alpha'],
      ['B.', 'Beta'],
      ['C.', 'Gamma'],
    ])
    const stems = parseFromLines(['1. Which is correct?', ...optionLines], {
      questionsOnly: true,
      answerOptionIndicator: 'dot',
    })
    expect(stems[0]?.questions[0]?.options).toHaveLength(3)
    expect(stems[0]?.questions[0]?.options[0]?.text).toBe('Alpha')
  })

  it('collects lines from every non-empty table cell when nested question rows are absent', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Option A text' }] }],
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A.' }] }],
                },
              ],
            },
          ],
        },
      ],
    }

    expect(collectLogicalLinesFromDoc(doc, { detectNestedQuestionTables: true })).toEqual([
      'Option A text',
      'A.',
    ])
  })

  it('parses consecutive questions when option labels have no text on the following line', () => {
    const lines = [
      '5.',
      'Question five?',
      'A.',
      'B.',
      'C.',
      '6.',
      'Question six?',
      'A.',
      'B.',
      'C.',
    ]
    const stems = parseFromLines(lines, {
      questionsOnly: true,
      answerOptionIndicator: 'dot',
      questionIndicator: 'dot',
    })
    const questions = stems.flatMap((s) => s.questions)
    expect(questions).toHaveLength(2)
    expect(questions.map((q) => q.number)).toEqual([5, 6])
    expect(questions[0]?.options.map((o) => o.label)).toEqual(['A', 'B', 'C'])
    expect(questions[1]?.options.map((o) => o.label)).toEqual(['A', 'B', 'C'])
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

    const stems = parseQuantitativeReasoningPlainText(input, PAREN_OPTION_CONFIG)

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

    const stems = parseQuantitativeReasoningPlainText(input, PAREN_OPTION_CONFIG)

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
