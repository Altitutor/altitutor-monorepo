import 'server-only'
import type { Json } from '@altitutor/shared'
import { generatedContentToProseMirror } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'

const GRAYSCALE = ['#111111', '#4b4b4b', '#737373', '#9b9b9b', '#c4c4c4', '#e0e0e0']

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasInlineVegaData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasInlineVegaData)
  if (!isRecord(value)) return false
  if (isRecord(value.data) && Array.isArray(value.data.values) && value.data.values.length > 0) return true
  if (isRecord(value.datasets) && Object.values(value.datasets).some((dataset) => Array.isArray(dataset) && dataset.length > 0)) return true
  return Object.values(value).some(hasInlineVegaData)
}

function grayscaleFor(value: unknown): string {
  const text = String(value ?? '')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  return GRAYSCALE[hash % GRAYSCALE.length] ?? '#111111'
}

function looksLikeColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.test(value) ||
    /^rgba?\(/iu.test(value) ||
    /^(?:red|green|blue|orange|purple|teal|cyan|magenta|yellow|pink|brown)$/iu.test(value)
}

function sanitizeVegaLiteValue(value: unknown, keyPath: string[] = []): unknown {
  if (Array.isArray(value)) {
    const parentKey = keyPath[keyPath.length - 1]?.toLowerCase()
    if (parentKey === 'range') return value.map((item, index) => typeof item === 'string' && looksLikeColor(item) ? GRAYSCALE[index % GRAYSCALE.length] : sanitizeVegaLiteValue(item, keyPath))
    return value.map((item, index) => sanitizeVegaLiteValue(item, [...keyPath, String(index)]))
  }
  if (!isRecord(value)) {
    const key = keyPath[keyPath.length - 1]?.toLowerCase() ?? ''
    if (typeof value === 'string' && /(color|fill|stroke)/u.test(key) && looksLikeColor(value)) return grayscaleFor(value)
    return value
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase()
    if (['url', 'href', 'src'].includes(lower) && typeof child === 'string' && child.trim()) {
      throw new Error('Vega-Lite chart specs must use inline data only.')
    }
    if (lower === 'scheme') continue
    sanitized[key] = sanitizeVegaLiteValue(child, [...keyPath, key])
  }
  return sanitized
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

function withVegaLiteDefaults(spec: Record<string, unknown>, title: string | null | undefined): Record<string, unknown> {
  const sanitized = sanitizeVegaLiteValue(spec)
  if (!isRecord(sanitized)) throw new Error('Vega-Lite chart spec must be an object.')
  if (!hasInlineVegaData(sanitized)) throw new Error('Vega-Lite chart spec must include inline data.')

  const width = numberInRange(sanitized.width, 580, 240, 780)
  const height = numberInRange(sanitized.height, 340, 180, 620)
  const config = isRecord(sanitized.config) ? sanitized.config : {}

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    background: 'white',
    ...(title && !sanitized.title ? { title } : {}),
    ...sanitized,
    width,
    height,
    config: {
      ...config,
      title: {
        font: 'Arial',
        fontSize: 20,
        fontWeight: 600,
        anchor: 'start',
        ...(isRecord(config.title) ? config.title : {}),
      },
      axis: {
        labelFont: 'Arial',
        titleFont: 'Arial',
        labelFontSize: 13,
        titleFontSize: 15,
        gridColor: '#d6d6d6',
        domainColor: '#111111',
        tickColor: '#111111',
        labelColor: '#111111',
        titleColor: '#111111',
        ...(isRecord(config.axis) ? config.axis : {}),
      },
      legend: {
        labelFont: 'Arial',
        titleFont: 'Arial',
        orient: 'bottom',
        labelColor: '#111111',
        titleColor: '#111111',
        symbolStrokeColor: '#111111',
        ...(isRecord(config.legend) ? config.legend : {}),
      },
      view: {
        stroke: null,
        ...(isRecord(config.view) ? config.view : {}),
      },
      range: {
        ...(isRecord(config.range) ? config.range : {}),
        category: GRAYSCALE,
        ordinal: GRAYSCALE,
      },
    },
  }
}

function cleanVegaSvg(svg: string): string {
  return svg
    .replace(/<style>[\s\S]*?<\/style>/gu, '')
    .replace(/font-family="[^"]*"/gu, 'font-family="Arial, sans-serif"')
}

async function renderVegaLiteChart(block: Extract<GeneratedContentBlock, { type: 'visual' }>): Promise<string> {
  const [{ compile }, { parse, View }] = await Promise.all([
    import('vega-lite'),
    import('vega'),
  ])
  const vlSpec = withVegaLiteDefaults(block.spec, block.title)
  const compiled = compile(vlSpec as never)
  const runtime = parse(compiled.spec)
  const view = new View(runtime, { renderer: 'none' })
  const svg = await view.toSVG()
  view.finalize()
  return cleanVegaSvg(svg)
}

async function renderServerBlock(block: GeneratedContentBlock): Promise<GeneratedContentBlock> {
  if (block.type !== 'visual' || block.visualType !== 'vega_lite_chart') return block
  const svg = await renderVegaLiteChart(block)
  return {
    type: 'image',
    src: svgDataUri(svg),
    altText: block.altText,
  }
}

export async function generatedContentToProseMirrorServer(value: string | GeneratedContentBlock[]): Promise<Json> {
  if (typeof value === 'string') return generatedContentToProseMirror(value)
  const blocks = await Promise.all(value.map(renderServerBlock))
  return generatedContentToProseMirror(blocks)
}
