import {
  splitStemDocumentFromDoc,
  splitStemDocumentLines,
  splitQuestionDocumentFromDoc,
  detectStemLikeContentInQuestionPaste,
} from '../splitStemDocument'
import { collectLogicalLinesFromDoc } from '../core'

describe('splitStemDocumentLines', () => {
  it('splits on keyword prefix and strips marker lines', () => {
    const lines = [
      'Intro ignored',
      'Prompt 1',
      'First passage about whales.',
      'Prompt 3',
      'Second passage about parliament.',
    ]
    const result = splitStemDocumentLines(lines, {
      mode: 'keyword',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toContain('whales')
    expect(result.stems[1]).toContain('parliament')
    expect(result.warnings.some((w) => w.includes('before the first marker'))).toBe(true)
    expect(result.discardedLineIndices.sort((a, b) => a - b)).toEqual([0, 1, 3])
    expect(result.discardedLineSpans).toEqual([])
  })

  it('treats document as one stem when line breaks never reach threshold', () => {
    const lines = ['Single long passage', 'with no blank gap', 'between paragraphs.']
    const result = splitStemDocumentLines(lines, {
      mode: 'line_breaks',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(1)
    expect(result.warnings.some((w) => w.includes('Only 1 stem'))).toBe(true)
  })

  it('splits on at least two consecutive blank lines (default threshold)', () => {
    const lines = [
      'First passage about whales.',
      'More from passage one.',
      '',
      '',
      'Second passage about parliament.',
    ]
    const result = splitStemDocumentLines(lines, {
      mode: 'line_breaks',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toContain('whales')
    expect(result.stems[1]).toContain('parliament')
    expect(result.splitLineIndices).toEqual([2])
    expect(result.discardedLineIndices).toEqual([2, 3])
  })

  it('splits when more than threshold consecutive blank lines are present', () => {
    const lines = ['Stem A', '', '', '', 'Stem B']
    const result = splitStemDocumentLines(lines, {
      mode: 'line_breaks',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toBe('Stem A')
    expect(result.stems[1]).toBe('Stem B')
  })

  it('does not split on a single blank line when threshold is 2', () => {
    const lines = ['Stem A', '', 'Stem B']
    const result = splitStemDocumentLines(lines, {
      mode: 'line_breaks',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(1)
  })

  it('splits on stem number markers at line start', () => {
    const lines = ['1.', 'First stem body.', '2.', 'Second stem body.']
    const result = splitStemDocumentLines(lines, {
      mode: 'stem_numbers',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toBe('First stem body.')
    expect(result.stems[1]).toBe('Second stem body.')
    expect(result.discardedLineIndices).toEqual([0, 2])
    expect(result.discardedLineSpans).toEqual([])
  })

  it('strikes only the marker prefix when remainder is on the same line', () => {
    const lines = ['Prompt 1 First passage.', 'Prompt 2 Second passage.']
    const result = splitStemDocumentLines(lines, {
      mode: 'keyword',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.discardedLineIndices).toEqual([])
    expect(
      result.discardedLineSpans.map((s) => ({
        ...s,
        line: lines[s.lineIndex],
      }))
    ).toEqual([
      { lineIndex: 0, start: 0, end: 9, line: 'Prompt 1 First passage.' },
      { lineIndex: 1, start: 0, end: 9, line: 'Prompt 2 Second passage.' },
    ])
  })

  it('splits on a compound keyword sequence and strips the following label', () => {
    const lines = [
      'Passage 1',
      'Questions 1 - 4',
      'First passage.',
      'Passage 2',
      'Questions 5 to 8',
      'Second passage.',
    ]
    const result = splitStemDocumentLines(lines, {
      mode: 'keyword',
      lineBreakThreshold: 2,
      keywordPrefix: 'Passage\nQuestions',
      stemNumberIndicator: 'dot',
    })

    expect(result.stems).toEqual(['First passage.', 'Second passage.'])
    expect(result.discardedLineIndices).toEqual([0, 1, 3, 4])
    expect(result.splitLineIndices).toEqual([0, 3])
  })

  it('does not require optional following labels to be present in every block', () => {
    const result = splitStemDocumentLines(['Passage 1', 'First.', 'Passage 2', 'Second.'], {
      mode: 'keyword',
      lineBreakThreshold: 2,
      keywordPrefix: 'Passage\nQuestions',
      stemNumberIndicator: 'dot',
    })

    expect(result.stems).toEqual(['First.', 'Second.'])
  })

  it('only splits on the configured stem number marker style', () => {
    const lines = ['1)', 'First stem body.', '2)', 'Second stem body.']
    const parenResult = splitStemDocumentLines(lines, {
      mode: 'stem_numbers',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'paren',
    })
    expect(parenResult.stems).toHaveLength(2)

    const dotResult = splitStemDocumentLines(lines, {
      mode: 'stem_numbers',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(dotResult.stems).toHaveLength(0)
    expect(dotResult.warnings.some((w) => w.includes('No stem markers found'))).toBe(true)
  })
})

describe('splitStemDocumentFromDoc', () => {
  it('preserves empty paragraphs as blank lines for line-break splitting', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Stem one.' }] },
        { type: 'paragraph' },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Stem two.' }] },
      ],
    }
    const result = splitStemDocumentFromDoc(doc, {
      mode: 'line_breaks',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
      stemNumberIndicator: 'dot',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toBe('Stem one.')
    expect(result.stems[1]).toBe('Stem two.')
  })
})

describe('splitQuestionDocumentFromDoc', () => {
  it('splits one questions document into parser-friendly documents', () => {
    const result = splitQuestionDocumentFromDoc(
      {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Passage 1' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Questions 1 - 2' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '1. First question?' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'a. Yes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'b. No' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Passage 2' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Questions 3 - 4' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '3. Second question?' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'a. Yes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'b. No' }] },
        ],
      },
      {
        mode: 'keyword',
        lineBreakThreshold: 2,
        keywordPrefix: 'Passage\nQuestions',
        stemNumberIndicator: 'dot',
      }
    )

    expect(result.documents).toHaveLength(2)
    expect(result.stems[0]).toContain('1. First question?')
    expect(result.stems[0]).not.toContain('Questions 1 - 2')
    expect(result.stems[1]).toContain('3. Second question?')
    expect(collectLogicalLinesFromDoc(result.documents[0])).toEqual([
      '1. First question?',
      'a. Yes',
      'b. No',
    ])
  })

  it('preserves ordered-list question numbers nested inside pasted tables', () => {
    const result = splitQuestionDocumentFromDoc(
      {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Passage 3' }] },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'orderedList',
                        attrs: { start: 9 },
                        content: [
                          {
                            type: 'listItem',
                            content: [{ type: 'paragraph' }],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Listed question?' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        mode: 'keyword',
        lineBreakThreshold: 2,
        keywordPrefix: 'Passage',
        stemNumberIndicator: 'dot',
      }
    )

    expect(collectLogicalLinesFromDoc(result.documents[0])).toEqual(['9. Listed question?'])
  })
})

describe('detectStemLikeContentInQuestionPaste', () => {
  it('flags prompt-like headers', () => {
    expect(detectStemLikeContentInQuestionPaste(['Prompt 2', '1. Question?'])).toBe(true)
    expect(detectStemLikeContentInQuestionPaste(['1. Question?', 'a) A'])).toBe(false)
  })
})
