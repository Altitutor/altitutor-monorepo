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

function distanceToSegment(point: SvgPoint, a: SvgPoint, b: SvgPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function pointNearSetBoundary(point: SvgPoint, shape: Record<string, unknown>, index: number, tolerance = 34): boolean {
  const type = setShapeType(shape)
  if (type === 'circle') {
    const cx = finiteNumber(shape.cx, 180 + index * 90)
    const cy = finiteNumber(shape.cy, 190)
    const radius = finiteNumber(shape.r, 95)
    return Math.abs(Math.hypot(point.x - cx, point.y - cy) - radius) < tolerance
  }
  if (type === 'ellipse') {
    const cx = finiteNumber(shape.cx, 210 + index * 95)
    const cy = finiteNumber(shape.cy, 190)
    const rx = finiteNumber(shape.rx, 120)
    const ry = finiteNumber(shape.ry, 82)
    const value = Math.sqrt(((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2)
    return Math.abs(value - 1) < tolerance / Math.max(rx, ry)
  }
  const points = polygonPoints(shape, index)
  return points.some((a, pointIndex) => distanceToSegment(point, a, points[(pointIndex + 1) % points.length] ?? a) < tolerance)
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

function pointForSetRegion(
  record: Record<string, unknown>,
  shapes: unknown[],
  fallback: SvgPoint,
  placed: SvgLabelBox[] = [],
  text = '',
  fontSize = 18
): SvgPoint {
  const { include, exclude } = regionExpressionForLabel(record)
  if (include.size === 0 && exclude.size === 0) return fallback
  const shapeRecords = setShapeRecords(shapes).map((shape) => ({
    ...shape,
    id: setShapeId(shape.raw, shape.index),
  }))
  if (shapeRecords.length === 0) return fallback
  let best: { point: SvgPoint; score: number } | null = null
  for (let y = 70; y <= 360; y += 14) {
    for (let x = 55; x <= 660; x += 14) {
      const point = { x, y }
      if (!regionMatchesPoint(point, shapeRecords, include, exclude)) continue
      const boundaryDistance = Math.min(
        ...shapeRecords.map((shape) =>
          pointNearSetBoundary(point, shape.raw, shape.index, 18) ? 0 : 18
        )
      )
      if (boundaryDistance === 0) continue
      const box = labelBox(point, text, fontSize)
      if (placed.some((item) => labelsOverlap(box, item))) continue
      const includedCenters = shapeRecords
        .filter((shape) => include.has(shape.id.toLowerCase()) || include.has(String(shape.raw.label ?? '').trim().toLowerCase()))
        .map((shape) => shapeCenter(shape.raw, shape.index))
      const centerScore = includedCenters.length > 0
        ? includedCenters.reduce((sum, center) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0) / includedCenters.length
        : Math.hypot(point.x - 360, point.y - 215)
      const labelClearance = placed.length > 0
        ? Math.min(...placed.map((item) => Math.hypot(point.x - item.x, point.y - item.y)))
        : 120
      const score = centerScore + Math.hypot(point.x - fallback.x, point.y - fallback.y) * 0.08 - labelClearance * 0.15
      if (!best || score < best.score) best = { point, score }
    }
  }
  return best?.point ?? fallback
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
    const column = legendIndex % 2
    const row = Math.floor(legendIndex / 2)
    const x = 92 + column * 300
    const y = 454 + row * 34
    return `${renderLegendSwatch(record, index, x, y)}<text x="${x + 42}" y="${y}" font-size="16" font-family="Arial, sans-serif">${escapeXml(String(record.label))}</text>`
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
  const normalizedShapes = shapes
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

  return { shapes: normalizedShapes, values: numericValues }
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
    const origin = hasSemanticRegion ? pointForSetRegion(record, shapes, fallbackPoint, placedLabels, text, fontSize) : fallbackPoint
    const box = placeSetLabel(
      origin,
      text,
      fontSize,
      shapes,
      placedLabels,
      {
        avoidBoundaries: /\d/u.test(text),
        maxX: useLegend ? 540 : 665,
        minY: 46,
      }
    )
    placedLabels.push(box)
    const paddingX = 5
    const width = Math.max(18, box.width + paddingX * 2)
    const height = fontSize + 8
    const rect = `<rect x="${box.x - width / 2}" y="${box.y - fontSize}" width="${width}" height="${height}" rx="3" fill="white" fill-opacity="0.9"/>`
    const label = `<text x="${box.x}" y="${box.y}" font-size="${fontSize}" font-family="Arial, sans-serif" text-anchor="middle" font-weight="${record.bold ? 700 : 500}">${escapeXml(text)}</text>`
    return `${rect}${label}`
  }).join('')
  const height = useLegend ? 520 : 430
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}"><rect width="100%" height="100%" fill="white"/>${title ? renderSvgTitle(title, 40, 34) : ''}<g transform="translate(0 ${title ? 34 : 0})">${shapeNodes}${shapeLabelNodes}${labelNodes}</g>${legend}</svg>`
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
  return renderRouteMap({ ...spec, points, lines }, title ?? 'Schematic map')
}

function mapLabelBox(point: SvgPoint, text: string, fontSize: number, placed: SvgLabelBox[], bounds: { minX: number; maxX: number; minY: number; maxY: number }): SvgLabelBox {
  let best: { box: SvgLabelBox; score: number } | null = null
  for (const candidate of candidatePoints(point)) {
    const box = labelBox(candidate, text, fontSize)
    const outOfBounds = box.x - box.width / 2 < bounds.minX || box.x + box.width / 2 > bounds.maxX || box.y - box.fontSize < bounds.minY || box.y > bounds.maxY
    const overlaps = placed.some((item) => labelsOverlap(box, item))
    const score = (outOfBounds ? 10000 : 0) + (overlaps ? 5000 : 0) + Math.hypot(candidate.x - point.x, candidate.y - point.y)
    if (!best || score < best.score) best = { box, score }
    if (!outOfBounds && !overlaps) return box
  }
  return best?.box ?? labelBox(point, text, fontSize)
}

function renderRouteMap(spec: Record<string, unknown>, title: string | null | undefined): string {
  const points = Array.isArray(spec.points) ? spec.points : []
  const rawLines = Array.isArray(spec.lines) ? spec.lines : Array.isArray(spec.paths) ? spec.paths : []
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
  const placedLabels: SvgLabelBox[] = []
  const svgLines = rawLines
    .map((raw) => {
      const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      const from = pointMap.get(String(record.from ?? ''))
      const to = pointMap.get(String(record.to ?? ''))
      if (!from || !to) return ''
      const label = String(record.label ?? '')
      const dx = to.x - from.x
      const dy = to.y - from.y
      const length = Math.max(1, Math.hypot(dx, dy))
      const offset = 18
      const origin = {
        x: (from.x + to.x) / 2 + (-dy / length) * offset,
        y: (from.y + to.y) / 2 + (dx / length) * offset,
      }
      const line = `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#111" stroke-width="3"/>`
      if (!label) return line
      const box = mapLabelBox(origin, label, 13, placedLabels, { minX: 26, maxX: 614, minY: 50, maxY: 330 })
      placedLabels.push(box)
      const rect = `<rect x="${box.x - box.width / 2}" y="${box.y - 13}" width="${box.width}" height="20" rx="3" fill="white" fill-opacity="0.92"/>`
      return `${line}${rect}<text x="${box.x}" y="${box.y}" text-anchor="middle" font-size="13" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    })
    .join('')
  const svgPoints = Array.from(pointMap.values())
    .map((point) => {
      const preferred = point.x <= 95
        ? { x: point.x + 24, y: point.y + 44 }
        : point.x >= 545
          ? { x: point.x - 48, y: point.y + 28 }
          : { x: point.x + 30, y: point.y - 14 }
      const box = mapLabelBox(preferred, point.label, 14, placedLabels, { minX: 20, maxX: 620, minY: 48, maxY: 340 })
      placedLabels.push(box)
      const rect = `<rect x="${box.x - box.width / 2}" y="${box.y - 14}" width="${box.width}" height="22" rx="3" fill="white" fill-opacity="0.9"/>`
      return `<circle cx="${point.x}" cy="${point.y}" r="8" fill="#2563eb"/>${rect}<text x="${box.x}" y="${box.y}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${escapeXml(point.label)}</text>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="100%" height="100%" fill="white"/><text x="32" y="34" font-size="20" font-family="Arial, sans-serif">${escapeXml(title ?? 'Route map')}</text>${svgLines}${svgPoints}</svg>`
}

function renderLayoutGrid(spec: Record<string, unknown>, title: string | null | undefined): string {
  const rows = Math.max(1, Math.min(8, Math.round(Number(spec.rows ?? 3))))
  const columns = Math.max(1, Math.min(8, Math.round(Number(spec.columns ?? 3))))
  const rowLabels = stringArray(spec.rowLabels)
  const columnLabels = stringArray(spec.columnLabels)
  const cells = Array.isArray(spec.cells) ? spec.cells : []
  const width = 640
  const cell = Math.min(78, Math.floor((width - 150) / Math.max(columns, 1)))
  const left = rowLabels.length > 0 ? 110 : 62
  const top = columnLabels.length > 0 ? 94 : 70
  const gridWidth = columns * cell
  const gridHeight = rows * cell
  const height = Math.max(260, top + gridHeight + 42)
  const cellMap = new Map<string, Record<string, unknown>>()
  cells.forEach((raw) => {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const row = Math.round(Number(record.row ?? 0))
    const column = Math.round(Number(record.column ?? 0))
    if (row >= 1 && row <= rows && column >= 1 && column <= columns) cellMap.set(`${row}:${column}`, record)
  })
  const columnNodes = columnLabels.map((label, index) =>
    `<text x="${left + index * cell + cell / 2}" y="${top - 16}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>`
  ).join('')
  const rowNodes = rowLabels.map((label, index) =>
    `<text x="${left - 16}" y="${top + index * cell + cell / 2 + 5}" text-anchor="end" font-size="14" font-family="Arial, sans-serif" font-weight="600">${escapeXml(label)}</text>`
  ).join('')
  const cellNodes = Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => {
      const x = left + columnIndex * cell
      const y = top + rowIndex * cell
      const record = cellMap.get(`${rowIndex + 1}:${columnIndex + 1}`) ?? {}
      const label = String(record.label ?? '').trim()
      const fill = String(record.fill ?? ((rowIndex + columnIndex) % 2 === 0 ? '#fff' : '#f8fafc'))
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" stroke="#111" stroke-width="1.5"/><text x="${x + cell / 2}" y="${y + cell / 2 + 5}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    }).join('')
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${renderSvgTitle(title ?? String(spec.title ?? 'Layout grid'), 32, 34)}${columnNodes}${rowNodes}<rect x="${left}" y="${top}" width="${gridWidth}" height="${gridHeight}" fill="none" stroke="#111" stroke-width="2.4"/>${cellNodes}</svg>`
}

function renderTimetable(spec: Record<string, unknown>, title: string | null | undefined): string {
  const columns = stringArray(spec.columns)
  const rows = Array.isArray(spec.rows)
    ? spec.rows.map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [])
    : []
  const width = 760
  const rowHeight = 38
  const headerHeight = 46
  const top = 86
  const left = 38
  const tableWidth = width - left * 2
  const colWidth = columns.length > 0 ? tableWidth / columns.length : tableWidth
  const height = Math.max(220, top + headerHeight + rows.length * rowHeight + 38)
  const caption = String(spec.caption ?? title ?? 'Timetable').trim()
  const header = columns.map((column, index) => {
    const x = left + index * colWidth
    return `<rect x="${x}" y="${top}" width="${colWidth}" height="${headerHeight}" fill="#f3f4f6" stroke="#111" stroke-width="1.4"/><text x="${x + colWidth / 2}" y="${top + 28}" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" font-weight="600">${escapeXml(column)}</text>`
  }).join('')
  const body = rows.map((row, rowIndex) => {
    const y = top + headerHeight + rowIndex * rowHeight
    return columns.map((_, columnIndex) => {
      const x = left + columnIndex * colWidth
      const text = row[columnIndex] ?? ''
      const fill = rowIndex % 2 === 0 ? '#fff' : '#fafafa'
      const weight = columnIndex < Number(spec.rowHeaderCount ?? 1) ? 600 : 400
      return `<rect x="${x}" y="${y}" width="${colWidth}" height="${rowHeight}" fill="${fill}" stroke="#111" stroke-width="1"/><text x="${x + colWidth / 2}" y="${y + 24}" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" font-weight="${weight}">${escapeXml(text)}</text>`
    }).join('')
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="${left}" y="38" font-size="20" font-family="Arial, sans-serif" font-weight="600">${escapeXml(caption)}</text>${header}${body}</svg>`
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
  } else if (block.visualType === 'route_map') {
    svg = renderRouteMap(block.spec, block.title)
  } else if (block.visualType === 'layout_grid') {
    svg = renderLayoutGrid(block.spec, block.title)
  } else if (block.visualType === 'timetable') {
    svg = renderTimetable(block.spec, block.title)
  } else {
    svg = renderSchematicMap(block.spec, block.title)
  }

  return {
    type: 'image',
    attrs: {
      src: svgDataUri(svg),
      alt: '',
    },
  }
}

export function getGeneratedVisualSpecIssue(block: Extract<GeneratedContentBlock, { type: 'visual' }>): string | null {
  const spec = block.spec
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return 'Visual spec must be an object.'

  const labels = stringArray(spec.labels)
  const values = numberArray(spec.values)
  const series = chartSeries(spec)
  const panels = Array.isArray(spec.panels)
    ? spec.panels.map((panel) => panel && typeof panel === 'object' ? panel as Record<string, unknown> : {})
    : []

  if (['bar_chart', 'histogram', 'stacked_bar_chart', 'line_chart'].includes(block.visualType)) {
    const hasSingleChartData = values.length > 0 || series.some((item) => item.values.length > 0)
    const hasPanelChartData = panels.some((panel) =>
      numberArray(panel.values).length > 0 || chartSeries(panel).some((item) => item.values.length > 0)
    )
    if (!hasSingleChartData && !hasPanelChartData) {
      return `${block.visualType} needs plotted numeric data in values, series, or panels.`
    }
    if (labels.length === 0 && panels.length === 0) {
      return `${block.visualType} needs category/time labels so the rendered chart is interpretable.`
    }
  }

  if (block.visualType === 'scatter_plot') {
    const hasPoints = Array.isArray(spec.points) && spec.points.length > 0
    const hasSeriesPoints = series.some((item) => (item.points?.length ?? 0) > 0)
    if (!hasPoints && !hasSeriesPoints) return 'scatter_plot needs plotted points.'
  }

  if (block.visualType === 'pie_chart') {
    const hasSinglePieData = labels.length > 0 && values.length > 0
    const hasPanelPieData = panels.some((panel) => stringArray(panel.labels).length > 0 && numberArray(panel.values).length > 0)
    if (!hasSinglePieData && !hasPanelPieData) return 'pie_chart needs labels and values.'
  }

  if (block.visualType === 'timetable') {
    const rows = Array.isArray(spec.rows) ? spec.rows : []
    if (stringArray(spec.columns).length === 0 || rows.length === 0) return 'timetable needs columns and rows.'
  }

  if (block.visualType === 'layout_grid') {
    const rowLabels = stringArray(spec.rowLabels)
    const columnLabels = stringArray(spec.columnLabels)
    const rows = Number(spec.rows)
    const columns = Number(spec.columns)
    if ((rowLabels.length === 0 || columnLabels.length === 0) && (!Number.isFinite(rows) || !Number.isFinite(columns))) {
      return 'layout_grid needs row/column labels or explicit row/column counts.'
    }
  }

  if (block.visualType === 'route_map') {
    if (!Array.isArray(spec.points) || spec.points.length === 0) return 'route_map needs labelled points.'
    if (!Array.isArray(spec.lines) || spec.lines.length === 0) return 'route_map needs lines between points.'
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
