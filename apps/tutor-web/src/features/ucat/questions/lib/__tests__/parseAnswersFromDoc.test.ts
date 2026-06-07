import { describe, expect, it } from '@jest/globals'
import { parseAnswersTableFromDoc } from '@/features/ucat/questions/lib/parseAnswersFromDoc'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

describe('parseAnswersTableFromDoc', () => {
  it('preserves bold formatting in table explanation cells', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }],
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', text: 'Because ' },
                        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                        { type: 'text', text: ' reason' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    const parsed = parseAnswersTableFromDoc(doc)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.letter).toBe('B')
    expect(proseMirrorToPlainText(parsed[0]?.explanationDoc)).toBe('Because bold reason')
    const paragraph = (parsed[0]?.explanationDoc as { content?: unknown[] })?.content?.[0] as {
      content?: Array<{ marks?: Array<{ type: string }> }>
    }
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe('bold')
  })

  it('preserves inline marks in paragraph TSV rows', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '1' },
            { type: 'text', text: '\t' },
            { type: 'text', text: 'C' },
            { type: 'text', text: '\t' },
            { type: 'text', text: 'Key ' },
            { type: 'text', text: 'term', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    }

    const parsed = parseAnswersTableFromDoc(doc)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.letter).toBe('C')
    const paragraph = (parsed[0]?.explanationDoc as { content?: unknown[] })?.content?.[0] as {
      content?: Array<{ text?: string; marks?: Array<{ type: string }> }>
    }
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe('italic')
  })

  it('preserves nested tables in explanation cells', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }],
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'table',
                      content: [
                        {
                          type: 'tableRow',
                          content: [
                            {
                              type: 'tableCell',
                              content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'Row 1' }] },
                              ],
                            },
                            {
                              type: 'tableCell',
                              content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'Value' }] },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    const parsed = parseAnswersTableFromDoc(doc)
    expect(parsed).toHaveLength(1)
    const explanationDoc = parsed[0]?.explanationDoc as { content?: Array<{ type?: string }> }
    expect(explanationDoc?.content?.[0]?.type).toBe('table')
    expect(proseMirrorToPlainText(parsed[0]?.explanationDoc)).toContain('Row 1')
  })
})
