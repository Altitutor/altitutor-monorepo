import {
  getVerbalReasoningTagPathsForQuestion,
  parseVerbalReasoningPlainText,
} from '../verbalReasoning'
import { parseQuestionsOnlyForSection } from '@/features/ucat/questions/components/bulk-import/bulkImportParseSection'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({}) as typeof fetch
})

function docFromLines(lines: string[]) {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  }
}

function stem(overrides: Partial<ParsedStem>): ParsedStem {
  return {
    stemText: '',
    questions: [],
    ...overrides,
  }
}

describe('parseVerbalReasoningPlainText', () => {
  it('keeps inline numbered prose inside the passage when option evidence belongs to later questions', () => {
    const input = `Prompt passage.
1. This is part of the passage rather than a question.
2. This is also part of the passage.

1. Which answer is best?
a) A
b) B
c) C`

    const stems = parseVerbalReasoningPlainText(input, { answerOptionIndicator: 'paren' })

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('2. This is also part of the passage.')
    expect(stems[0]?.questions).toHaveLength(1)
  })
})

describe('Verbal Reasoning metadata detection', () => {
  it('detects specific VR reading-skill tag paths', () => {
    const parsedStem = stem({
      stemText: 'Paragraph 1 describes the Marsden study. Paragraph 2 gives the later criticism.',
      questions: [
        {
          number: 1,
          text: 'Which statement is best supported across paragraphs 1 and 2?',
          options: [{ label: 'A', text: 'The criticism changed the interpretation.' }],
        },
      ],
    })

    expect(
      getVerbalReasoningTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual([
      ['Evidence handling', 'Cross-paragraph evidence'],
      ['Author and passage meaning', 'Argument support'],
    ])
  })

  it('detects no-keyword inference and wording traps without over-tagging detail retrieval', () => {
    const parsedStem = stem({
      stemText: 'The passage discusses an education policy and the reactions to it.',
      questions: [
        {
          number: 1,
          text: 'Which of the following statements is most likely to be true, but is not directly stated?',
          options: [{ label: 'A', text: 'The policy had mixed effects.' }],
        },
      ],
    })

    expect(
      getVerbalReasoningTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual([
      ['Evidence handling', 'Inference'],
      ['Question wording traps', 'Qualifiers'],
      ['Question wording traps', 'Negatives'],
      ['Question wording traps', 'No clear keyword'],
    ])
  })

  it('detects application-style new information questions', () => {
    const parsedStem = stem({
      stemText: 'The passage argues that the trial was limited by its small sample size.',
      questions: [
        {
          number: 1,
          text: 'If new evidence showed the sample was nationally representative, which option would most weaken the author\'s argument?',
          options: [{ label: 'A', text: 'The trial still lacked a control group.' }],
        },
      ],
    })

    expect(
      getVerbalReasoningTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual([
      ['Author and passage meaning', 'Argument support'],
      ['Question wording traps', 'Qualifiers'],
      ['Application', 'New information'],
      ['Application', 'Hypothetical application'],
    ])
  })
})

describe('parseQuestionsOnlyForSection', () => {
  it('parses questions without starting a new stem mid-document', () => {
    const questionsDoc = docFromLines([
      '1. Which statement follows?',
      'a) True',
      'b) False',
      "c) Can't Tell",
      'Accidental passage line',
      '2. Another question?',
      'a) True',
      'b) False',
      "c) Can't Tell",
    ])

    const { questions, stemLikeWarning } = parseQuestionsOnlyForSection(questionsDoc, 'verbal_reasoning', {
      questionIndicator: 'dot',
      answerOptionIndicator: 'paren',
      questionNumberOnOwnLine: false,
      answerOptionOnOwnLine: false,
      requireConsecutiveQuestionNumbers: true,
      decisionMakingQuestionNumberPlacement: 'question',
      quantitativeReasoningQuestionNumberPlacement: 'question',
    })

    expect(questions).toHaveLength(2)
    expect(stemLikeWarning).toBe(false)
  })
})
