import { embedPdfImageSource } from '@/features/ucat/shared/pdf/image-sources'

describe('embedPdfImageSource', () => {
  it('normalizes an inline SVG to an embedded PNG', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#204c63"/></svg>'
    const result = await embedPdfImageSource(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)

    expect(result).toMatch(/^data:image\/png;base64,iVBOR/)
    const png = Buffer.from(result.split(',')[1], 'base64')
    expect(png.toString('ascii', 12, 16)).toBe('IHDR')
    expect(png.readUInt32BE(16)).toBe(40)
    expect(png.readUInt32BE(20)).toBe(20)
  })
  it('fits a large illustration within the PDF bounds without changing its aspect ratio', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2800" height="1400"><rect width="2800" height="1400" fill="#204c63"/></svg>'
    const result = await embedPdfImageSource(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    const png = Buffer.from(result.split(',')[1], 'base64')
    expect(png.toString('ascii', 12, 16)).toBe('IHDR')
    expect(png.readUInt32BE(16)).toBe(1400)
    expect(png.readUInt32BE(20)).toBe(700)
  })
})
