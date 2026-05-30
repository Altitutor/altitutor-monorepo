import {
  parseVerbalReasoningPlainText,
  parseVerbalReasoningWithSeparateStemDoc,
} from '../verbalReasoning'

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

describe('parseVerbalReasoningWithSeparateStemDoc', () => {
  it('pairs Prompt N stem blocks with parsed question groups by order', () => {
    const stemsDoc = docFromLines([
      'VR - Mock 7',
      'Prompt 1',
      'The first passage is about whale markings.',
      'It has numbered facts such as 1. dorsal fin shape.',
      'Prompt 2',
      'The second passage is about parliamentary procedure.',
    ])
    const questionsDoc = docFromLines([
      '1. Which statement follows from the passage?',
      'a) True',
      'b) False',
      "c) Can't Tell",
      '',
      '2. The author would most likely agree that...',
      'a) True',
      'b) False',
      "c) Can't Tell",
      '',
      '3. Which statement follows from the passage?',
      'a) True',
      'b) False',
      "c) Can't Tell",
      '',
      '4. The author would most likely agree that...',
      'a) True',
      'b) False',
      "c) Can't Tell",
    ])

    const stems = parseVerbalReasoningWithSeparateStemDoc(questionsDoc, stemsDoc)

    expect(stems).toHaveLength(2)
    expect(stems[0]?.stemText).toContain('whale markings')
    expect(stems[0]?.questions.map((q) => q.number)).toEqual([1, 2])
    expect(stems[1]?.stemText).toContain('parliamentary procedure')
    expect(stems[1]?.questions.map((q) => q.number)).toEqual([3, 4])
  })

  it('replaces parsed stem text when question document already contains grouped stems', () => {
    const stemsDoc = docFromLines([
      'Prompt 1',
      'Canonical first passage.',
      'Prompt 2',
      'Canonical second passage.',
    ])
    const questionsDoc = docFromLines([
      'Old first passage.',
      '1. Question one?',
      'a) A',
      'b) B',
      'c) C',
      'Old second passage.',
      '2. Question two?',
      'a) A',
      'b) B',
      'c) C',
    ])

    const stems = parseVerbalReasoningWithSeparateStemDoc(questionsDoc, stemsDoc)

    expect(stems).toHaveLength(2)
    expect(stems[0]?.stemText).toBe('Canonical first passage.')
    expect(stems[1]?.stemText).toBe('Canonical second passage.')
  })
})

describe('parseVerbalReasoningPlainText', () => {
  it('keeps inline numbered prose inside the passage when option evidence belongs to later questions', () => {
    const input = `Prompt passage.
1. This is part of the passage rather than a question.
2. This is also part of the passage.

1. Which answer is best?
a) A
b) B
c) C`

    const stems = parseVerbalReasoningPlainText(input)

    expect(stems).toHaveLength(1)
    expect(stems[0]?.stemText).toContain('2. This is also part of the passage.')
    expect(stems[0]?.questions).toHaveLength(1)
  })
})
