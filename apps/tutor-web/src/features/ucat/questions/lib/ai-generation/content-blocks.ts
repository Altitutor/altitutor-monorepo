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

function imageNode(block: Extract<GeneratedContentBlock, { type: 'image' }>): Json {
  return {
    type: 'image',
    attrs: {
      src: block.src,
      alt: block.altText ?? '',
      fileId: block.fileId ?? null,
    },
  }
}

function chartPalette(spec: Record<string, unknown>): string[] {
  const style = spec.style && typeof spec.style === 'object' ? spec.style as Record<string, unknown> : {}
  const name = String(style.palette ?? '')
  if (name === 'monochrome') return ['#111827', '#6b7280', '#d1d5db', '#374151']
  if (name === 'teal_amber') return ['#0f766e', '#d97706', '#7c3aed', '#dc2626']
  if (name === 'indigo_rose') return ['#4f46e5', '#e11d48', '#059669', '#ca8a04']
  if (name === 'slate_green') return ['#475569', '#16a34a', '#2563eb', '#c2410c']
  return ['#2563eb', '#dc2626', '#16a34a', '#ca8a04']
}

function chartStyle(spec: Record<string, unknown>): Record<string, unknown> {
  return spec.style && typeof spec.style === 'object' ? spec.style as Record<string, unknown> : {}
}

function axisSpec(spec: Record<string, unknown>, key: 'xAxis' | 'yAxis'): Record<string, unknown> {
  return spec[key] && typeof spec[key] === 'object' ? spec[key] as Record<string, unknown> : {}
}

function axisTitle(axis: Record<string, unknown>): string {
  return [axis.label, axis.unit ? `(${axis.unit})` : null]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function numericAxisBounds(values: number[], axis: Record<string, unknown>, includeZero = true): { min: number; max: number } {
  const rawMin = Number(axis.min)
  const rawMax = Number(axis.max)
  const valueMin = Math.min(...values, includeZero ? 0 : Number.POSITIVE_INFINITY)
  const valueMax = Math.max(...values, includeZero ? 0 : Number.NEGATIVE_INFINITY)
  const min = Number.isFinite(rawMin) ? rawMin : Number.isFinite(valueMin) ? valueMin : 0
  const max = Number.isFinite(rawMax) ? rawMax : Number.isFinite(valueMax) ? valueMax : 1
  return max > min ? { min, max } : { min, max: min + 1 }
}

function gridAndYAxisTicks(
  bounds: { min: number; max: number },
  axis: Record<string, unknown>,
  left: number,
  top: number,
  bottom: number,
  right: number,
  showGrid: boolean
): string {
  const tickCount = Math.max(2, Math.min(12, Number(axis.tickCount ?? 5)))
  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1)
    const value = bounds.min + (bounds.max - bounds.min) * ratio
    const y = bottom - ratio * (bottom - top)
    const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10
    const grid = showGrid ? `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>` : ''
    return `${grid}<text x="${left - 10}" y="${y + 5}" font-size="12" font-family="Arial, sans-serif" text-anchor="end">${rounded}</text>`
  }).join('')
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
  const panels = Array.isArray(spec.panels)
    ? spec.panels
        .map((raw) => raw && typeof raw === 'object' ? raw as Record<string, unknown> : {})
        .filter((panel) => stringArray(panel.labels).length > 0 && (numberArray(panel.values).length > 0 || chartSeries(panel).length > 0))
    : []
  if (panels.length > 0) return renderBarChartPanels(spec, title, mode, panels)

  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const series = chartSeries(spec)
  const width = 720
  const height = 460
  const chartBottom = 360
  const chartTop = 120
  const chartLeft = 90
  const chartRight = 640
  const palette = chartPalette(spec)
  const style = chartStyle(spec)
  const yAxis = axisSpec(spec, 'yAxis')
  const xAxis = axisSpec(spec, 'xAxis')
  const stackTotals = labels.map((_, labelIndex) =>
    series.reduce((sum, item) => sum + Math.max(0, item.values[labelIndex] ?? 0), 0)
  )
  const allValues = mode === 'stacked' && series.length > 0
    ? stackTotals
    : series.length > 0 ? series.flatMap((item) => item.values) : values
  const bounds = numericAxisBounds(allValues, yAxis)
  const groupWidth = labels.length > 0 ? (chartRight - chartLeft - 50) / labels.length : 40
  const bars = labels.map((label, labelIndex) => {
    const entries = series.length > 0
      ? series.map((item, seriesIndex) => ({ value: item.values[labelIndex] ?? 0, color: palette[seriesIndex % palette.length] }))
      : [{ value: values[labelIndex] ?? 0, color: palette[0] }]
    const barWidth = Math.max(8, mode === 'stacked' ? groupWidth * 0.46 : (groupWidth - 12) / entries.length)
    let stackedOffset = 0
    const rendered = entries.map((entry, entryIndex) => {
      const barHeight = Math.max(1, ((Math.max(bounds.min, entry.value) - bounds.min) / Math.max(1, bounds.max - bounds.min)) * (chartBottom - chartTop - 16))
      const x = chartLeft + 20 + labelIndex * groupWidth + (mode === 'stacked' ? (groupWidth - barWidth) / 2 : entryIndex * barWidth)
      const y = chartBottom - stackedOffset - barHeight
      if (mode === 'stacked') stackedOffset += barHeight
      const showValueLabels = style.showValueLabels !== false
      const valueLabel = mode === 'stacked' || !showValueLabels
        ? ''
        : `<text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${entry.value}</text>`
      return `<rect x="${x}" y="${y}" width="${Math.max(8, barWidth - 3)}" height="${barHeight}" fill="${entry.color}" stroke="#fff" stroke-width="1"/>${valueLabel}`
    }).join('')
    const totalLabel = mode === 'stacked' && entries.length > 1
      ? `<text x="${chartLeft + 20 + labelIndex * groupWidth + groupWidth / 2}" y="${chartBottom - stackedOffset - 8}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${entries.reduce((sum, entry) => sum + entry.value, 0)}</text>`
      : ''
    const labelX = chartLeft + 20 + labelIndex * groupWidth + groupWidth / 2
    const rotate = labels.length > 6 || label.length > 12
    const labelNode = rotate
      ? `<text x="${labelX}" y="386" font-size="13" text-anchor="end" font-family="Arial, sans-serif" transform="rotate(-35 ${labelX} 386)">${escapeXml(label)}</text>`
      : `<text x="${labelX}" y="392" font-size="15" text-anchor="middle" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    return `<g>${rendered}${totalLabel}${labelNode}</g>`
  }).join('')
  const legend = renderChartLegend(series, palette)
  const grid = gridAndYAxisTicks(bounds, yAxis, chartLeft, chartTop, chartBottom, chartRight, style.showGrid !== false)
  const xAxisTitle = axisTitle(xAxis)
  const yAxisTitle = axisTitle(yAxis)
  const xAxisNode = xAxisTitle ? `<text x="${(chartLeft + chartRight) / 2}" y="438" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${escapeXml(xAxisTitle)}</text>` : ''
  const yAxisNode = yAxisTitle ? `<text x="22" y="${(chartTop + chartBottom) / 2}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" transform="rotate(-90 22 ${(chartTop + chartBottom) / 2})">${escapeXml(yAxisTitle)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? (mode === 'stacked' ? 'Stacked bar chart' : 'Bar chart'), 40, 34)}${legend}${grid}<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#111" stroke-width="2"/><line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" stroke="#111" stroke-width="2"/>${bars}${xAxisNode}${yAxisNode}</svg>`
}

function renderBarChartPanels(
  spec: Record<string, unknown>,
  title: string | null | undefined,
  mode: 'grouped' | 'stacked',
  panels: Record<string, unknown>[]
): string {
  const width = 760
  const height = 470
  const palette = chartPalette(spec)
  const style = chartStyle(spec)
  const yAxis = axisSpec(spec, 'yAxis')
  const xAxis = axisSpec(spec, 'xAxis')
  const panelTop = 118
  const panelBottom = 354
  const panelWidth = (width - 96) / panels.length
  const allPanelValues = panels.flatMap((panel) => {
    const series = chartSeries(panel)
    if (mode === 'stacked' && series.length > 0) {
      const labels = stringArray(panel.labels)
      return labels.map((_, labelIndex) => series.reduce((sum, item) => sum + Math.max(0, item.values[labelIndex] ?? 0), 0))
    }
    return series.length > 0 ? series.flatMap((item) => item.values) : numberArray(panel.values)
  })
  const bounds = numericAxisBounds(allPanelValues, yAxis)
  const grid = gridAndYAxisTicks(bounds, yAxis, 82, panelTop, panelBottom, width - 42, style.showGrid !== false)
  const renderedPanels = panels.map((panel, panelIndex) => {
    const labels = stringArray(panel.labels)
    const series = chartSeries(panel)
    const values = numberArray(panel.values)
    const entriesByLabel = labels.map((_, labelIndex) =>
      series.length > 0
        ? series.map((item, seriesIndex) => ({ value: item.values[labelIndex] ?? 0, color: palette[seriesIndex % palette.length] }))
        : [{ value: values[labelIndex] ?? 0, color: palette[0] }]
    )
    const left = 82 + panelIndex * panelWidth + 12
    const right = 82 + (panelIndex + 1) * panelWidth - 12
    const groupWidth = labels.length > 0 ? (right - left) / labels.length : 40
    const bars = entriesByLabel.map((entries, labelIndex) => {
      const barWidth = Math.max(7, mode === 'stacked' ? groupWidth * 0.48 : (groupWidth - 10) / entries.length)
      let stackedOffset = 0
      const rendered = entries.map((entry, entryIndex) => {
        const barHeight = Math.max(1, ((Math.max(bounds.min, entry.value) - bounds.min) / Math.max(1, bounds.max - bounds.min)) * (panelBottom - panelTop - 16))
        const x = left + labelIndex * groupWidth + (mode === 'stacked' ? (groupWidth - barWidth) / 2 : entryIndex * barWidth)
        const y = panelBottom - stackedOffset - barHeight
        if (mode === 'stacked') stackedOffset += barHeight
        return `<rect x="${x}" y="${y}" width="${Math.max(6, barWidth - 3)}" height="${barHeight}" fill="${entry.color}" stroke="#fff" stroke-width="1"/>`
      }).join('')
      const labelX = left + labelIndex * groupWidth + groupWidth / 2
      const label = `<text x="${labelX}" y="382" font-size="12" text-anchor="end" font-family="Arial, sans-serif" transform="rotate(-30 ${labelX} 382)">${escapeXml(labels[labelIndex] ?? '')}</text>`
      return `<g>${rendered}${label}</g>`
    }).join('')
    const panelTitle = String(panel.title ?? `Panel ${panelIndex + 1}`)
    const subtitle = String(panel.subtitle ?? '').trim()
    return `<g><text x="${(left + right) / 2}" y="88" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" font-weight="600">${escapeXml(panelTitle)}</text>${subtitle ? `<text x="${(left + right) / 2}" y="108" text-anchor="middle" font-size="13" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text>` : ''}${bars}</g>`
  }).join('')
  const legendSeries = chartSeries(panels.find((panel) => chartSeries(panel).length > 0) ?? {})
  const legend = legendSeries.length > 1 ? renderChartLegend(legendSeries, palette, 430) : ''
  const xAxisTitle = axisTitle(xAxis)
  const yAxisTitle = axisTitle(yAxis)
  const xAxisNode = xAxisTitle ? `<text x="${width / 2}" y="414" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${escapeXml(xAxisTitle)}</text>` : ''
  const yAxisNode = yAxisTitle ? `<text x="24" y="${(panelTop + panelBottom) / 2}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" transform="rotate(-90 24 ${(panelTop + panelBottom) / 2})">${escapeXml(yAxisTitle)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? (mode === 'stacked' ? 'Stacked bar charts' : 'Bar charts'), 40, 34)}${grid}<line x1="82" y1="${panelBottom}" x2="${width - 42}" y2="${panelBottom}" stroke="#111" stroke-width="2"/><line x1="82" y1="${panelTop}" x2="82" y2="${panelBottom}" stroke="#111" stroke-width="2"/>${renderedPanels}${xAxisNode}${yAxisNode}${legend}</svg>`
}

function renderLineChart(spec: Record<string, unknown>, title: string | null | undefined): string {
  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const series = chartSeries(spec)
  const width = 720
  const height = 420
  const palette = chartPalette(spec)
  const style = chartStyle(spec)
  const yAxis = axisSpec(spec, 'yAxis')
  const xAxis = axisSpec(spec, 'xAxis')
  const chartLeft = 80
  const chartRight = 660
  const chartTop = 95
  const chartBottom = 340
  const lineSeries = series.length > 0 ? series : [{ name: String(spec.name ?? 'Value'), values }]
  const allValues = lineSeries.flatMap((item) => item.values)
  const bounds = numericAxisBounds(allValues, yAxis, false)
  const span = Math.max(1, bounds.max - bounds.min)
  const renderSeries = lineSeries.map((item, seriesIndex) => {
    const points = item.values.map((value, index) => {
      const x = 100 + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * 520)
      const y = chartBottom - ((value - bounds.min) / span) * 220
      return { x, y, value, label: labels[index] ?? String(index + 1) }
    })
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
    const showValueLabels = style.showValueLabels === true
    const dots = points
      .map(
        (point) =>
          `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${palette[seriesIndex % palette.length]}"/>${showValueLabels ? `<text x="${point.x - 10}" y="${point.y - 12}" font-size="13" font-family="Arial, sans-serif">${point.value}</text>` : ''}`
      )
      .join('')
    return `<polyline points="${polyline}" fill="none" stroke="${palette[seriesIndex % palette.length]}" stroke-width="4"/>${dots}`
  }).join('')
  const xLabels = labels.map((label, index) => {
    const x = 100 + (labels.length <= 1 ? 0 : (index / (labels.length - 1)) * 520)
    return `<text x="${x - 12}" y="374" font-size="14" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
  }).join('')
  const grid = gridAndYAxisTicks(bounds, yAxis, chartLeft, chartTop, chartBottom, chartRight, style.showGrid !== false)
  const xAxisTitle = axisTitle(xAxis)
  const yAxisTitle = axisTitle(yAxis)
  const xAxisNode = xAxisTitle ? `<text x="${(chartLeft + chartRight) / 2}" y="410" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${escapeXml(xAxisTitle)}</text>` : ''
  const yAxisNode = yAxisTitle ? `<text x="22" y="${(chartTop + chartBottom) / 2}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" transform="rotate(-90 22 ${(chartTop + chartBottom) / 2})">${escapeXml(yAxisTitle)}</text>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? 'Line chart', 40, 34)}${renderChartLegend(lineSeries, palette)}${grid}<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#111" stroke-width="2"/><line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" stroke="#111" stroke-width="2"/>${renderSeries}${xLabels}${xAxisNode}${yAxisNode}</svg>`
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
  const panels = Array.isArray(spec.panels)
    ? spec.panels
        .map((raw) => raw && typeof raw === 'object' ? raw as Record<string, unknown> : {})
        .map((panel) => ({
          title: String(panel.title ?? '').trim(),
          subtitle: String(panel.subtitle ?? '').trim(),
          labels: stringArray(panel.labels),
          values: numberArray(panel.values),
        }))
        .filter((panel) => panel.labels.length > 0 && panel.values.length > 0)
    : []
  if (panels.length > 0) return renderPieChartPanels(spec, title, panels)

  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const palette = chartPalette(spec)
  const style = chartStyle(spec)
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
    const pattern = style.patterned ? `url(#piePattern${index % 4})` : palette[index % palette.length]
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${pattern}" stroke="#fff" stroke-width="2"/>`
  }).join('')
  const legend = labels.map((label, index) => {
    const y = 132 + index * 26
    return `<rect x="460" y="${y - 13}" width="14" height="14" fill="${palette[index % palette.length]}"/><text x="482" y="${y}" font-size="15" font-family="Arial, sans-serif">${escapeXml(label)} (${values[index] ?? 0})</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460" viewBox="0 0 720 460"><defs>${piePatterns(palette)}</defs><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? 'Pie chart', 40, 34)}${slices}${legend}</svg>`
}

function piePatterns(palette: string[]): string {
  return palette.map((color, index) => {
    if (index % 4 === 0) return `<pattern id="piePattern${index}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${color}"/><path d="M0 0L6 6" stroke="white" stroke-width="1"/></pattern>`
    if (index % 4 === 1) return `<pattern id="piePattern${index}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${color}"/><path d="M0 6L6 0" stroke="white" stroke-width="1"/></pattern>`
    if (index % 4 === 2) return `<pattern id="piePattern${index}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${color}"/><circle cx="2.5" cy="2.5" r="1" fill="white"/></pattern>`
    return `<pattern id="piePattern${index}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${color}"/><path d="M3 0V6" stroke="white" stroke-width="1"/></pattern>`
  }).join('')
}

function renderPieChartPanels(
  spec: Record<string, unknown>,
  title: string | null | undefined,
  panels: Array<{ title: string; subtitle: string; labels: string[]; values: number[] }>
): string {
  const palette = chartPalette(spec)
  const style = chartStyle(spec)
  const width = 720
  const height = 470
  const panelWidth = width / panels.length
  const radius = panels.length >= 3 ? 76 : 105
  const pieNodes = panels.map((panel, panelIndex) => {
    const cx = panelWidth * panelIndex + panelWidth / 2
    const cy = 230
    const total = panel.values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1
    let cursor = -Math.PI / 2
    const slices = panel.values.map((value, index) => {
      const angle = (Math.max(0, value) / total) * Math.PI * 2
      const start = cursor
      const end = cursor + angle
      cursor = end
      const x1 = cx + Math.cos(start) * radius
      const y1 = cy + Math.sin(start) * radius
      const x2 = cx + Math.cos(end) * radius
      const y2 = cy + Math.sin(end) * radius
      const large = angle > Math.PI ? 1 : 0
      const fill = style.patterned ? `url(#piePattern${index % 4})` : palette[index % palette.length]
      const mid = start + angle / 2
      const labelX = cx + Math.cos(mid) * (radius + 30)
      const labelY = cy + Math.sin(mid) * (radius + 18)
      const label = `${panel.labels[index] ?? index + 1} ${panel.values[index] ?? 0}%`
      return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${fill}" stroke="#fff" stroke-width="2"/><text x="${labelX}" y="${labelY}" text-anchor="${labelX < cx ? 'end' : 'start'}" font-size="13" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    }).join('')
    return `<g><text x="${cx}" y="86" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" font-weight="600">${escapeXml(panel.title || `Panel ${panelIndex + 1}`)}</text>${panel.subtitle ? `<text x="${cx}" y="110" text-anchor="middle" font-size="15" font-family="Arial, sans-serif">${escapeXml(panel.subtitle)}</text>` : ''}${slices}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${piePatterns(palette)}</defs><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? 'Pie charts', 40, 34)}${pieNodes}</svg>`
}

function renderSetShape(shape: Record<string, unknown>, index: number): string {
  const type = setShapeType(shape)
  const stroke = String(shape.stroke ?? '#111')
  const fill = String(shape.fill ?? 'none')
  const common = `fill="${fill}" fill-opacity="0.08" stroke="${stroke}" stroke-width="2.5"`
  if (type === 'circle') {
    return `<circle cx="${Number(shape.cx ?? 180 + index * 90)}" cy="${Number(shape.cy ?? 190)}" r="${Number(shape.r ?? 95)}" ${common}/>`
  }
  if (type === 'rect') {
    return `<rect x="${Number(shape.x ?? 120 + index * 70)}" y="${Number(shape.y ?? 115)}" width="${Number(shape.width ?? 170)}" height="${Number(shape.height ?? 160)}" ${common}/>`
  }
  if (type === 'triangle') {
    const x = Number(shape.x ?? 160 + index * 80)
    const y = Number(shape.y ?? 80)
    const w = Number(shape.width ?? 210)
    const h = Number(shape.height ?? 220)
    return `<polygon points="${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}" ${common}/>`
  }
  if (type === 'diamond') {
    const cx = Number(shape.cx ?? 260 + index * 60)
    const cy = Number(shape.cy ?? 190)
    const w = Number(shape.width ?? 170)
    const h = Number(shape.height ?? 170)
    return `<polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}" ${common}/>`
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
    return `<polygon points="${points}" ${common}/>`
  }
  return `<ellipse cx="${Number(shape.cx ?? 210 + index * 95)}" cy="${Number(shape.cy ?? 190)}" rx="${Number(shape.rx ?? 120)}" ry="${Number(shape.ry ?? 82)}" ${common}/>`
}

type SvgPoint = { x: number; y: number }
type SvgLabelBox = SvgPoint & { width: number; height: number; fontSize: number; text: string }
type SvgBounds = { minX: number; minY: number; maxX: number; maxY: number }

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function setShapeType(shape: Record<string, unknown>): string {
  const type = String(shape.shape ?? shape.type ?? 'ellipse')
  return ['circle', 'ellipse', 'rect', 'triangle', 'diamond', 'pentagon', 'hexagon'].includes(type)
    ? type
    : 'ellipse'
}

function setShapeId(shape: Record<string, unknown>, index: number): string {
  return String(shape.id ?? shape.label ?? `set${index + 1}`).trim()
}

function polygonPoints(shape: Record<string, unknown>, index: number): SvgPoint[] {
  const type = setShapeType(shape)
  if (type === 'triangle') {
    const x = finiteNumber(shape.x, 160 + index * 80)
    const y = finiteNumber(shape.y, 80)
    const width = finiteNumber(shape.width, 210)
    const height = finiteNumber(shape.height, 220)
    return [
      { x: x + width / 2, y },
      { x, y: y + height },
      { x: x + width, y: y + height },
    ]
  }
  if (type === 'rect') {
    const x = finiteNumber(shape.x, 120 + index * 70)
    const y = finiteNumber(shape.y, 115)
    const width = finiteNumber(shape.width, 170)
    const height = finiteNumber(shape.height, 160)
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ]
  }
  if (type === 'diamond') {
    const cx = finiteNumber(shape.cx, 260 + index * 60)
    const cy = finiteNumber(shape.cy, 190)
    const width = finiteNumber(shape.width, 170)
    const height = finiteNumber(shape.height, 170)
    return [
      { x: cx, y: cy - height / 2 },
      { x: cx + width / 2, y: cy },
      { x: cx, y: cy + height / 2 },
      { x: cx - width / 2, y: cy },
    ]
  }
  if (type === 'pentagon' || type === 'hexagon') {
    const cx = finiteNumber(shape.cx, 250 + index * 70)
    const cy = finiteNumber(shape.cy, 190)
    const radius = finiteNumber(shape.r ?? shape.radius, 95)
    const sides = type === 'pentagon' ? 5 : 6
    const rotation = type === 'pentagon' ? -Math.PI / 2 : Math.PI / 6
    return Array.from({ length: sides }, (_, pointIndex) => {
      const angle = rotation + (pointIndex / sides) * Math.PI * 2
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    })
  }
  return []
}

function boundsFromPoints(points: SvgPoint[]): SvgBounds | null {
  if (points.length === 0) return null
  return points.reduce<SvgBounds>((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: points[0]?.x ?? 0,
    minY: points[0]?.y ?? 0,
    maxX: points[0]?.x ?? 0,
    maxY: points[0]?.y ?? 0,
  })
}

function mergeBounds(bounds: Array<SvgBounds | null>): SvgBounds | null {
  const present = bounds.filter((item): item is SvgBounds => Boolean(item))
  if (present.length === 0) return null
  return present.reduce<SvgBounds>((merged, item) => ({
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY),
  }), present[0] as SvgBounds)
}

function setShapeBounds(shape: Record<string, unknown>, index: number): SvgBounds | null {
  const type = setShapeType(shape)
  if (type === 'circle') {
    const cx = finiteNumber(shape.cx, 180 + index * 90)
    const cy = finiteNumber(shape.cy, 190)
    const radius = finiteNumber(shape.r, 95)
    return { minX: cx - radius, minY: cy - radius, maxX: cx + radius, maxY: cy + radius }
  }
  if (type === 'ellipse') {
    const cx = finiteNumber(shape.cx, 210 + index * 95)
    const cy = finiteNumber(shape.cy, 190)
    const rx = finiteNumber(shape.rx, 120)
    const ry = finiteNumber(shape.ry, 82)
    return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry }
  }
  return boundsFromPoints(polygonPoints(shape, index))
}

function normalizeShapeMinimumSize(shape: Record<string, unknown>, index: number): Record<string, unknown> {
  const type = setShapeType(shape)
  const bounds = setShapeBounds(shape, index)
  if (!bounds) return shape
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const minWidth = type === 'circle' || type === 'ellipse' ? 140 : 165
  const minHeight = type === 'circle' || type === 'ellipse' ? 110 : 145

  if (type === 'circle') {
    const current = finiteNumber(shape.r, 95)
    return { ...shape, r: Math.max(current, Math.max(minWidth, minHeight) / 2) }
  }
  if (type === 'ellipse') {
    return {
      ...shape,
      rx: Math.max(finiteNumber(shape.rx, 120), minWidth / 2),
      ry: Math.max(finiteNumber(shape.ry, 82), minHeight / 2),
    }
  }
  if (type === 'rect' || type === 'triangle') {
    const nextWidth = Math.max(finiteNumber(shape.width, type === 'rect' ? 170 : 210), minWidth)
    const nextHeight = Math.max(finiteNumber(shape.height, type === 'rect' ? 160 : 220), minHeight)
    return {
      ...shape,
      x: finiteNumber(shape.x, type === 'rect' ? 120 + index * 70 : 160 + index * 80) - (nextWidth - width) / 2,
      y: finiteNumber(shape.y, type === 'rect' ? 115 : 80) - (nextHeight - height) / 2,
      width: nextWidth,
      height: nextHeight,
    }
  }
  if (type === 'diamond') {
    return {
      ...shape,
      width: Math.max(finiteNumber(shape.width, 170), minWidth),
      height: Math.max(finiteNumber(shape.height, 170), minHeight),
    }
  }
  return {
    ...shape,
    r: Math.max(finiteNumber(shape.r ?? shape.radius, 95), Math.max(minWidth, minHeight) / 2),
  }
}

function transformNumericRecordCoordinates(record: Record<string, unknown>, transform: (point: SvgPoint) => SvgPoint): Record<string, unknown> {
  const next = { ...record }
  if (Number.isFinite(Number(record.x)) && Number.isFinite(Number(record.y))) {
    const point = transform({ x: finiteNumber(record.x, 320), y: finiteNumber(record.y, 220) })
    next.x = point.x
    next.y = point.y
  }
  return next
}

function transformSetShape(shape: Record<string, unknown>, index: number, scale: number, transform: (point: SvgPoint) => SvgPoint): Record<string, unknown> {
  const next = { ...shape }
  const type = setShapeType(shape)
  if (type === 'circle' || type === 'ellipse' || type === 'diamond' || type === 'pentagon' || type === 'hexagon') {
    const defaultCenter = type === 'ellipse'
      ? { x: 210 + index * 95, y: 190 }
      : type === 'diamond'
        ? { x: 260 + index * 60, y: 190 }
        : { x: 250 + index * 70, y: 190 }
    const point = transform({
      x: finiteNumber(shape.cx, defaultCenter.x),
      y: finiteNumber(shape.cy, defaultCenter.y),
    })
    next.cx = point.x
    next.cy = point.y
  }
  if (type === 'rect' || type === 'triangle') {
    const point = transform({
      x: finiteNumber(shape.x, type === 'rect' ? 120 + index * 70 : 160 + index * 80),
      y: finiteNumber(shape.y, type === 'rect' ? 115 : 80),
    })
    next.x = point.x
    next.y = point.y
  }
  if (Number.isFinite(Number(shape.labelX)) && Number.isFinite(Number(shape.labelY))) {
    const point = transform({ x: finiteNumber(shape.labelX, 320), y: finiteNumber(shape.labelY, 80) })
    next.labelX = point.x
    next.labelY = point.y
  }
  if (type === 'circle') next.r = finiteNumber(shape.r, 95) * scale
  if (type === 'ellipse') {
    next.rx = finiteNumber(shape.rx, 120) * scale
    next.ry = finiteNumber(shape.ry, 82) * scale
  }
  if (type === 'rect' || type === 'triangle' || type === 'diamond') {
    next.width = finiteNumber(shape.width, type === 'triangle' ? 210 : 170) * scale
    next.height = finiteNumber(shape.height, type === 'triangle' ? 220 : type === 'rect' ? 160 : 170) * scale
  }
  if (type === 'pentagon' || type === 'hexagon') next.r = finiteNumber(shape.r ?? shape.radius, 95) * scale
  return normalizeShapeMinimumSize(next, index)
}

function normalizeSetDiagramGeometry(
  shapes: Array<Record<string, unknown>>,
  values: unknown[]
): { shapes: Array<Record<string, unknown>>; values: unknown[] } {
  const bounds = mergeBounds(shapes.map((shape, index) => setShapeBounds(shape, index)))
  if (!bounds) return { shapes, values }

  const target = { minX: 42, minY: 58, maxX: 520, maxY: 352 }
  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX)
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY)
  const targetWidth = target.maxX - target.minX
  const targetHeight = target.maxY - target.minY
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const scaledWidth = sourceWidth * scale
  const scaledHeight = sourceHeight * scale
  const offsetX = target.minX + (targetWidth - scaledWidth) / 2
  const offsetY = target.minY + (targetHeight - scaledHeight) / 2
  const transform = (point: SvgPoint): SvgPoint => ({
    x: offsetX + (point.x - bounds.minX) * scale,
    y: offsetY + (point.y - bounds.minY) * scale,
  })

  return {
    shapes: shapes.map((shape, index) => transformSetShape(shape, index, scale, transform)),
    values: values.map((raw) => raw && typeof raw === 'object'
      ? transformNumericRecordCoordinates(raw as Record<string, unknown>, transform)
      : raw),
  }
}

function distanceToSegment(point: SvgPoint, a: SvgPoint, b: SvgPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function pointNearSetBoundary(point: SvgPoint, shape: Record<string, unknown>, index: number, tolerance = 34): boolean {
  return distanceToSetBoundary(point, shape, index) < tolerance
}

function distanceToSetBoundary(point: SvgPoint, shape: Record<string, unknown>, index: number): number {
  const type = setShapeType(shape)
  if (type === 'circle') {
    const cx = finiteNumber(shape.cx, 180 + index * 90)
    const cy = finiteNumber(shape.cy, 190)
    const radius = finiteNumber(shape.r, 95)
    return Math.abs(Math.hypot(point.x - cx, point.y - cy) - radius)
  }
  if (type === 'ellipse') {
    const cx = finiteNumber(shape.cx, 210 + index * 95)
    const cy = finiteNumber(shape.cy, 190)
    const rx = finiteNumber(shape.rx, 120)
    const ry = finiteNumber(shape.ry, 82)
    const value = Math.sqrt(((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2)
    return Math.abs(value - 1) * Math.min(rx, ry)
  }
  if (type === 'rect') {
    const x = finiteNumber(shape.x, 120 + index * 70)
    const y = finiteNumber(shape.y, 115)
    const width = finiteNumber(shape.width, 170)
    const height = finiteNumber(shape.height, 160)
    if (point.x < x || point.x > x + width || point.y < y || point.y > y + height) {
      const dx = Math.max(x - point.x, 0, point.x - (x + width))
      const dy = Math.max(y - point.y, 0, point.y - (y + height))
      return Math.hypot(dx, dy)
    }
    return Math.min(point.x - x, x + width - point.x, point.y - y, y + height - point.y)
  }
  const points = polygonPoints(shape, index)
  if (points.length === 0) return Number.POSITIVE_INFINITY
  return Math.min(...points.map((a, pointIndex) => distanceToSegment(point, a, points[(pointIndex + 1) % points.length] ?? a)))
}

function pointInsideSetShape(point: SvgPoint, shape: Record<string, unknown>, index: number): boolean {
  const type = setShapeType(shape)
  if (type === 'circle') {
    const cx = finiteNumber(shape.cx, 180 + index * 90)
    const cy = finiteNumber(shape.cy, 190)
    const radius = finiteNumber(shape.r, 95)
    return Math.hypot(point.x - cx, point.y - cy) <= radius
  }
  if (type === 'ellipse') {
    const cx = finiteNumber(shape.cx, 210 + index * 95)
    const cy = finiteNumber(shape.cy, 190)
    const rx = finiteNumber(shape.rx, 120)
    const ry = finiteNumber(shape.ry, 82)
    return ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2 <= 1
  }
  if (type === 'rect') {
    const x = finiteNumber(shape.x, 120 + index * 70)
    const y = finiteNumber(shape.y, 115)
    const width = finiteNumber(shape.width, 170)
    const height = finiteNumber(shape.height, 160)
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
  }
  const points = polygonPoints(shape, index)
  let inside = false
  for (let pointIndex = 0, previousIndex = points.length - 1; pointIndex < points.length; previousIndex = pointIndex, pointIndex += 1) {
    const a = points[pointIndex]
    const b = points[previousIndex]
    if (!a || !b) continue
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function stringSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()
  return new Set(value.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean))
}

function parseSetRegionExpression(value: unknown): { include: Set<string>; exclude: Set<string> } {
  const include = new Set<string>()
  const exclude = new Set<string>()
  const text = String(value ?? '').trim()
  if (!text) return { include, exclude }
  const normalized = text
    .replace(/\bonly\b/giu, '')
    .replace(/\boutside\b/giu, 'outside')
    .replace(/[∩&+,]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  if (normalized.toLowerCase() === 'outside') return { include, exclude: new Set(['*']) }
  const tokens = normalized.split(/\s+/u)
  let negateNext = false
  for (const rawToken of tokens) {
    const token = rawToken.trim()
    if (!token) continue
    if (/^(?:not|no|without|exclude|¬|!|not_)$/iu.test(token)) {
      negateNext = true
      continue
    }
    const cleaned = token.replace(/^(?:not_|!|¬)/iu, '').trim().toLowerCase()
    if (!cleaned) continue
    if (negateNext || cleaned !== token.toLowerCase()) exclude.add(cleaned)
    else include.add(cleaned)
    negateNext = false
  }
  return { include, exclude }
}

function regionExpressionForLabel(record: Record<string, unknown>): { include: Set<string>; exclude: Set<string> } {
  const include = stringSet(record.include)
  const exclude = stringSet(record.exclude)
  const parsed = parseSetRegionExpression(record.region)
  parsed.include.forEach((item) => include.add(item))
  parsed.exclude.forEach((item) => exclude.add(item))
  return { include, exclude }
}

function hasSetRegionExpression(record: Record<string, unknown>): boolean {
  const { include, exclude } = regionExpressionForLabel(record)
  return include.size > 0 || exclude.size > 0
}

function regionMatchesPoint(
  point: SvgPoint,
  shapeRecords: Array<{ raw: Record<string, unknown>; index: number; id: string }>,
  include: Set<string>,
  exclude: Set<string>
): boolean {
  for (const shape of shapeRecords) {
    const id = shape.id.toLowerCase()
    const label = String(shape.raw.label ?? '').trim().toLowerCase()
    const inside = pointInsideSetShape(point, shape.raw, shape.index)
    const included = include.has(id) || (label && include.has(label))
    const excluded = exclude.has(id) || (label && exclude.has(label)) || exclude.has('*')
    if (included && !inside) return false
    if (excluded && inside) return false
  }
  return true
}

function placementForSetRegion(
  record: Record<string, unknown>,
  shapes: unknown[],
  fallback: SvgPoint,
  placed: SvgLabelBox[] = [],
  text = '',
  requestedFontSize = 18
): { point: SvgPoint; fontSize: number } | null {
  const fontSizes = Array.from(
    new Set([requestedFontSize, 17, 16, 15, 14, 13, 12, 11, 10].filter((size) => Number.isFinite(size) && size >= 10))
  ).sort((a, b) => b - a)
  for (const fontSize of fontSizes) {
    const point = pointForSetRegionAtFontSize(record, shapes, fallback, placed, text, fontSize, 4, true) ??
      pointForSetRegionAtFontSize(record, shapes, fallback, placed, text, fontSize, 0, true) ??
      pointForSetRegionAtFontSize(record, shapes, fallback, placed, text, fontSize, 0, false)
    if (point) return { point, fontSize }
  }
  return null
}

function pointForSetRegionAtFontSize(
  record: Record<string, unknown>,
  shapes: unknown[],
  fallback: SvgPoint,
  placed: SvgLabelBox[] = [],
  text = '',
  fontSize = 18,
  minAnchorClearance = 4,
  avoidPlacedLabels = true
): SvgPoint | null {
  const { include, exclude } = regionExpressionForLabel(record)
  if (include.size === 0 && exclude.size === 0) return fallback
  const shapeRecords = setShapeRecords(shapes).map((shape) => ({
    ...shape,
    id: setShapeId(shape.raw, shape.index),
  }))
  if (shapeRecords.length === 0) return fallback
  applyOnlyRegionExclusions(record, shapeRecords, include, exclude)
  let best: { point: SvgPoint; score: number } | null = null
  const candidates: SvgPoint[] = [
    fallback,
    ...candidatePoints(fallback),
  ]
  for (let y = 58; y <= 384; y += 4) {
    for (let x = 36; x <= 684; x += 4) {
      candidates.push({ x, y })
    }
  }
  for (const point of candidates) {
    const box = labelBox(point, text, fontSize)
    const outOfBounds = box.x - box.width / 2 < 24 || box.x + box.width / 2 > 696 || box.y - box.fontSize < 44 || box.y > 412
    if (outOfBounds) continue
    if (!labelAnchorFitsSetRegion(point, shapeRecords, include, exclude, minAnchorClearance)) continue
    if (avoidPlacedLabels && placed.some((item) => labelsOverlap(box, item))) continue
    const boundaryClearance = Math.min(...shapeRecords.map((shape) => distanceToSetBoundary(point, shape.raw, shape.index)))
    const includedCenters = shapeRecords
      .filter((shape) => include.has(shape.id.toLowerCase()) || include.has(String(shape.raw.label ?? '').trim().toLowerCase()))
      .map((shape) => shapeCenter(shape.raw, shape.index))
    const centerScore = includedCenters.length > 0
      ? includedCenters.reduce((sum, center) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0) / includedCenters.length
      : Math.hypot(point.x - 360, point.y - 215)
    const labelClearance = placed.length > 0
      ? Math.min(...placed.map((item) => Math.hypot(point.x - item.x, point.y - item.y)))
      : 120
    const score = centerScore + Math.hypot(point.x - fallback.x, point.y - fallback.y) * 0.06 - labelClearance * 0.2 - boundaryClearance * 2
    if (!best || score < best.score) best = { point, score }
  }
  return best?.point ?? null
}

function applyOnlyRegionExclusions(
  record: Record<string, unknown>,
  shapeRecords: Array<{ raw: Record<string, unknown>; index: number; id: string }>,
  include: Set<string>,
  exclude: Set<string>
) {
  const regionText = String(record.region ?? '').toLowerCase()
  if (!/\bonly\b/u.test(regionText) || include.size === 0) return
  for (const shape of shapeRecords) {
    const id = shape.id.toLowerCase()
    const label = String(shape.raw.label ?? '').trim().toLowerCase()
    const included = include.has(id) || (label && include.has(label))
    if (included) continue
    exclude.add(id)
    if (label) exclude.add(label)
  }
}

function labelAnchorFitsSetRegion(
  point: SvgPoint,
  shapeRecords: Array<{ raw: Record<string, unknown>; index: number; id: string }>,
  include: Set<string>,
  exclude: Set<string>,
  minClearance: number
): boolean {
  if (!regionMatchesPoint(point, shapeRecords, include, exclude)) return false
  return shapeRecords.every((shape) => distanceToSetBoundary(point, shape.raw, shape.index) >= minClearance)
}

function semanticSetLabelPlacement(
  record: Record<string, unknown>,
  shapes: unknown[],
  fallbackPoint: SvgPoint,
  placed: SvgLabelBox[],
  text: string,
  fontSize: number
): { point: SvgPoint; fontSize: number } | null {
  const shapeRecords = setShapeRecords(shapes).map((shape) => ({
    ...shape,
    id: setShapeId(shape.raw, shape.index),
  }))
  const { include, exclude } = regionExpressionForLabel(record)
  applyOnlyRegionExclusions(record, shapeRecords, include, exclude)
  const fallbackBox = labelBox(fallbackPoint, text, fontSize)
  const fallbackIsClear =
    labelAnchorFitsSetRegion(fallbackPoint, shapeRecords, include, exclude, 10) &&
    !placed.some((item) => labelsOverlap(fallbackBox, item))
  if (fallbackIsClear) return { point: fallbackPoint, fontSize }
  return placementForSetRegion(record, shapes, fallbackPoint, placed, text, fontSize)
}

function labelWidth(text: string, fontSize: number): number {
  return Math.max(18, text.length * fontSize * 0.58 + 10)
}

function labelBox(point: SvgPoint, text: string, fontSize: number): SvgLabelBox {
  return { ...point, width: labelWidth(text, fontSize), height: fontSize + 8, fontSize, text }
}

function labelsOverlap(a: SvgLabelBox, b: SvgLabelBox): boolean {
  const horizontal = Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 8
  const vertical = Math.abs((a.y - a.fontSize / 2) - (b.y - b.fontSize / 2)) < (a.height + b.height) / 2 + 6
  return horizontal && vertical
}

function labelBoundaryProbePoints(box: SvgLabelBox): SvgPoint[] {
  const halfWidth = box.width / 2
  const top = box.y - box.fontSize
  const bottom = box.y + 4
  return [
    { x: box.x, y: box.y - box.fontSize / 2 },
    { x: box.x - halfWidth, y: box.y - box.fontSize / 2 },
    { x: box.x + halfWidth, y: box.y - box.fontSize / 2 },
    { x: box.x - halfWidth, y: top },
    { x: box.x + halfWidth, y: top },
    { x: box.x - halfWidth, y: bottom },
    { x: box.x + halfWidth, y: bottom },
    { x: box.x, y: top },
    { x: box.x, y: bottom },
  ]
}

function setShapeRecords(shapes: unknown[]): Array<{ raw: Record<string, unknown>; index: number }> {
  return shapes
    .map((raw, index) => ({ raw, index }))
    .filter((item): item is { raw: Record<string, unknown>; index: number } => item.raw != null && typeof item.raw === 'object')
}

function candidatePoints(origin: SvgPoint): SvgPoint[] {
  const candidates: SvgPoint[] = [origin]
  const radii = [18, 30, 44, 62, 84, 112, 145]
  const angles = Array.from({ length: 16 }, (_, index) => (index / 16) * Math.PI * 2)
  for (const radius of radii) {
    for (const angle of angles) {
      candidates.push({ x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius })
    }
  }
  return candidates
}

function shapeCenter(shape: Record<string, unknown>, index: number): SvgPoint {
  const type = setShapeType(shape)
  if (type === 'circle') return { x: finiteNumber(shape.cx, 180 + index * 90), y: finiteNumber(shape.cy, 190) }
  if (type === 'ellipse') return { x: finiteNumber(shape.cx, 210 + index * 95), y: finiteNumber(shape.cy, 190) }
  if (type === 'rect') {
    return {
      x: finiteNumber(shape.x, 120 + index * 70) + finiteNumber(shape.width, 170) / 2,
      y: finiteNumber(shape.y, 115) + finiteNumber(shape.height, 160) / 2,
    }
  }
  if (type === 'triangle') {
    return {
      x: finiteNumber(shape.x, 160 + index * 80) + finiteNumber(shape.width, 210) / 2,
      y: finiteNumber(shape.y, 80) + finiteNumber(shape.height, 220) * 0.62,
    }
  }
  return {
    x: finiteNumber(shape.cx, 250 + index * 70),
    y: finiteNumber(shape.cy, 190),
  }
}

function placeSetLabel(
  origin: SvgPoint,
  text: string,
  fontSize: number,
  shapes: unknown[],
  placed: SvgLabelBox[],
  options: { avoidBoundaries: boolean; minX?: number; maxX?: number; minY?: number; maxY?: number }
): SvgLabelBox {
  const shapeRecords = setShapeRecords(shapes)
  const minX = options.minX ?? 42
  const maxX = options.maxX ?? 665
  const minY = options.minY ?? 28
  const maxY = options.maxY ?? 380
  let best: { box: SvgLabelBox; score: number } | null = null

  for (const point of candidatePoints(origin)) {
    const box = labelBox(point, text, fontSize)
    const outOfBounds = box.x - box.width / 2 < minX || box.x + box.width / 2 > maxX || box.y - box.fontSize < minY || box.y > maxY
    const overlaps = placed.some((item) => labelsOverlap(box, item))
    const nearBoundary = options.avoidBoundaries && labelBoundaryProbePoints(box).some((probe) =>
      shapeRecords.some((item) => pointNearSetBoundary(probe, item.raw, item.index))
    )
    const hardPenalty = (outOfBounds ? 10000 : 0) + (overlaps ? 6000 : 0) + (nearBoundary ? 3000 : 0)
    const distance = Math.hypot(point.x - origin.x, point.y - origin.y)
    const score = hardPenalty + distance
    if (!best || score < best.score) best = { box, score }
    if (!outOfBounds && !overlaps && !nearBoundary) return box
  }

  return best?.box ?? labelBox(origin, text, fontSize)
}

function defaultShapeLabelOrigin(shape: Record<string, unknown>, index: number): SvgPoint {
  const type = setShapeType(shape)
  if (shape.labelX != null || shape.labelY != null) {
    return {
      x: finiteNumber(shape.labelX, 320),
      y: finiteNumber(shape.labelY, 80),
    }
  }
  if (type === 'circle') {
    const cx = finiteNumber(shape.cx, 180 + index * 90)
    const cy = finiteNumber(shape.cy, 190)
    const radius = finiteNumber(shape.r, 95)
    return { x: cx, y: cy - radius - 12 }
  }
  if (type === 'ellipse') {
    const cx = finiteNumber(shape.cx, 210 + index * 95)
    const cy = finiteNumber(shape.cy, 190)
    const ry = finiteNumber(shape.ry, 82)
    return { x: cx, y: cy - ry - 12 }
  }
  if (type === 'rect') {
    return { x: finiteNumber(shape.x, 120 + index * 70) + 46, y: finiteNumber(shape.y, 115) - 12 }
  }
  if (type === 'triangle') {
    const x = finiteNumber(shape.x, 160 + index * 80)
    const y = finiteNumber(shape.y, 80)
    const width = finiteNumber(shape.width, 210)
    return { x: x + width / 2, y: y - 12 }
  }
  if (type === 'diamond') {
    const cx = finiteNumber(shape.cx, 260 + index * 60)
    const cy = finiteNumber(shape.cy, 190)
    const height = finiteNumber(shape.height, 170)
    return { x: cx, y: cy - height / 2 - 12 }
  }
  const cx = finiteNumber(shape.cx, 250 + index * 70)
  const cy = finiteNumber(shape.cy, 190)
  const radius = finiteNumber(shape.r ?? shape.radius, 95)
  return { x: cx, y: cy - radius - 12 }
}

function renderSetNameLabels(
  labelledShapes: Array<{ record: Record<string, unknown>; index: number }>,
  shapes: unknown[],
  placed: SvgLabelBox[]
): string {
  return labelledShapes.map(({ record, index }) => {
    const text = String(record.label ?? '')
    const fontSize = 15
    const box = placeSetLabel(defaultShapeLabelOrigin(record, index), text, fontSize, shapes, placed, {
      avoidBoundaries: true,
      maxX: 560,
      minY: 34,
    })
    placed.push(box)
    const rect = `<rect x="${box.x - box.width / 2}" y="${box.y - fontSize}" width="${box.width}" height="${box.height}" rx="3" fill="white" fill-opacity="0.9"/>`
    return `${rect}<text x="${box.x}" y="${box.y}" font-size="${fontSize}" font-family="Arial, sans-serif" text-anchor="middle" font-weight="600">${escapeXml(text)}</text>`
  }).join('')
}

function renderLegendSwatch(shape: Record<string, unknown>, index: number, x: number, y: number): string {
  const type = setShapeType(shape)
  const common = 'fill="none" stroke="#111" stroke-width="2"'
  if (type === 'circle') return `<circle cx="${x + 15}" cy="${y - 5}" r="11" ${common}/>`
  if (type === 'ellipse') return `<ellipse cx="${x + 15}" cy="${y - 5}" rx="15" ry="10" ${common}/>`
  if (type === 'rect') return `<rect x="${x + 3}" y="${y - 16}" width="24" height="20" ${common}/>`
  if (type === 'triangle') return `<polygon points="${x + 15},${y - 18} ${x + 2},${y + 5} ${x + 28},${y + 5}" ${common}/>`
  if (type === 'diamond') return `<polygon points="${x + 15},${y - 19} ${x + 30},${y - 5} ${x + 15},${y + 9} ${x},${y - 5}" ${common}/>`
  const sides = type === 'pentagon' ? 5 : 6
  const rotation = type === 'pentagon' ? -Math.PI / 2 : Math.PI / 6
  const points = Array.from({ length: sides }, (_, pointIndex) => {
    const angle = rotation + (pointIndex / sides) * Math.PI * 2
    return `${x + 15 + Math.cos(angle) * 13},${y - 5 + Math.sin(angle) * 13}`
  }).join(' ')
  return `<polygon points="${points}" ${common}/>`
}

function renderSetLegend(labelledShapes: Array<{ record: Record<string, unknown>; index: number }>): string {
  return labelledShapes.map(({ record, index }, legendIndex) => {
    const x = 560
    const y = 78 + legendIndex * 62
    return `${renderLegendSwatch(record, index, x, y)}<text x="${x + 50}" y="${y}" font-size="15" font-family="Arial, sans-serif">${escapeXml(String(record.label))}</text>`
  }).join('')
}

function legendShapeType(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'rectangle') return 'rect'
  if (normalized === 'oval') return 'ellipse'
  return ['circle', 'ellipse', 'rect', 'triangle', 'diamond', 'pentagon', 'hexagon'].includes(normalized)
    ? normalized
    : null
}

function parseRegionLegendText(value: unknown): { shape: string; label: string } | null {
  const text = String(value ?? '').trim()
  const match = text.match(/^(circle|ellipse|oval|rect|rectangle|triangle|diamond|pentagon|hexagon)\s*=\s*(.+)$/iu)
  if (!match?.[1] || !match[2]) return null
  const shape = legendShapeType(match[1])
  const label = match[2].trim()
  return shape && label ? { shape, label } : null
}

function isNumericRegionLabel(value: unknown): boolean {
  return /^-?\d+(?:\.\d+)?$/u.test(String(value ?? '').trim())
}

function normalizeSetDiagramInputs(shapes: unknown[], values: unknown[]): {
  shapes: Array<Record<string, unknown>>
  values: unknown[]
} {
  let normalizedShapes = shapes
    .map((raw) => raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : null)
    .filter((shape): shape is Record<string, unknown> => Boolean(shape))
  const numericValues: unknown[] = []
  const legendEntries: Array<{ shape: string; label: string }> = []

  for (const raw of values) {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const text = record.text ?? record.value ?? ''
    const legendEntry = parseRegionLegendText(text)
    if (legendEntry) {
      legendEntries.push(legendEntry)
      continue
    }
    if (String(text).trim().toLowerCase() === 'legend') continue
    if (isNumericRegionLabel(text)) numericValues.push(raw)
  }

  for (const entry of legendEntries) {
    const candidates = normalizedShapes.filter((shape) => setShapeType(shape) === entry.shape)
    if (candidates.length === 1 && !candidates[0]?.label) candidates[0].label = entry.label
  }

  return normalizeSetDiagramGeometry(normalizedShapes, numericValues)
}

function renderSetDiagram(spec: Record<string, unknown>, title: string | null | undefined): string {
  const rawShapes = Array.isArray(spec.shapes) ? spec.shapes : []
  const rawValues = Array.isArray(spec.regionLabels)
    ? spec.regionLabels
    : Array.isArray(spec.labels)
      ? spec.labels
      : Array.isArray(spec.regions)
        ? spec.regions
        : []
  const { shapes, values } = normalizeSetDiagramInputs(rawShapes, rawValues)
  const labelledShapes = shapes
    .map((record, index) => ({ record, index }))
    .filter((item): item is { record: Record<string, unknown>; index: number } => Boolean(item.record?.label))
  const shapeTypeCounts = new Map<string, number>()
  labelledShapes.forEach(({ record }) => shapeTypeCounts.set(setShapeType(record), (shapeTypeCounts.get(setShapeType(record)) ?? 0) + 1))
  const hasDuplicateLegendShape = labelledShapes.some(({ record }) => (shapeTypeCounts.get(setShapeType(record)) ?? 0) > 1)
  const useLegend = labelledShapes.length > 0 && !hasDuplicateLegendShape
  const shapeNodes = shapes
    .map((raw, index) => renderSetShape(raw, index))
    .join('')
  const placedLabels: SvgLabelBox[] = []
  const shapeLabelNodes = useLegend ? '' : renderSetNameLabels(labelledShapes, shapes, placedLabels)
  const legend = useLegend ? renderSetLegend(labelledShapes) : ''
  const labelNodes = values.map((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const text = String(record.text ?? record.value ?? '')
    const fontSize = Number(record.fontSize ?? 18)
    const fallbackPoint = { x: finiteNumber(record.x, 320), y: finiteNumber(record.y, 220) }
    const hasSemanticRegion = hasSetRegionExpression(record)
    const hasExplicitPoint = Number.isFinite(Number(record.x)) && Number.isFinite(Number(record.y))
    const placement = hasSemanticRegion
      ? semanticSetLabelPlacement(record, shapes, fallbackPoint, placedLabels, text, fontSize)
      : hasExplicitPoint
      ? { point: fallbackPoint, fontSize }
      : { point: fallbackPoint, fontSize }
    if (!placement) {
      throw new Error(`No safe label position found for set region "${String(record.region ?? text)}".`)
    }
    const box = hasSemanticRegion || hasExplicitPoint
      ? labelBox(placement.point, text, placement.fontSize)
      : placeSetLabel(
          placement.point,
          text,
          placement.fontSize,
          shapes,
          placedLabels,
          {
            avoidBoundaries: /\d/u.test(text),
            maxX: useLegend ? 540 : 665,
            minY: 46,
          }
        )
    placedLabels.push(box)
    const label = `<text x="${box.x}" y="${box.y}" font-size="${placement.fontSize}" font-family="Arial, sans-serif" text-anchor="middle" font-weight="${record.bold ? 700 : 500}">${escapeXml(text)}</text>`
    return label
  }).join('')
  const height = 430
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}"><rect width="100%" height="100%" fill="white"/>${title ? renderSvgTitle(title, 40, 34) : ''}<g transform="translate(0 ${title ? 34 : 0})">${shapeNodes}${shapeLabelNodes}${labelNodes}</g>${legend}</svg>`
}

function renderVennDiagram(spec: Record<string, unknown>, title: string | null | undefined): string {
  return renderSetDiagram(spec, title)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generatedVisualBlockToImageNode(block: Extract<GeneratedContentBlock, { type: 'visual' }>): Json {
  let svg: string
  if (block.visualType === 'vega_lite_chart') {
    throw new Error('vega_lite_chart visuals must be rendered on the server.')
  } else {
    svg = renderVennDiagram(block.spec, block.title)
  }

  return {
    type: 'image',
    attrs: {
      src: svgDataUri(svg),
      alt: '',
    },
  }
}

export async function generatedVisualBlockToImageNodeAsync(block: Extract<GeneratedContentBlock, { type: 'visual' }>): Promise<Json> {
  return generatedVisualBlockToImageNode(block)
}

export function getGeneratedVisualSpecIssue(block: Extract<GeneratedContentBlock, { type: 'visual' }>): string | null {
  const spec = block.spec
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return 'Visual spec must be an object.'

  if (block.visualType === 'vega_lite_chart') {
    if (!hasInlineVegaData(spec)) return 'vega_lite_chart needs inline data.values or datasets.'
    if (hasExternalVegaReference(spec)) return 'vega_lite_chart must not reference external urls.'
  }

  if (block.visualType === 'venn_diagram' || block.visualType === 'set_diagram') {
    const regions = spec.regions && typeof spec.regions === 'object' && !Array.isArray(spec.regions)
      ? Object.values(spec.regions).filter((value) => String(value ?? '').trim().length > 0)
      : []
    const regionLabels = Array.isArray(spec.regionLabels) ? spec.regionLabels : []
    const shapes = Array.isArray(spec.shapes) ? spec.shapes : []
    if (regions.length === 0 && regionLabels.length === 0 && shapes.length === 0) {
      return `${block.visualType} needs labelled regions, regionLabels, or shapes.`
    }
    const placementIssue = getSetDiagramPlacementIssue(spec)
    if (placementIssue) return placementIssue
  }

  return null
}

function hasInlineVegaData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasInlineVegaData)
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const data = record.data as Record<string, unknown>
    if (Array.isArray(data.values) && data.values.length > 0) return true
  }
  if (record.datasets && typeof record.datasets === 'object' && !Array.isArray(record.datasets)) {
    if (Object.values(record.datasets).some((dataset) => Array.isArray(dataset) && dataset.length > 0)) return true
  }
  return Object.values(record).some(hasInlineVegaData)
}

function hasExternalVegaReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasExternalVegaReference)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (['url', 'href', 'src'].includes(key.toLowerCase()) && typeof child === 'string' && child.trim()) return true
    return hasExternalVegaReference(child)
  })
}

function getSetDiagramPlacementIssue(spec: Record<string, unknown>): string | null {
  const rawShapes = Array.isArray(spec.shapes) ? spec.shapes : []
  const rawValues = Array.isArray(spec.regionLabels)
    ? spec.regionLabels
    : Array.isArray(spec.labels)
      ? spec.labels
      : Array.isArray(spec.regions)
        ? spec.regions
        : []
  const { shapes, values } = normalizeSetDiagramInputs(rawShapes, rawValues)
  if (shapes.length < 2) {
    return 'Generated set diagrams need at least two sets.'
  }
  const placedLabels: SvgLabelBox[] = []
  for (const raw of values) {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const text = String(record.text ?? record.value ?? '')
    if (!/\d/u.test(text)) continue
    const fontSize = Number(record.fontSize ?? 18)
    const fallbackPoint = { x: finiteNumber(record.x, 320), y: finiteNumber(record.y, 220) }
    if (!hasSetRegionExpression(record)) {
      return `Set diagram numeric label "${text}" needs a semantic set-region expression.`
    }
    const placement = semanticSetLabelPlacement(record, shapes, fallbackPoint, placedLabels, text, fontSize)
    if (!placement) return `Set diagram numeric label "${text}" cannot be placed safely inside its semantic region.`
    placedLabels.push(labelBox(placement.point, text, placement.fontSize))
  }
  return null
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
    if (block.type === 'visual') content.push(generatedVisualBlockToImageNode(block))
    if (block.type === 'image') content.push(imageNode(block))
  }
  return { type: 'doc', content: content.length > 0 ? content : [paragraph('')] }
}

export function generatedContentToProseMirror(value: string | GeneratedContentBlock[]): Json {
  if (typeof value === 'string' && value.includes('**')) return markedTextToProseMirror(value)
  if (typeof value === 'string') return plainTextToProseMirrorWithLineBreaks(value)
  return generatedBlocksToProseMirror(value)
}

export async function generatedBlocksToProseMirrorAsync(blocks: GeneratedContentBlock[]): Promise<Json> {
  const content: Json[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph') content.push(paragraph(block.text))
    if (block.type === 'list') content.push(listNode(block))
    if (block.type === 'table') {
      if (block.caption) content.push(paragraph(block.caption))
      content.push(tableNode(block))
    }
    if (block.type === 'visual') content.push(await generatedVisualBlockToImageNodeAsync(block))
    if (block.type === 'image') content.push(imageNode(block))
  }
  return { type: 'doc', content: content.length > 0 ? content : [paragraph('')] }
}

export async function generatedContentToProseMirrorAsync(value: string | GeneratedContentBlock[]): Promise<Json> {
  if (typeof value === 'string' && value.includes('**')) return markedTextToProseMirror(value)
  if (typeof value === 'string') return plainTextToProseMirrorWithLineBreaks(value)
  return generatedBlocksToProseMirrorAsync(value)
}

export function generatedContentToPlainText(value: string | GeneratedContentBlock[]): string {
  if (typeof value === 'string') return value.replace(/\*\*([^*\n]+)\*\*/gu, '$1')
  return value
    .map((block) => {
      if (block.type === 'paragraph') return block.text.replace(/\*\*([^*\n]+)\*\*/gu, '$1')
      if (block.type === 'list') return block.items.map((item) => `- ${item}`).join('\n')
      if (block.type === 'table') return [block.caption, block.columns.join('\t'), ...block.rows.map((row) => row.join('\t'))].filter(Boolean).join('\n')
      if (block.type === 'image') return block.altText ?? ''
      return [block.title, block.altText].filter(Boolean).join('\n')
    })
    .join('\n')
}
