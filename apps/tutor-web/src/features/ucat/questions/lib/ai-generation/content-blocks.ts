import type { Json } from '@altitutor/shared'
import { plainTextToProseMirrorWithLineBreaks } from '@/features/ucat/shared/lib/rich-text'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'

function textNode(text: string): Json {
  return { type: 'text', text }
}

function inlineTextNodes(text: string): Json[] {
  const nodes: Json[] = []
  const pattern = /\*\*([^*\n]+)\*\*/gu
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(textNode(text.slice(cursor, index)))
    if (match[1]) {
      nodes.push({ type: 'text', text: match[1], marks: [{ type: 'bold' }] })
    }
    cursor = index + match[0].length
  }
  if (cursor < text.length) nodes.push(textNode(text.slice(cursor)))
  return nodes.length > 0 ? nodes : [textNode(text)]
}

function paragraph(text: string): Json {
  const trimmed = text.trim()
  return {
    type: 'paragraph',
    content: trimmed ? inlineTextNodes(trimmed) : [],
  }
}

function markedTextToProseMirror(text: string): Json {
  const paragraphs = text.split(/\r?\n/u).map(paragraph)
  return { type: 'doc', content: paragraphs.length > 0 ? paragraphs : [paragraph('')] }
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

function listNode(block: Extract<GeneratedContentBlock, { type: 'list' }>): Json {
  return {
    type: block.ordered ? 'orderedList' : 'bulletList',
    attrs: block.ordered ? { start: 1 } : undefined,
    content: block.items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  }
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

function chartPalette(spec: Record<string, unknown>): string[] {
  const style = spec.style && typeof spec.style === 'object' ? spec.style as Record<string, unknown> : {}
  const name = String(style.palette ?? '')
  if (name === 'teal_amber') return ['#0f766e', '#d97706', '#7c3aed', '#dc2626']
  if (name === 'indigo_rose') return ['#4f46e5', '#e11d48', '#059669', '#ca8a04']
  if (name === 'slate_green') return ['#475569', '#16a34a', '#2563eb', '#c2410c']
  return ['#2563eb', '#dc2626', '#16a34a', '#ca8a04']
}

function chartTitleLines(title: string | null | undefined, maxChars = 62): string[] {
  const text = (title ?? 'Chart').trim()
  if (text.length <= maxChars) return [text]
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
  return lines.slice(0, 2)
}

function renderSvgTitle(title: string | null | undefined, x: number, y: number, maxChars?: number): string {
  return chartTitleLines(title, maxChars).map((line, index) =>
    `<text x="${x}" y="${y + index * 24}" font-size="20" font-family="Arial, sans-serif" font-weight="600">${escapeXml(line)}</text>`
  ).join('')
}

type ChartSeries = { name: string; values: number[]; points?: Array<{ x: number; y: number; label?: string }> }

function chartSeries(spec: Record<string, unknown>): ChartSeries[] {
  if (!Array.isArray(spec.series)) return []
  return spec.series.map((raw, index) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const points = Array.isArray(record.points)
      ? record.points.map((point) => {
          const pointRecord = point && typeof point === 'object' ? point as Record<string, unknown> : {}
          return {
            x: Number(pointRecord.x ?? 0),
            y: Number(pointRecord.y ?? 0),
            label: typeof pointRecord.label === 'string' ? pointRecord.label : undefined,
          }
        }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      : undefined
    return {
      name: String(record.name ?? `Series ${index + 1}`),
      values: numberArray(record.values),
      points,
    }
  }).filter((item) => item.values.length > 0 || (item.points?.length ?? 0) > 0)
}

function renderChartLegend(series: Array<{ name: string }>, palette: string[], y = 74): string {
  return series.map((item, index) => {
    const x = 42 + (index % 3) * 210
    const rowY = y + Math.floor(index / 3) * 24
    return `<rect x="${x}" y="${rowY - 12}" width="14" height="14" fill="${palette[index % palette.length]}"/><text x="${x + 20}" y="${rowY}" font-size="15" font-family="Arial, sans-serif">${escapeXml(item.name)}</text>`
  }).join('')
}

function renderBarChart(
  spec: Record<string, unknown>,
  title: string | null | undefined,
  mode: 'grouped' | 'stacked' = 'grouped'
): string {
  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const series = chartSeries(spec)
  const width = 720
  const height = 460
  const chartBottom = 360
  const chartTop = 120
  const palette = chartPalette(spec)
  const stackTotals = labels.map((_, labelIndex) =>
    series.reduce((sum, item) => sum + Math.max(0, item.values[labelIndex] ?? 0), 0)
  )
  const allValues = mode === 'stacked' && series.length > 0
    ? stackTotals
    : series.length > 0 ? series.flatMap((item) => item.values) : values
  const max = Math.max(...allValues, 1)
  const groupWidth = labels.length > 0 ? 500 / labels.length : 40
  const bars = labels.map((label, labelIndex) => {
    const entries = series.length > 0
      ? series.map((item, seriesIndex) => ({ value: item.values[labelIndex] ?? 0, color: palette[seriesIndex % palette.length] }))
      : [{ value: values[labelIndex] ?? 0, color: palette[0] }]
    const barWidth = Math.max(8, mode === 'stacked' ? groupWidth * 0.46 : (groupWidth - 12) / entries.length)
    let stackedOffset = 0
    const rendered = entries.map((entry, entryIndex) => {
      const barHeight = Math.max(1, (Math.max(0, entry.value) / max) * (chartBottom - chartTop - 16))
      const x = 110 + labelIndex * groupWidth + (mode === 'stacked' ? (groupWidth - barWidth) / 2 : entryIndex * barWidth)
      const y = chartBottom - stackedOffset - barHeight
      if (mode === 'stacked') stackedOffset += barHeight
      const valueLabel = mode === 'stacked'
        ? ''
        : `<text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${entry.value}</text>`
      return `<rect x="${x}" y="${y}" width="${Math.max(8, barWidth - 3)}" height="${barHeight}" fill="${entry.color}" stroke="#fff" stroke-width="1"/>${valueLabel}`
    }).join('')
    const totalLabel = mode === 'stacked' && entries.length > 1
      ? `<text x="${110 + labelIndex * groupWidth + groupWidth / 2}" y="${chartBottom - stackedOffset - 8}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${entries.reduce((sum, entry) => sum + entry.value, 0)}</text>`
      : ''
    const labelX = 110 + labelIndex * groupWidth + groupWidth / 2
    const rotate = labels.length > 6 || label.length > 12
    const labelNode = rotate
      ? `<text x="${labelX}" y="386" font-size="13" text-anchor="end" font-family="Arial, sans-serif" transform="rotate(-35 ${labelX} 386)">${escapeXml(label)}</text>`
      : `<text x="${labelX}" y="392" font-size="15" text-anchor="middle" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    return `<g>${rendered}${totalLabel}${labelNode}</g>`
  }).join('')
  const legend = renderChartLegend(series, palette)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? (mode === 'stacked' ? 'Stacked bar chart' : 'Bar chart'), 40, 34)}${legend}<line x1="90" y1="${chartBottom}" x2="640" y2="${chartBottom}" stroke="#111" stroke-width="2"/><line x1="90" y1="${chartTop}" x2="90" y2="${chartBottom}" stroke="#111" stroke-width="2"/>${bars}</svg>`
}

function renderLineChart(spec: Record<string, unknown>, title: string | null | undefined): string {
  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const series = chartSeries(spec)
  const width = 720
  const height = 420
  const palette = chartPalette(spec)
  const lineSeries = series.length > 0 ? series : [{ name: String(spec.name ?? 'Value'), values }]
  const allValues = lineSeries.flatMap((item) => item.values)
  const max = Math.max(...allValues, 1)
  const min = Math.min(...allValues, 0)
  const span = Math.max(1, max - min)
  const renderSeries = lineSeries.map((item, seriesIndex) => {
    const points = item.values.map((value, index) => {
      const x = 100 + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * 520)
      const y = 340 - ((value - min) / span) * 220
      return { x, y, value, label: labels[index] ?? String(index + 1) }
    })
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
    const dots = points
      .map(
        (point) =>
          `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${palette[seriesIndex % palette.length]}"/><text x="${point.x - 10}" y="${point.y - 12}" font-size="13" font-family="Arial, sans-serif">${point.value}</text>`
      )
      .join('')
    return `<polyline points="${polyline}" fill="none" stroke="${palette[seriesIndex % palette.length]}" stroke-width="4"/>${dots}`
  }).join('')
  const xLabels = labels.map((label, index) => {
    const x = 100 + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * 520)
    return `<text x="${x - 12}" y="374" font-size="14" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? 'Line chart', 40, 34)}${renderChartLegend(lineSeries, palette)}<line x1="80" y1="340" x2="660" y2="340" stroke="#111" stroke-width="2"/><line x1="80" y1="95" x2="80" y2="340" stroke="#111" stroke-width="2"/>${renderSeries}${xLabels}</svg>`
}

function renderScatterPlot(spec: Record<string, unknown>, title: string | null | undefined): string {
  const rawPoints = Array.isArray(spec.points) ? spec.points : []
  const points = rawPoints.map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    return { x: Number(record.x ?? 0), y: Number(record.y ?? 0), label: String(record.label ?? '') }
  }).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  const width = 720
  const height = 420
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, 1)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 1)
  const sx = (value: number) => 100 + ((value - minX) / Math.max(1, maxX - minX)) * 520
  const sy = (value: number) => 340 - ((value - minY) / Math.max(1, maxY - minY)) * 220
  const dots = points.map((point) => {
    const x = sx(point.x)
    const y = sy(point.y)
    const label = point.label ? `<text x="${x + 8}" y="${y - 8}" font-size="12" font-family="Arial, sans-serif">${escapeXml(point.label)}</text>` : ''
    return `<circle cx="${x}" cy="${y}" r="5" fill="#111"/>${label}`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? 'Scatter plot', 40, 34)}<line x1="80" y1="340" x2="660" y2="340" stroke="#111" stroke-width="2"/><line x1="80" y1="95" x2="80" y2="340" stroke="#111" stroke-width="2"/><text x="80" y="370" font-size="13" font-family="Arial, sans-serif">${minX}</text><text x="635" y="370" font-size="13" font-family="Arial, sans-serif">${maxX}</text><text x="42" y="344" font-size="13" font-family="Arial, sans-serif">${minY}</text><text x="42" y="102" font-size="13" font-family="Arial, sans-serif">${maxY}</text>${dots}</svg>`
}

function renderPieChart(spec: Record<string, unknown>, title: string | null | undefined): string {
  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const palette = chartPalette(spec)
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1
  let cursor = -Math.PI / 2
  const cx = 260
  const cy = 245
  const radius = 120
  const slices = values.map((value, index) => {
    const angle = (Math.max(0, value) / total) * Math.PI * 2
    const start = cursor
    const end = cursor + angle
    cursor = end
    const x1 = cx + Math.cos(start) * radius
    const y1 = cy + Math.sin(start) * radius
    const x2 = cx + Math.cos(end) * radius
    const y2 = cy + Math.sin(end) * radius
    const large = angle > Math.PI ? 1 : 0
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${palette[index % palette.length]}" stroke="#fff" stroke-width="2"/>`
  }).join('')
  const legend = labels.map((label, index) => {
    const y = 132 + index * 26
    return `<rect x="460" y="${y - 13}" width="14" height="14" fill="${palette[index % palette.length]}"/><text x="482" y="${y}" font-size="15" font-family="Arial, sans-serif">${escapeXml(label)} (${values[index] ?? 0})</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460" viewBox="0 0 720 460"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? 'Pie chart', 40, 34)}${slices}${legend}</svg>`
}

function renderSetShape(shape: Record<string, unknown>, index: number, drawLabel = true): string {
  const type = String(shape.shape ?? shape.type ?? 'ellipse')
  const label = String(shape.label ?? '')
  const stroke = String(shape.stroke ?? '#111')
  const fill = String(shape.fill ?? 'none')
  const common = `fill="${fill}" fill-opacity="0.08" stroke="${stroke}" stroke-width="2.5"`
  const hasExplicitLabelPosition = shape.labelX != null || shape.labelY != null
  const shouldDrawLabel = drawLabel || hasExplicitLabelPosition
  if (type === 'circle') {
    return `<circle cx="${Number(shape.cx ?? 180 + index * 90)}" cy="${Number(shape.cy ?? 190)}" r="${Number(shape.r ?? 95)}" ${common}/>${shouldDrawLabel && label ? `<text x="${Number(shape.labelX ?? Number(shape.cx ?? 180 + index * 90) - 28)}" y="${Number(shape.labelY ?? Number(shape.cy ?? 190) - 105)}" font-size="15" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>` : ''}`
  }
  if (type === 'rect') {
    return `<rect x="${Number(shape.x ?? 120 + index * 70)}" y="${Number(shape.y ?? 115)}" width="${Number(shape.width ?? 170)}" height="${Number(shape.height ?? 160)}" ${common}/>${shouldDrawLabel && label ? `<text x="${Number(shape.labelX ?? Number(shape.x ?? 120 + index * 70) + 8)}" y="${Number(shape.labelY ?? Number(shape.y ?? 115) - 10)}" font-size="15" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>` : ''}`
  }
  if (type === 'triangle') {
    const x = Number(shape.x ?? 160 + index * 80)
    const y = Number(shape.y ?? 80)
    const w = Number(shape.width ?? 210)
    const h = Number(shape.height ?? 220)
    return `<polygon points="${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}" ${common}/>${shouldDrawLabel && label ? `<text x="${Number(shape.labelX ?? x + w / 2 - 30)}" y="${Number(shape.labelY ?? y - 10)}" font-size="15" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>` : ''}`
  }
  if (type === 'diamond') {
    const cx = Number(shape.cx ?? 260 + index * 60)
    const cy = Number(shape.cy ?? 190)
    const w = Number(shape.width ?? 170)
    const h = Number(shape.height ?? 170)
    return `<polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}" ${common}/>${shouldDrawLabel && label ? `<text x="${Number(shape.labelX ?? cx - 32)}" y="${Number(shape.labelY ?? cy - h / 2 - 10)}" font-size="15" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>` : ''}`
  }
  if (type === 'pentagon' || type === 'hexagon') {
    const cx = Number(shape.cx ?? 250 + index * 70)
    const cy = Number(shape.cy ?? 190)
    const radius = Number(shape.r ?? shape.radius ?? 95)
    const sides = type === 'pentagon' ? 5 : 6
    const rotation = type === 'pentagon' ? -Math.PI / 2 : Math.PI / 6
    const points = Array.from({ length: sides }, (_, pointIndex) => {
      const angle = rotation + (pointIndex / sides) * Math.PI * 2
      return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`
    }).join(' ')
    return `<polygon points="${points}" ${common}/>${shouldDrawLabel && label ? `<text x="${Number(shape.labelX ?? cx - 34)}" y="${Number(shape.labelY ?? cy - radius - 10)}" font-size="15" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>` : ''}`
  }
  return `<ellipse cx="${Number(shape.cx ?? 210 + index * 95)}" cy="${Number(shape.cy ?? 190)}" rx="${Number(shape.rx ?? 120)}" ry="${Number(shape.ry ?? 82)}" ${common}/>${shouldDrawLabel && label ? `<text x="${Number(shape.labelX ?? Number(shape.cx ?? 210 + index * 95) - 36)}" y="${Number(shape.labelY ?? Number(shape.cy ?? 190) - 95)}" font-size="15" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>` : ''}`
}

function renderSetDiagram(spec: Record<string, unknown>, title: string | null | undefined): string {
  const shapes = Array.isArray(spec.shapes) ? spec.shapes : []
  const values = Array.isArray(spec.labels) ? spec.labels : Array.isArray(spec.regions) ? spec.regions : []
  const useLegend = shapes.some((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    return record.label && record.labelX == null && record.labelY == null
  })
  const shapeNodes = shapes
    .map((raw, index) => raw && typeof raw === 'object' ? renderSetShape(raw as Record<string, unknown>, index, !useLegend) : '')
    .join('')
  const legend = useLegend
    ? shapes.map((raw, index) => {
        const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
        if (!record.label) return ''
        const y = 96 + index * 28
        return `<line x1="585" y1="${y - 5}" x2="615" y2="${y - 5}" stroke="#111" stroke-width="2"/><text x="625" y="${y}" font-size="14" font-family="Arial, sans-serif">${escapeXml(String(record.label))}</text>`
      }).join('')
    : ''
  const labelNodes = values.map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    return `<text x="${Number(record.x ?? 320)}" y="${Number(record.y ?? 220)}" font-size="${Number(record.fontSize ?? 17)}" font-family="Arial, sans-serif" text-anchor="middle" font-weight="${record.bold ? 700 : 400}">${escapeXml(String(record.text ?? record.value ?? ''))}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="430" viewBox="0 0 720 430"><rect width="100%" height="100%" fill="white"/>${title ? renderSvgTitle(title, 40, 34) : ''}<g transform="translate(0 ${title ? 34 : 0})">${shapeNodes}${labelNodes}</g>${legend}</svg>`
}

function renderVennDiagram(spec: Record<string, unknown>, title: string | null | undefined): string {
  if (Array.isArray(spec.shapes)) return renderSetDiagram(spec, title)
  const sets = Array.isArray(spec.sets) ? spec.sets : []
  const regions = spec.regions && typeof spec.regions === 'object'
    ? spec.regions as Record<string, unknown>
    : null
  if (sets.length === 3 && regions) {
    const labels = sets.map((raw, index) => {
      const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
      return escapeXml(String(record.label ?? record.id ?? String.fromCharCode(65 + index)))
    })
    const region = (key: string) => escapeXml(String(regions[key] ?? ''))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="100%" height="100%" fill="white"/><text x="32" y="34" font-size="20" font-family="Arial">${escapeXml(title ?? 'Venn diagram')}</text><circle cx="260" cy="180" r="120" fill="none" stroke="#111" stroke-width="2.5"/><circle cx="380" cy="180" r="120" fill="none" stroke="#111" stroke-width="2.5"/><circle cx="320" cy="275" r="120" fill="none" stroke="#111" stroke-width="2.5"/><line x1="500" y1="94" x2="530" y2="94" stroke="#111" stroke-width="2"/><text x="540" y="100" font-size="15" font-family="Arial">${labels[0]}</text><line x1="500" y1="124" x2="530" y2="124" stroke="#111" stroke-width="2"/><text x="540" y="130" font-size="15" font-family="Arial">${labels[1]}</text><line x1="500" y1="154" x2="530" y2="154" stroke="#111" stroke-width="2"/><text x="540" y="160" font-size="15" font-family="Arial">${labels[2]}</text><text x="205" y="165" font-size="18">${region('aOnly')}</text><text x="420" y="165" font-size="18">${region('bOnly')}</text><text x="310" y="340" font-size="18">${region('cOnly')}</text><text x="315" y="115" font-size="18">${region('abOnly')}</text><text x="250" y="255" font-size="18">${region('acOnly')}</text><text x="380" y="255" font-size="18">${region('bcOnly')}</text><text x="315" y="205" font-size="18">${region('abc')}</text><text x="550" y="365" font-size="16">${region('outside')}</text></svg>`
  }
  const leftLabel = String(spec.leftLabel ?? 'A')
  const rightLabel = String(spec.rightLabel ?? 'B')
  const intersectionLabel = String(spec.intersectionLabel ?? '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340" viewBox="0 0 560 340"><rect width="100%" height="100%" fill="white"/><text x="32" y="34" font-size="20">${escapeXml(title ?? 'Venn diagram')}</text><circle cx="230" cy="180" r="105" fill="none" stroke="#111" stroke-width="2.5"/><circle cx="330" cy="180" r="105" fill="none" stroke="#111" stroke-width="2.5"/><text x="160" y="180" font-size="18">${escapeXml(leftLabel)}</text><text x="375" y="180" font-size="18">${escapeXml(rightLabel)}</text><text x="265" y="180" font-size="18">${escapeXml(intersectionLabel)}</text></svg>`
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
    .map((point) => {
      const edgeLabel = point.x <= 100
      const x = edgeLabel ? 20 : point.x + 10
      const y = edgeLabel ? point.y + 52 : point.y - 10
      return `<circle cx="${point.x}" cy="${point.y}" r="8" fill="#2563eb"/><text x="${x}" y="${y}" text-anchor="start" font-size="14">${escapeXml(point.label)}</text>`
    })
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
  if (block.visualType === 'bar_chart' || block.visualType === 'histogram') {
    svg = renderBarChart(block.spec, block.title)
  } else if (block.visualType === 'stacked_bar_chart') {
    svg = renderBarChart(block.spec, block.title, 'stacked')
  } else if (block.visualType === 'line_chart') {
    svg = renderLineChart(block.spec, block.title)
  } else if (block.visualType === 'scatter_plot') {
    svg = renderScatterPlot(block.spec, block.title)
  } else if (block.visualType === 'pie_chart') {
    svg = renderPieChart(block.spec, block.title)
  } else if (block.visualType === 'venn_diagram' || block.visualType === 'set_diagram') {
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
    if (block.type === 'list') content.push(listNode(block))
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
  if (typeof value === 'string' && value.includes('**')) return markedTextToProseMirror(value)
  if (typeof value === 'string') return plainTextToProseMirrorWithLineBreaks(value)
  return generatedBlocksToProseMirror(value)
}

export function generatedContentToPlainText(value: string | GeneratedContentBlock[]): string {
  if (typeof value === 'string') return value.replace(/\*\*([^*\n]+)\*\*/gu, '$1')
  return value
    .map((block) => {
      if (block.type === 'paragraph') return block.text.replace(/\*\*([^*\n]+)\*\*/gu, '$1')
      if (block.type === 'list') return block.items.map((item) => `- ${item}`).join('\n')
      if (block.type === 'table') return [block.caption, block.columns.join('\t'), ...block.rows.map((row) => row.join('\t'))].filter(Boolean).join('\n')
      return [block.title, block.altText].filter(Boolean).join('\n')
    })
    .join('\n')
}
