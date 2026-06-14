import type { Json } from '@altitutor/shared'
import { plainTextToProseMirrorWithLineBreaks } from '@/features/ucat/shared/lib/rich-text'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'

function textNode(text: string): Json {
  return { type: 'text', text }
}

function paragraph(text: string): Json {
  return {
    type: 'paragraph',
    content: text.trim() ? [textNode(text.trim())] : [],
  }
}

function tableCell(text: string, header = false): Json {
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [paragraph(text)],
  }
}

function tableNode(block: Extract<GeneratedContentBlock, { type: 'table' }>): Json {
  const rows: Json[] = []
  rows.push({
    type: 'tableRow',
    content: block.columns.map((column) => tableCell(column, true)),
  })
  for (const row of block.rows) {
    rows.push({
      type: 'tableRow',
      content: block.columns.map((_, index) => tableCell(row[index] ?? '')),
    })
  }
  return { type: 'table', content: rows }
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : Number(item))).filter(Number.isFinite)
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '')).filter((item) => item.trim().length > 0)
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function renderBarChart(spec: Record<string, unknown>, title: string | null | undefined): string {
  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const width = 640
  const height = 360
  const max = Math.max(...values, 1)
  const barWidth = labels.length > 0 ? 420 / labels.length : 40
  const bars = labels
    .map((label, index) => {
      const value = values[index] ?? 0
      const barHeight = Math.max(1, (value / max) * 210)
      const x = 100 + index * barWidth
      const y = 290 - barHeight
      return `<g><rect x="${x}" y="${y}" width="${Math.max(16, barWidth - 12)}" height="${barHeight}" fill="#2563eb"/><text x="${x + barWidth / 2 - 6}" y="315" font-size="12">${escapeXml(label)}</text><text x="${x + barWidth / 2 - 8}" y="${y - 8}" font-size="12">${value}</text></g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="40" y="34" font-size="20" font-family="Arial">${escapeXml(title ?? 'Bar chart')}</text><line x1="80" y1="290" x2="560" y2="290" stroke="#111"/><line x1="80" y1="70" x2="80" y2="290" stroke="#111"/>${bars}</svg>`
}

function renderLineChart(spec: Record<string, unknown>, title: string | null | undefined): string {
  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const width = 640
  const height = 360
  const max = Math.max(...values, 1)
  const points = values.map((value, index) => {
    const x = 90 + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * 450)
    const y = 290 - (value / max) * 210
    return { x, y, value, label: labels[index] ?? String(index + 1) }
  })
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
  const dots = points
    .map(
      (point) =>
        `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#2563eb"/><text x="${point.x - 8}" y="${point.y - 10}" font-size="12">${point.value}</text><text x="${point.x - 10}" y="315" font-size="12">${escapeXml(point.label)}</text>`
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="40" y="34" font-size="20" font-family="Arial">${escapeXml(title ?? 'Line chart')}</text><line x1="80" y1="290" x2="560" y2="290" stroke="#111"/><line x1="80" y1="70" x2="80" y2="290" stroke="#111"/><polyline points="${polyline}" fill="none" stroke="#2563eb" stroke-width="3"/>${dots}</svg>`
}

function renderVennDiagram(spec: Record<string, unknown>, title: string | null | undefined): string {
  const leftLabel = String(spec.leftLabel ?? 'A')
  const rightLabel = String(spec.rightLabel ?? 'B')
  const intersectionLabel = String(spec.intersectionLabel ?? '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340" viewBox="0 0 560 340"><rect width="100%" height="100%" fill="white"/><text x="32" y="34" font-size="20">${escapeXml(title ?? 'Venn diagram')}</text><circle cx="230" cy="180" r="105" fill="#93c5fd" fill-opacity="0.45" stroke="#1d4ed8" stroke-width="3"/><circle cx="330" cy="180" r="105" fill="#fca5a5" fill-opacity="0.45" stroke="#b91c1c" stroke-width="3"/><text x="160" y="180" font-size="18">${escapeXml(leftLabel)}</text><text x="375" y="180" font-size="18">${escapeXml(rightLabel)}</text><text x="265" y="180" font-size="18">${escapeXml(intersectionLabel)}</text></svg>`
}

function renderSchematicMap(spec: Record<string, unknown>, title: string | null | undefined): string {
  const points = Array.isArray(spec.points) ? spec.points : []
  const lines = Array.isArray(spec.lines) ? spec.lines : []
  const pointMap = new Map<string, { x: number; y: number; label: string }>()
  points.forEach((raw, index) => {
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const id = String(record.id ?? index)
    pointMap.set(id, {
      x: Number(record.x ?? 80 + index * 90),
      y: Number(record.y ?? 160),
      label: String(record.label ?? id),
    })
  })
  const svgLines = lines
    .map((raw) => {
      const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const from = pointMap.get(String(record.from ?? ''))
      const to = pointMap.get(String(record.to ?? ''))
      if (!from || !to) return ''
      const label = String(record.label ?? '')
      const lx = (from.x + to.x) / 2
      const ly = (from.y + to.y) / 2 - 8
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#111" stroke-width="3"/><text x="${lx}" y="${ly}" font-size="13">${escapeXml(label)}</text>`
    })
    .join('')
  const svgPoints = Array.from(pointMap.values())
    .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="8" fill="#2563eb"/><text x="${point.x + 10}" y="${point.y - 10}" font-size="14">${escapeXml(point.label)}</text>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="100%" height="100%" fill="white"/><text x="32" y="34" font-size="20">${escapeXml(title ?? 'Schematic map')}</text>${svgLines}${svgPoints}</svg>`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function visualNode(block: Extract<GeneratedContentBlock, { type: 'visual' }>): Json {
  let svg: string
  if (block.visualType === 'bar_chart' || block.visualType === 'pie_chart') {
    svg = renderBarChart(block.spec, block.title)
  } else if (block.visualType === 'line_chart') {
    svg = renderLineChart(block.spec, block.title)
  } else if (block.visualType === 'venn_diagram') {
    svg = renderVennDiagram(block.spec, block.title)
  } else {
    svg = renderSchematicMap(block.spec, block.title)
  }

  return {
    type: 'image',
    attrs: {
      src: svgDataUri(svg),
      alt: block.altText,
    },
  }
}

export function generatedBlocksToProseMirror(blocks: GeneratedContentBlock[]): Json {
  const content: Json[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph') content.push(paragraph(block.text))
    if (block.type === 'table') {
      if (block.caption) content.push(paragraph(block.caption))
      content.push(tableNode(block))
    }
    if (block.type === 'visual') {
      content.push(visualNode(block))
      content.push(paragraph(block.altText))
    }
  }
  return { type: 'doc', content: content.length > 0 ? content : [paragraph('')] }
}

export function generatedContentToProseMirror(value: string | GeneratedContentBlock[]): Json {
  if (typeof value === 'string') return plainTextToProseMirrorWithLineBreaks(value)
  return generatedBlocksToProseMirror(value)
}

export function generatedContentToPlainText(value: string | GeneratedContentBlock[]): string {
  if (typeof value === 'string') return value
  return value
    .map((block) => {
      if (block.type === 'paragraph') return block.text
      if (block.type === 'table') return [block.caption, block.columns.join('\t'), ...block.rows.map((row) => row.join('\t'))].filter(Boolean).join('\n')
      return [block.title, block.altText].filter(Boolean).join('\n')
    })
    .join('\n')
}
