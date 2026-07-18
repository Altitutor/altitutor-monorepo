import { embedPdfImageSource } from '@/features/ucat/shared/pdf/image-sources'

describe('embedPdfImageSource', () => {
  it('normalizes an inline SVG to an embedded PNG', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#204c63"/></svg>'
    const result = await embedPdfImageSource(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)

    expect(result).toMatch(/^data:image\/png;base64,iVBOR/)
  })
})
