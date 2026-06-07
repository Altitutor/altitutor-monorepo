import {
  splitStemDocumentLines,
  detectStemLikeContentInQuestionPaste,
} from '../splitStemDocument'

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
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toContain('whales')
    expect(result.stems[1]).toContain('parliament')
    expect(result.warnings.some((w) => w.includes('before the first marker'))).toBe(true)
  })

  it('treats document as one stem when line breaks never reach threshold', () => {
    const lines = ['Single long passage', 'with no blank gap', 'between paragraphs.']
    const result = splitStemDocumentLines(lines, {
      mode: 'line_breaks',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
    })
    expect(result.stems).toHaveLength(1)
    expect(result.warnings.some((w) => w.includes('Only 1 stem'))).toBe(true)
  })

  it('splits on stem number markers at line start', () => {
    const lines = ['1.', 'First stem body.', '2.', 'Second stem body.']
    const result = splitStemDocumentLines(lines, {
      mode: 'stem_numbers',
      lineBreakThreshold: 2,
      keywordPrefix: 'Prompt',
    })
    expect(result.stems).toHaveLength(2)
    expect(result.stems[0]).toBe('First stem body.')
    expect(result.stems[1]).toBe('Second stem body.')
  })
})

describe('detectStemLikeContentInQuestionPaste', () => {
  it('flags prompt-like headers', () => {
    expect(detectStemLikeContentInQuestionPaste(['Prompt 2', '1. Question?'])).toBe(true)
    expect(detectStemLikeContentInQuestionPaste(['1. Question?', 'a) A'])).toBe(false)
  })
})
