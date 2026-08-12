/** @jest-environment jsdom */

import { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
import { collectQuestionLineTextRanges } from '@/features/ucat/questions/lib/pmBulkImportLineRanges'
import { createUcatParseHighlight } from '@/features/ucat/shared/ucatParseHighlightPlugin'

describe('bulk-import ProseMirror line ranges', () => {
  it('keeps parse-highlight ranges valid when a block image is inserted', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        StarterKit,
        Image,
        createUcatParseHighlight(() => ({
          mode: 'question',
          section: 'decision_making',
          classify: {
            questionIndicator: 'dot',
            answerOptionIndicator: 'dot',
            questionNumberOnOwnLine: false,
            answerOptionOnOwnLine: false,
            enforceSequentialQuestionNumbers: false,
          },
        })),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '1. Question one' }] },
        ],
      },
    })

    expect(() => {
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.doc.content.size, {
          type: 'image',
          attrs: { src: 'https://example.test/image.png' },
        })
        .run()
    }).not.toThrow()

    editor.destroy()
  })

  it('still maps a highlight range when the whole question-text line is bold', () => {
    const classify = {
      questionIndicator: 'dot' as const,
      answerOptionIndicator: 'dot' as const,
      questionNumberOnOwnLine: true,
      answerOptionOnOwnLine: true,
      enforceSequentialQuestionNumbers: false,
    }
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [
        StarterKit,
        createUcatParseHighlight(() => ({
          mode: 'question',
          section: 'decision_making',
          classify,
        })),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Anika announces to her friends that she is expecting another baby. She has two sons',
              },
            ],
          },
          { type: 'paragraph', content: [{ type: 'text', text: '1.' }] },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'She says that the probability that her next baby will be a boy is 50%. Is she correct?',
                marks: [{ type: 'bold' }],
              },
            ],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'a)' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Yes, the outcome of each birth is independent' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'b)' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'No, the probability is greater than 50%' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'c)' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'No, the probability is less than 50%' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'd)' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'No, there is not enough information' }],
          },
        ],
      },
    })

    const ranges = collectQuestionLineTextRanges(editor.state.doc, 'decision_making', {
      parsingOptions: classify,
    })
    expect(ranges).not.toBeNull()

    const boldQuestion =
      'She says that the probability that her next baby will be a boy is 50%. Is she correct?'
    const boldRange = ranges!.find((range) => {
      if (!range) return false
      return editor.state.doc.textBetween(range.from, range.to) === boldQuestion
    })
    expect(boldRange).toEqual(
      expect.objectContaining({ from: expect.any(Number), to: expect.any(Number) })
    )
    expect(boldRange!.from).toBeLessThan(boldRange!.to)

    editor.destroy()
  })
})
