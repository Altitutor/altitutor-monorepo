import {
  lessonAiRichTextToProseMirror,
  LessonAiRichTextResponseSchema,
} from '../lesson-ai'

describe('lesson AI rich text conversion', () => {
  it('converts headings, lists, emphasis, and tables into ProseMirror JSON', () => {
    const response = LessonAiRichTextResponseSchema.parse({
      blocks: [
        { type: 'heading', level: 3, text: 'Rate traps' },
        { type: 'paragraph', text: 'Convert **before** comparing _rates_.' },
        { type: 'bulletList', items: ['Match the units.', 'Then compare.'] },
        {
          type: 'table',
          rows: [
            ['Quantity', 'Common mistake'],
            ['km/h', 'Compared directly with m/s'],
          ],
        },
      ],
    })

    expect(lessonAiRichTextToProseMirror(response)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Rate traps' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Convert ' },
            { type: 'text', text: 'before', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' comparing ' },
            { type: 'text', text: 'rates', marks: [{ type: 'italic' }] },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Match the units.' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Then compare.' }] }],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quantity' }] }],
                },
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Common mistake' }] }],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'km/h' }] }],
                },
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Compared directly with m/s' }] }],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('converts simple HTML emphasis emitted inside AI text fields', () => {
    const response = LessonAiRichTextResponseSchema.parse({
      blocks: [
        {
          type: 'paragraph',
          text: 'Scan for <b>proper nouns</b> and <i>numbers</i>, then check &lt;strong&gt;every part&lt;/strong&gt;.',
        },
        {
          type: 'bulletList',
          items: ['<b>Names:</b> Rian Johnson', '<em>Titles:</em> The Last Jedi'],
        },
      ],
    })

    expect(lessonAiRichTextToProseMirror(response)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Scan for ' },
            { type: 'text', text: 'proper nouns', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'numbers', marks: [{ type: 'italic' }] },
            { type: 'text', text: ', then check ' },
            { type: 'text', text: 'every part', marks: [{ type: 'bold' }] },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Names:', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' Rian Johnson' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Titles:', marks: [{ type: 'italic' }] },
                    { type: 'text', text: ' The Last Jedi' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })
})
