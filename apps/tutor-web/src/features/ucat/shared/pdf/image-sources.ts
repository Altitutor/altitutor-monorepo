import sharp from 'sharp'

const MAX_SOURCE_BYTES = 20 * 1024 * 1024

function dataUrlBytes(source: string): Buffer {
  const match = source.match(/^data:([^;,]+)?((?:;[^,]*)*),([\s\S]*)$/u)
  if (!match) throw new Error('Invalid embedded image data')
  const metadata = match[2] ?? ''
  const payload = match[3] ?? ''
  return metadata.includes(';base64')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
}

async function sourceBytes(source: string): Promise<Buffer> {
  if (source.startsWith('data:image/')) return dataUrlBytes(source)

  const response = await fetch(source, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Image request failed with status ${response.status}`)
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_SOURCE_BYTES) throw new Error('Image is too large to export')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('Image is too large to export')
  return bytes
}

/** Converts supported raster/vector sources to an in-memory PNG for deterministic PDF rendering. */
export async function embedPdfImageSource(source: string): Promise<string> {
  const png = await sharp(await sourceBytes(source), { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1400, height: 1800, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}
