import 'server-only'
import type { Json } from '@altitutor/shared'
import {
  generatedContentToProseMirror,
  generatedVisualImageNode,
} from '@/features/ucat/questions/lib/ai-generation/content-blocks'
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

function sanitizeVegaLiteValue(value: unknown, keyPath: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeVegaLiteValue(item, [...keyPath, String(index)]))
  }
  if (!isRecord(value)) {
    return value
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase()
    if (['url', 'href', 'src'].includes(lower) && typeof child === 'string' && child.trim()) {
      throw new Error('Vega-Lite chart specs must use inline data only.')
    }
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

function hasEncodingChannel(encoding: unknown, channels: string[]): boolean {
  if (!isRecord(encoding)) return false
  return channels.some((channel) => Object.hasOwn(encoding, channel) && encoding[channel] !== null)
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
  const titlePadding = isRightAxis ? 72 : isY ? 28 + Math.max(0, titleLineCount - 1) * 8 : 18

  return {
    ...axis,
    ...(title ? { title } : {}),
    labelPadding: axis.labelPadding ?? (isRightAxis ? 16 : 8),
    titlePadding: axis.titlePadding ?? titlePadding,
    labelLimit: axis.labelLimit ?? (isX ? 150 : 150),
    titleLimit: 1000,
    titleLineHeight: axis.titleLineHeight ?? 18,
    labelBound: axis.labelBound ?? true,
    labelFlush: axis.labelFlush ?? false,
    labelOverlap: axis.labelOverlap ?? (isX ? 'greedy' : true),
    ...(isX ? { labelAngle: axis.labelAngle ?? -35 } : {}),
  }
}

function enhanceEncoding(encoding: Record<string, unknown>): Record<string, unknown> {
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
    if (['color', 'fill', 'stroke'].includes(channel.toLowerCase()) && channelDefinition.scale !== null) {
      const existingScale = isRecord(channelDefinition.scale) ? channelDefinition.scale : {}
      channelDefinition.scale = {
        ...existingScale,
        ...(!Array.isArray(existingScale.range) && typeof existingScale.scheme !== 'string' ? { range: GRAYSCALE } : {}),
      }
    }
    enhanced[channel] = channelDefinition
  }
  return enhanced
}

function axisIsHidden(channel: unknown): boolean {
  return isRecord(channel) && channel.axis === null
}

function lineMarkShouldBeDashed(encoding: unknown): boolean {
  if (!isRecord(encoding)) return true
  const xAxisHidden = axisIsHidden(encoding.x)
  const yAxisHidden = axisIsHidden(encoding.y)
  return !(xAxisHidden && yAxisHidden)
}

function enhanceMark(mark: unknown, encoding: unknown = null): unknown {
  const type = markType(mark)
  if (!type) return mark
  const markObject: Record<string, unknown> = typeof mark === 'string' ? { type } : { ...(mark as Record<string, unknown>) }

  if (type === 'line') {
    const encodedStroke = hasEncodingChannel(encoding, ['color', 'stroke'])
    const styledMark = { ...markObject }
    if (encodedStroke) {
      delete styledMark.color
      delete styledMark.stroke
    }
    return {
      ...styledMark,
      ...(!encodedStroke ? { stroke: markObject.stroke ?? '#111111' } : {}),
      strokeWidth: markObject.strokeWidth ?? 3,
      ...(lineMarkShouldBeDashed(encoding) ? { strokeDash: markObject.strokeDash ?? [6, 4] } : {}),
      point: encodedStroke
        ? { filled: true, size: 74, strokeWidth: 2 }
        : { filled: true, size: 74, fill: 'white', stroke: '#111111', strokeWidth: 2 },
    }
  }

  if (type === 'bar' || type === 'rect' || type === 'arc') {
    const encodedFill = hasEncodingChannel(encoding, ['color', 'fill'])
    const encodedStroke = hasEncodingChannel(encoding, ['stroke'])
    const styledMark = { ...markObject }
    if (encodedFill) {
      delete styledMark.color
      delete styledMark.fill
    }
    if (encodedStroke) delete styledMark.stroke
    return {
      ...styledMark,
      ...(!encodedFill ? { fill: markObject.fill ?? '#737373' } : {}),
      ...(!encodedStroke ? { stroke: markObject.stroke ?? '#111111' } : {}),
      strokeWidth: markObject.strokeWidth ?? 0.6,
      opacity: markObject.opacity ?? 0.9,
    }
  }

  if (type === 'point' || type === 'circle' || type === 'square') {
    const encodedFill = hasEncodingChannel(encoding, ['color', 'fill'])
    const encodedStroke = hasEncodingChannel(encoding, ['stroke'])
    const styledMark = { ...markObject }
    if (encodedFill) {
      delete styledMark.color
      delete styledMark.fill
    }
    if (encodedStroke) delete styledMark.stroke
    return {
      ...styledMark,
      filled: markObject.filled ?? true,
      size: markObject.size ?? 70,
      ...(!encodedFill ? { fill: markObject.fill ?? 'white' } : {}),
      ...(!encodedStroke ? { stroke: markObject.stroke ?? '#111111' } : {}),
      strokeWidth: markObject.strokeWidth ?? 1.4,
    }
  }

  if (type === 'text') {
    const styledMark: Record<string, unknown> = {
      ...markObject,
      fill: markObject.fill ?? markObject.color ?? '#111111',
      font: markObject.font ?? 'Arial',
      fontSize: markObject.fontSize ?? 14,
      fontWeight: markObject.fontWeight ?? 500,
    }
    delete styledMark.stroke
    delete styledMark.strokeWidth
    return styledMark
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

function normalizedPadding(value: unknown, needsRightAxis: boolean): Record<string, number> {
  const existing = isRecord(value) ? value : {}
  return {
    left: Math.max(numberInRange(existing.left, 104, 80, 180), 104),
    right: Math.max(numberInRange(existing.right, needsRightAxis ? 220 : 72, 56, 280), needsRightAxis ? 220 : 72),
    top: Math.max(numberInRange(existing.top, 34, 18, 100), 34),
    bottom: Math.max(numberInRange(existing.bottom, 96, 64, 160), 96),
  }
}

function normalizeIndependentYLayerAxes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeIndependentYLayerAxes)
  if (!isRecord(value)) return value

  const normalized: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    normalized[key] = normalizeIndependentYLayerAxes(child)
  }

  const hasIndependentY = isRecord(normalized.resolve) &&
    isRecord(normalized.resolve.scale) &&
    normalized.resolve.scale.y === 'independent'
  if (!hasIndependentY || !Array.isArray(normalized.layer)) return normalized

  let leftAxisAssigned = false
  let rightAxisAssigned = false
  normalized.layer = normalized.layer.map((child) => {
    if (!isRecord(child) || !isRecord(child.encoding) || !isRecord(child.encoding.y)) return child
    const childMarkType = markType(child.mark)
    const encoding = { ...child.encoding }
    const y = { ...child.encoding.y }
    const existingAxis = isRecord(y.axis) ? y.axis : {}
    if (childMarkType === 'text') {
      y.axis = null
    } else if (childMarkType === 'line' && !rightAxisAssigned) {
      y.axis = axisDefaults({ ...existingAxis, orient: 'right' }, 'y')
      rightAxisAssigned = true
    } else if (!leftAxisAssigned) {
      y.axis = axisDefaults({ ...existingAxis, orient: 'left' }, 'y')
      leftAxisAssigned = true
    } else {
      y.axis = null
    }
    encoding.y = y
    return { ...child, encoding }
  })

  return normalized
}

function enhanceVegaLiteSpec(
  value: unknown,
  currentMarkType: string | null = null,
  inheritedEncoding: Record<string, unknown> = {}
): unknown {
  if (Array.isArray(value)) return value.map((item) => enhanceVegaLiteSpec(item, currentMarkType, inheritedEncoding))
  if (!isRecord(value)) return value

  const ownMarkType = markType(value.mark) ?? currentMarkType
  const ownEncoding = isRecord(value.encoding) ? value.encoding : {}
  const effectiveEncoding = { ...inheritedEncoding, ...ownEncoding }
  const enhanced: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'mark') {
      enhanced[key] = enhanceMark(child, effectiveEncoding)
    } else if (key === 'encoding' && isRecord(child)) {
      enhanced[key] = enhanceEncoding(child)
    } else if (key === 'width') {
      enhanced[key] = numberInRange(child, 640, 520, 780)
    } else if (key === 'layer' || key === 'spec') {
      enhanced[key] = enhanceVegaLiteSpec(child, ownMarkType, effectiveEncoding)
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

  const enhanced = normalizeIndependentYLayerAxes(enhanceVegaLiteSpec(sanitized))
  if (!isRecord(enhanced)) throw new Error('Vega-Lite chart spec must be an object.')

  const width = numberInRange(enhanced.width, 640, 520, 780)
  const height = numberInRange(sanitized.height, 340, 180, 620)
  const config = isRecord(enhanced.config) ? enhanced.config : {}
  const padding = normalizedPadding(enhanced.padding, hasRightAxis(enhanced))

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
        color: '#111111',
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
        columns: 3,
        ...(isRecord(config.legend) ? config.legend : {}),
      },
      view: {
        stroke: null,
        ...(isRecord(config.view) ? config.view : {}),
      },
      range: {
        category: GRAYSCALE,
        ordinal: GRAYSCALE,
        ...(isRecord(config.range) ? config.range : {}),
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

export async function generatedVisualBlockToImageNodeServer(
  block: Extract<GeneratedContentBlock, { type: 'visual' }>,
): Promise<Json> {
  if (block.visualType !== 'vega_lite_chart') {
    const doc = generatedContentToProseMirror([block]) as { content?: Json[] }
    const node = doc.content?.find((item) => item && typeof item === 'object' && !Array.isArray(item) && (item as { type?: string }).type === 'image')
    if (!node) throw new Error('Failed to render deterministic visual.')
    return node
  }
  const svg = await renderVegaLiteChart(block)
  return generatedVisualImageNode(block, svgDataUri(svg))
}

export async function generatedContentToProseMirrorServer(value: string | GeneratedContentBlock[]): Promise<Json> {
  if (typeof value === 'string') return generatedContentToProseMirror(value)
  const content = (await Promise.all(value.map(async (block) => {
    if (block.type === 'visual') return [await generatedVisualBlockToImageNodeServer(block)]
    const doc = generatedContentToProseMirror([block]) as { content?: Json[] }
    return doc.content ?? []
  }))).flat()
  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  } as Json
}
