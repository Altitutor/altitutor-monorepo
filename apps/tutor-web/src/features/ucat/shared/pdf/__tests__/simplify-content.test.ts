import type { Json } from '@altitutor/shared'
import { simplifyRichText } from '@/features/ucat/shared/pdf/simplify-content'

describe('simplifyRichText', () => {
  const rich: Json = {
    type: 'doc',
    content: [
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A\u00ad' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
            ],
          },
        ],
      },
      { type: 'image', attrs: { src: 'https://example.test/image.png', fileId: 'private-id' } },
    ],
  }

  it('normalizes complex content while retaining printable images', () => {
    const result = simplifyRichText(rich, true) as { content: Array<Record<string, unknown>> }

    expect(result.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'A  |  B' }],
    })
    expect(result.content[1]).toEqual({
      type: 'image',
      attrs: { src: 'https://example.test/image.png', alt: '' },
    })
  })

  it('can omit images for the final safe fallback', () => {
    const result = simplifyRichText(rich, false) as { content: Array<Record<string, unknown>> }
    expect(result.content).toHaveLength(1)
  })
})
