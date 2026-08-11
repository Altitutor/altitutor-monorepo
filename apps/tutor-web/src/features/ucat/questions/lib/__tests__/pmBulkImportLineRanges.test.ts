/** @jest-environment jsdom */

import { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import StarterKit from '@tiptap/starter-kit'
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
})
