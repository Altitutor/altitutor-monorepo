import 'server-only'
import type { Json } from '@altitutor/shared'
import { generatedContentToProseMirror } from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'

const GRAYSCALE = ['#111111', '#4b4b4b', '#737373', '#9b9b9b', '#c4c4c4', '#e0e0e0']
const FILL_GRAYSCALE = ['#4b4b4b', '#737373', '#9b9b9b', '#c4c4c4', '#e0e0e0']

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

function markType(mark: unknown): string | null {
  if (typeof mark === 'string') return mark.toLowerCase()
  if (!isRecord(mark)) return null
  return typeof mark.type === 'string' ? mark.type.toLowerCase() : null
}

function wrappedText(value: unknown, maxChars: number): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text.length <= maxChars) return text
  const words = text.split(/\s+/u)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length > 1 ? lines : text
}

function axisDefaults(axis: Record<string, unknown>, channel: string | null): Record<string, unknown> {
  const orient = typeof axis.orient === 'string' ? axis.orient.toLowerCase() : ''
  const isRightAxis = orient === 'right'
  const isY = channel === 'y' || channel === 'y2' || isRightAxis
  const isX = channel === 'x' || channel === 'x2'
  const title = wrappedText(axis.title, isY ? 22 : 34)
  const titleLineCount = Array.isArray(title) ? title.length : 1
  const titlePadding = isRightAxis ? 44 : isY ? 22 + Math.max(0, titleLineCount - 1) * 6 : 14

  return {
    ...axis,
    ...(title ? { title } : {}),
    labelPadding: axis.labelPadding ?? (isRightAxis ? 10 : 7),
    titlePadding: axis.titlePadding ?? titlePadding,
    labelLimit: axis.labelLimit ?? (isX ? 92 : 120),
    titleLimit: 1000,
    titleLineHeight: axis.titleLineHeight ?? 17,
    labelBound: axis.labelBound ?? true,
    labelFlush: axis.labelFlush ?? false,
    labelOverlap: axis.labelOverlap ?? (isX ? 'greedy' : true),
    ...(isX ? { labelAngle: -35 } : {}),
  }
}

function enhanceEncoding(encoding: Record<string, unknown>, currentMarkType: string | null): Record<string, unknown> {
  const enhanced: Record<string, unknown> = {}
  for (const [channel, value] of Object.entries(encoding)) {
    if (!isRecord(value)) {
      enhanced[channel] = value
      continue
    }

    const channelDefinition = { ...value }
    if (isRecord(channelDefinition.axis)) {
      channelDefinition.axis = axisDefaults(channelDefinition.axis, channel.toLowerCase())
    }
    if (isRecord(channelDefinition.legend)) {
      channelDefinition.legend = {
        labelLimit: 180,
        symbolLimit: 180,
        columns: 3,
        ...channelDefinition.legend,
      }
    }
    if (channel.toLowerCase() === 'color' && currentMarkType === 'line') {
      channelDefinition.scale = {
        ...(isRecord(channelDefinition.scale) ? channelDefinition.scale : {}),
        range: GRAYSCALE,
      }
    }
    if (channel.toLowerCase() === 'color' && currentMarkType !== 'line') {
      channelDefinition.scale = {
        ...(isRecord(channelDefinition.scale) ? channelDefinition.scale : {}),
        range: FILL_GRAYSCALE,
      }
    }
    enhanced[channel] = channelDefinition
  }
  return enhanced
}

function enhanceMark(mark: unknown): unknown {
  const type = markType(mark)
  if (!type) return mark
  const markObject = typeof mark === 'string' ? { type } : { ...(mark as Record<string, unknown>) }

  if (type === 'line') {
    return {
      stroke: '#111111',
      strokeWidth: 2.5,
      strokeDash: [6, 4],
      point: { filled: true, size: 58, fill: 'white', stroke: '#111111', strokeWidth: 1.8 },
      ...markObject,
    }
  }

  if (type === 'bar' || type === 'rect' || type === 'arc') {
    return {
      stroke: '#111111',
      strokeWidth: 0.6,
      opacity: 0.9,
      ...markObject,
    }
  }

  if (type === 'point' || type === 'circle' || type === 'square') {
    return {
      filled: true,
      size: 70,
      stroke: '#111111',
      strokeWidth: 1.4,
      ...markObject,
    }
  }

  return markObject
}

function hasRightAxis(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRightAxis)
  if (!isRecord(value)) return false
  if (isRecord(value.axis) && value.axis.orient === 'right') return true
  if (isRecord(value.resolve) && isRecord(value.resolve.scale) && value.resolve.scale.y === 'independent') return true
  return Object.values(value).some(hasRightAxis)
}

function enhanceVegaLiteSpec(value: unknown, currentMarkType: string | null = null): unknown {
  if (Array.isArray(value)) return value.map((item) => enhanceVegaLiteSpec(item, currentMarkType))
  if (!isRecord(value)) return value

  const ownMarkType = markType(value.mark) ?? currentMarkType
  const enhanced: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'mark') {
      enhanced[key] = enhanceMark(child)
    } else if (key === 'encoding' && isRecord(child)) {
      enhanced[key] = enhanceEncoding(child, ownMarkType)
    } else if (key === 'width') {
      enhanced[key] = numberInRange(child, 640, 520, 780)
    } else {
      enhanced[key] = enhanceVegaLiteSpec(child, ownMarkType)
    }
  }
  return enhanced
}

function withVegaLiteDefaults(spec: Record<string, unknown>, title: string | null | undefined): Record<string, unknown> {
  const sanitized = sanitizeVegaLiteValue(spec)
  if (!isRecord(sanitized)) throw new Error('Vega-Lite chart spec must be an object.')
  if (!hasInlineVegaData(sanitized)) throw new Error('Vega-Lite chart spec must include inline data.')

  const enhanced = enhanceVegaLiteSpec(sanitized)
  if (!isRecord(enhanced)) throw new Error('Vega-Lite chart spec must be an object.')

  const width = numberInRange(enhanced.width, 640, 520, 780)
  const height = numberInRange(sanitized.height, 340, 180, 620)
  const config = isRecord(enhanced.config) ? enhanced.config : {}
  const existingPadding = isRecord(enhanced.padding) ? enhanced.padding : null
  const padding = existingPadding ?? {
    left: 96,
    right: hasRightAxis(enhanced) ? 150 : 56,
    top: 28,
    bottom: 78,
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    background: 'white',
    ...(title && !enhanced.title ? { title } : {}),
    autosize: isRecord(enhanced.autosize)
      ? enhanced.autosize
      : { type: 'pad', contains: 'padding' },
    ...enhanced,
    width,
    height,
    padding,
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
        labelPadding: 7,
        titlePadding: 14,
        labelBound: true,
        labelFlush: false,
        ...(isRecord(config.axis) ? config.axis : {}),
      },
      legend: {
        labelFont: 'Arial',
        titleFont: 'Arial',
        orient: 'bottom',
        labelColor: '#111111',
        titleColor: '#111111',
        symbolStrokeColor: '#111111',
        symbolStrokeWidth: 1,
        columns: 3,
        ...(isRecord(config.legend) ? config.legend : {}),
      },
      view: {
        stroke: null,
        ...(isRecord(config.view) ? config.view : {}),
      },
      range: {
        ...(isRecord(config.range) ? config.range : {}),
        category: FILL_GRAYSCALE,
        ordinal: FILL_GRAYSCALE,
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
