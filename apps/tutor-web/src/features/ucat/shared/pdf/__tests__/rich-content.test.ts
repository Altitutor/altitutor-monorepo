import { hasRichContent } from '@/features/ucat/shared/pdf/rich-content'
import type { Json } from '@altitutor/shared'

const doc = (content: Json[]) => ({ type: 'doc', content })

describe('hasRichContent', () => {
  it('recognises nested printable text', () => {
    expect(
      hasRichContent(
        doc([
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Printable' }] }],
              },
            ],
          },
        ]),
      ),
    ).toBe(true)
  })

  it('recognises printable images', () => {
    expect(hasRichContent(doc([{ type: 'image', attrs: { src: 'https://example.test/image.png' } }]))).toBe(true)
  })

  it('rejects empty documents', () => {
    expect(hasRichContent(doc([{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }]))).toBe(false)
    expect(hasRichContent(null)).toBe(false)
  })
})
