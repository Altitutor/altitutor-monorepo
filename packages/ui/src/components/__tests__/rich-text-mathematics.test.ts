/**
 * @jest-environment jsdom
 */

import { Editor } from '@tiptap/core'
import { Mathematics } from '@tiptap/extension-mathematics'
import StarterKit from '@tiptap/starter-kit'

describe('Rich-text mathematics', () => {
  it('renders inline and block mathematics through KaTeX', () => {
    const element = document.createElement('div')
    const editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Mathematics.configure({
          katexOptions: { throwOnError: false },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Inline: ' },
              { type: 'inlineMath', attrs: { latex: 'x^2' } },
            ],
          },
          {
            type: 'blockMath',
            attrs: { latex: '\\frac{30 - 30}{30} \\times 100 = 0\\%' },
          },
        ],
      },
    })

    expect(element.querySelectorAll('.katex')).toHaveLength(2)
    expect(element.textContent).toContain('x2')
    expect(element.textContent).toContain('100')

    editor.destroy()
  })
})
