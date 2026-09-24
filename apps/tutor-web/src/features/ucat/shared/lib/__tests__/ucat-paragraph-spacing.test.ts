import { expandParagraphBreaksInDoc } from '@/features/ucat/shared/lib/ucat-paragraph-spacing'

describe('expandParagraphBreaksInDoc', () => {
  it('splits a paragraph at hard breaks into separate paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First paragraph.' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Second paragraph.' },
          ],
        },
      ],
    }

    const expanded = expandParagraphBreaksInDoc(doc)
    expect(expanded).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
      ],
    })
  })

  it('splits a paragraph at newline characters in text nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph.\nSecond paragraph.' }],
        },
      ],
    }

    const expanded = expandParagraphBreaksInDoc(doc)
    expect(expanded).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
      ],
    })
  })

  it('leaves already-separated paragraphs unchanged', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
      ],
    }

    expect(expandParagraphBreaksInDoc(doc)).toEqual(doc)
  })
})
