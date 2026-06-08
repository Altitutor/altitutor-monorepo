import { parseVerbalReasoningPlainText } from '../verbalReasoning'
import { parseQuestionsOnlyForSection } from '@/features/ucat/questions/components/bulk-import/bulkImportParseSection'

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
    })

    expect(questions).toHaveLength(2)
    expect(stemLikeWarning).toBe(false)
  })
})
