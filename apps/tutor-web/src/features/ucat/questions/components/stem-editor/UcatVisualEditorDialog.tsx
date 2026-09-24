'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  ScrollArea,
  Textarea,
} from '@altitutor/ui'
import { AlertTriangle } from 'lucide-react'
import type { GeneratedContentBlock } from '@/features/ucat/questions/lib/ai-generation/schema'
import {
  generatedVisualBlockToImageNode,
  getSetDiagramManualPlacementWarnings,
  normalizeSetDiagramSpecForEditing,
  wrapSetLegendText,
} from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import type { EditableVisualType } from '@/features/ucat/shared/lib/selected-visual-image'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatVegaStyleControls } from './UcatVegaStyleControls'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'

type VisualBlock = Extract<GeneratedContentBlock, { type: 'visual' }>
type Selection = { kind: 'shape' | 'label'; index: number } | null
type Point = { x: number; y: number }
type Bounds = { x: number; y: number; width: number; height: number }

type UcatVisualEditorDialogProps = {
  open: boolean
  visualType: EditableVisualType
  spec: Record<string, unknown>
  title?: string | null
  altText?: string | null
  onOpenChange: (open: boolean) => void
  onApply: (imageNode: Json) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function shapeType(shape: Record<string, unknown>): string {
  const value = String(shape.type ?? shape.shape ?? 'ellipse')
  if (value === 'rectangle' || value === 'rounded_rectangle') return 'rect'
  if (value === 'oval') return 'ellipse'
  if (value === 'plus' || value === 'cruciform') return 'cross'
  return value
}

function pointsForShape(shape: Record<string, unknown>, index: number): Point[] {
  if (Array.isArray(shape.points)) {
    const points = shape.points.flatMap((value) => {
      if (Array.isArray(value) && value.length >= 2) return [{ x: numeric(value[0], 0), y: numeric(value[1], 0) }]
      if (isRecord(value)) return [{ x: numeric(value.x, 0), y: numeric(value.y, 0) }]
      return []
    })
    if (points.length >= 3) return points
  }
  const type = shapeType(shape)
  const x = numeric(shape.x, 140 + index * 65)
  const y = numeric(shape.y, 90)
  const width = numeric(shape.width, 190)
  const height = numeric(shape.height, 180)
  if (type === 'triangle') return [{ x: x + width / 2, y }, { x, y: y + height }, { x: x + width, y: y + height }]
  if (type === 'diamond') {
    const cx = numeric(shape.cx, x + width / 2)
    const cy = numeric(shape.cy, y + height / 2)
    return [{ x: cx, y: cy - height / 2 }, { x: cx + width / 2, y: cy }, { x: cx, y: cy + height / 2 }, { x: cx - width / 2, y: cy }]
  }
  if (type === 'pentagon' || type === 'hexagon') {
    const count = type === 'pentagon' ? 5 : 6
    const cx = numeric(shape.cx, 250 + index * 70)
    const cy = numeric(shape.cy, 190)
    const radius = numeric(shape.r ?? shape.radius, 95)
    const offset = type === 'pentagon' ? -Math.PI / 2 : Math.PI / 6
    return Array.from({ length: count }, (_, pointIndex) => {
      const angle = offset + (pointIndex / count) * Math.PI * 2
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    })
  }
  if (type === 'cross') {
    const armWidth = numeric(shape.armWidth, width * 0.36)
    const armHeight = numeric(shape.armHeight, height * 0.36)
    const left = x + (width - armWidth) / 2
    const right = left + armWidth
    const top = y + (height - armHeight) / 2
    const bottom = top + armHeight
    return [
      { x: left, y }, { x: right, y }, { x: right, y: top }, { x: x + width, y: top },
      { x: x + width, y: bottom }, { x: right, y: bottom }, { x: right, y: y + height },
      { x: left, y: y + height }, { x: left, y: bottom }, { x, y: bottom }, { x, y: top }, { x: left, y: top },
    ]
  }
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
}

function shapeBounds(shape: Record<string, unknown>, index: number): Bounds {
  const type = shapeType(shape)
  if (type === 'circle') {
    const r = numeric(shape.r ?? shape.radius, 95)
    const cx = numeric(shape.cx, 180 + index * 90)
    const cy = numeric(shape.cy, 190)
    return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
  }
  if (type === 'ellipse') {
    const rx = numeric(shape.rx, 120)
    const ry = numeric(shape.ry, 82)
    const cx = numeric(shape.cx, 210 + index * 95)
    const cy = numeric(shape.cy, 190)
    return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
  }
  const points = pointsForShape(shape, index)
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function moveShape(shape: Record<string, unknown>, index: number, dx: number, dy: number): Record<string, unknown> {
  const type = shapeType(shape)
  const next = { ...shape }
  if (['circle', 'ellipse', 'diamond', 'pentagon', 'hexagon'].includes(type)) {
    next.cx = numeric(shape.cx, shapeBounds(shape, index).x + shapeBounds(shape, index).width / 2) + dx
    next.cy = numeric(shape.cy, shapeBounds(shape, index).y + shapeBounds(shape, index).height / 2) + dy
  } else {
    next.x = numeric(shape.x, shapeBounds(shape, index).x) + dx
    next.y = numeric(shape.y, shapeBounds(shape, index).y) + dy
  }
  if (Array.isArray(shape.points)) {
    next.points = pointsForShape(shape, index).map((point) => ({ x: point.x + dx, y: point.y + dy }))
  }
  if (Number.isFinite(Number(shape.labelX))) next.labelX = numeric(shape.labelX, 0) + dx
  if (Number.isFinite(Number(shape.labelY))) next.labelY = numeric(shape.labelY, 0) + dy
  return next
}

function resizeShape(shape: Record<string, unknown>, index: number, dx: number, dy: number): Record<string, unknown> {
  const type = shapeType(shape)
  const bounds = shapeBounds(shape, index)
  const width = Math.max(24, bounds.width + dx)
  const height = Math.max(24, bounds.height + dy)
  if (type === 'circle') return { ...shape, r: Math.max(12, Math.max(width, height) / 2) }
  if (type === 'ellipse') return { ...shape, rx: width / 2, ry: height / 2 }
  if (Array.isArray(shape.points)) {
    const scaleX = width / Math.max(1, bounds.width)
    const scaleY = height / Math.max(1, bounds.height)
    return {
      ...shape,
      points: pointsForShape(shape, index).map((point) => ({
        x: bounds.x + (point.x - bounds.x) * scaleX,
        y: bounds.y + (point.y - bounds.y) * scaleY,
      })),
    }
  }
  return { ...shape, width, height }
}

function SetShape({ shape, index, selected, onPointerDown }: {
  shape: Record<string, unknown>
  index: number
  selected: boolean
  onPointerDown: (event: ReactPointerEvent<SVGElement>) => void
}) {
  const type = shapeType(shape)
  const stroke = selected ? '#2563eb' : String(shape.stroke ?? '#111111')
  const fill = String(shape.fill ?? '#ffffff')
  const common = { fill, fillOpacity: 0.12, stroke, strokeWidth: selected ? 4 : 2.5, onPointerDown, className: 'cursor-move' }
  if (type === 'circle') return <circle cx={numeric(shape.cx, 180 + index * 90)} cy={numeric(shape.cy, 190)} r={numeric(shape.r ?? shape.radius, 95)} {...common} />
  if (type === 'ellipse') return <ellipse cx={numeric(shape.cx, 210 + index * 95)} cy={numeric(shape.cy, 190)} rx={numeric(shape.rx, 120)} ry={numeric(shape.ry, 82)} {...common} />
  if (type === 'rect') return <rect x={numeric(shape.x, 120 + index * 70)} y={numeric(shape.y, 115)} width={numeric(shape.width, 170)} height={numeric(shape.height, 160)} {...common} />
  return <polygon points={pointsForShape(shape, index).map((point) => `${point.x},${point.y}`).join(' ')} {...common} />
}

function SetLegendSwatch({ shape, x, y, selected }: {
  shape: Record<string, unknown>
  x: number
  y: number
  selected: boolean
}) {
  const type = shapeType(shape)
  const stroke = selected ? '#2563eb' : '#111111'
  const common = { fill: 'none', stroke, strokeWidth: selected ? 3 : 2 }
  if (type === 'circle') return <circle cx={x + 15} cy={y - 5} r="11" {...common} />
  if (type === 'ellipse') return <ellipse cx={x + 15} cy={y - 5} rx="15" ry="10" {...common} />
  if (type === 'rect') return <rect x={x + 3} y={y - 16} width="24" height="20" {...common} />
  if (type === 'triangle') return <polygon points={`${x + 15},${y - 18} ${x + 2},${y + 5} ${x + 28},${y + 5}`} {...common} />
  if (type === 'diamond') return <polygon points={`${x + 15},${y - 19} ${x + 30},${y - 5} ${x + 15},${y + 9} ${x},${y - 5}`} {...common} />
  return <rect x={x + 3} y={y - 16} width="24" height="20" {...common} />
}

function setLegendItems(shapes: Array<Record<string, unknown>>) {
  const labelled = shapes
    .map((shape, index) => ({ shape, index }))
    .filter(({ shape }) => Boolean(String(shape.label ?? '').trim()))
  const counts = new Map<string, number>()
  labelled.forEach(({ shape }) => counts.set(shapeType(shape), (counts.get(shapeType(shape)) ?? 0) + 1))
  if (labelled.some(({ shape }) => (counts.get(shapeType(shape)) ?? 0) > 1)) return []
  let nextY = 78
  return labelled.map(({ shape, index }) => {
    const lines = wrapSetLegendText(shape.label)
    const item = { shape, index, y: nextY, lines }
    nextY += Math.max(62, lines.length * 18 + 26)
    return item
  })
}

function collectAxisControls(spec: Record<string, unknown>, path: Array<string | number> = []): Array<{ path: Array<string | number>; label: string; title: string }> {
  const controls: Array<{ path: Array<string | number>; label: string; title: string }> = []
  if (isRecord(spec.encoding)) {
    for (const [channel, value] of Object.entries(spec.encoding)) {
      if (!isRecord(value)) continue
      const axisOrLegend = ['color', 'fill', 'stroke', 'shape', 'size', 'opacity', 'strokeDash'].includes(channel)
        ? 'legend'
        : ['x', 'y', 'theta', 'radius'].includes(channel)
          ? 'axis'
          : null
      if (!axisOrLegend || value[axisOrLegend] === null) continue
      const config = isRecord(value[axisOrLegend]) ? value[axisOrLegend] as Record<string, unknown> : {}
      const layerNumbers = path.filter((part) => typeof part === 'number').map((part) => Number(part) + 1)
      const prefix = layerNumbers.length ? `Layer ${layerNumbers.join('.')} ` : ''
      controls.push({
        path: [...path, 'encoding', channel, axisOrLegend, 'title'],
        label: `${prefix}${channel.toUpperCase()} ${axisOrLegend}`,
        title: String(config.title ?? value.title ?? value.field ?? ''),
      })
    }
  }
  if (Array.isArray(spec.layer)) {
    spec.layer.forEach((layer, index) => {
      if (isRecord(layer)) controls.push(...collectAxisControls(layer, [...path, 'layer', index]))
    })
  }
  return controls
}

type VegaDataSource = { path: Array<string | number>; label: string; values: Array<Record<string, unknown>> }

function collectVegaDataSources(
  spec: Record<string, unknown>,
  path: Array<string | number> = [],
  label = 'Chart data',
): VegaDataSource[] {
  const sources: VegaDataSource[] = []
  if (isRecord(spec.data) && Array.isArray(spec.data.values) && spec.data.values.every(isRecord)) {
    sources.push({ path: [...path, 'data', 'values'], label, values: spec.data.values })
  }
  if (isRecord(spec.datasets)) {
    Object.entries(spec.datasets).forEach(([name, values]) => {
      if (Array.isArray(values) && values.every(isRecord)) {
        sources.push({ path: [...path, 'datasets', name], label: `Dataset: ${name}`, values })
      }
    })
  }
  for (const compositionKey of ['layer', 'concat', 'hconcat', 'vconcat'] as const) {
    const children = spec[compositionKey]
    if (!Array.isArray(children)) continue
    children.forEach((child, index) => {
      if (isRecord(child)) sources.push(...collectVegaDataSources(child, [...path, compositionKey, index], `${compositionKey} ${index + 1}`))
    })
  }
  if (isRecord(spec.spec)) sources.push(...collectVegaDataSources(spec.spec, [...path, 'spec'], 'Nested chart data'))
  return sources
}

function dataSourceKey(path: Array<string | number>): string {
  return JSON.stringify(path)
}

function setNested(record: Record<string, unknown>, path: Array<string | number>, value: unknown): Record<string, unknown> {
  const clone = structuredClone(record)
  let cursor: Record<string, unknown> | unknown[] = clone
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      if (Array.isArray(cursor) && typeof part === 'number') cursor[part] = value
      else if (!Array.isArray(cursor) && typeof part === 'string') cursor[part] = value
      return
    }
    const nextPart = path[index + 1]
    if (Array.isArray(cursor) && typeof part === 'number') {
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = typeof nextPart === 'number' ? [] : {}
      cursor = cursor[part] as Record<string, unknown> | unknown[]
    } else if (!Array.isArray(cursor) && typeof part === 'string') {
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = typeof nextPart === 'number' ? [] : {}
      cursor = cursor[part] as Record<string, unknown> | unknown[]
    }
  })
  return clone
}

export function UcatVisualEditorDialog({
  open,
  visualType,
  spec: initialSpec,
  title: initialTitle,
  altText: initialAltText,
  onOpenChange,
  onApply,
}: UcatVisualEditorDialogProps) {
  const isSetDiagram = visualType === 'venn_diagram' || visualType === 'set_diagram'
  const [spec, setSpec] = useState<Record<string, unknown>>(initialSpec)
  const [title, setTitle] = useState(initialTitle ?? '')
  const [altText, setAltText] = useState(initialAltText ?? '')
  const [selection, setSelection] = useState<Selection>(null)
  const [previewNode, setPreviewNode] = useState<Json | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [dataText, setDataText] = useState('[]')
  const [specText, setSpecText] = useState('{}')
  const [dataPathKey, setDataPathKey] = useState(dataSourceKey(['data', 'values']))
  const dragRef = useRef<null | { mode: 'move-shape' | 'resize-shape' | 'move-label'; index: number; start: Point; spec: Record<string, unknown> }>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!open) return
    const nextSpec = isSetDiagram ? normalizeSetDiagramSpecForEditing(initialSpec) : structuredClone(initialSpec)
    setSpec(nextSpec)
    setTitle(initialTitle ?? '')
    setAltText(initialAltText ?? '')
    setSelection(null)
    const dataSources = collectVegaDataSources(nextSpec)
    const firstDataSource = dataSources[0]
    setDataPathKey(firstDataSource ? dataSourceKey(firstDataSource.path) : dataSourceKey(['data', 'values']))
    setDataText(JSON.stringify(firstDataSource?.values ?? [], null, 2))
    setSpecText(JSON.stringify(nextSpec, null, 2))
  }, [initialAltText, initialSpec, initialTitle, isSetDiagram, open])

  useEffect(() => {
    if (!open || isSetDiagram) return
    setSpecText(JSON.stringify(spec, null, 2))
  }, [isSetDiagram, open, spec])

  const block = useMemo<VisualBlock>(() => ({
    type: 'visual',
    visualType,
    title: title.trim() || null,
    altText: altText.trim() || `${visualType.replaceAll('_', ' ')} visual`,
    spec,
  } as VisualBlock), [altText, spec, title, visualType])

  useEffect(() => {
    if (!open) return
    if (isSetDiagram) {
      try {
        setPreviewNode(generatedVisualBlockToImageNode(block))
        setRenderError(null)
      } catch (error) {
        setRenderError(error instanceof Error ? error.message : 'Visual rendering failed.')
      }
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/ucat/authoring-agent/visuals/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(block),
          signal: controller.signal,
        })
        const body = await response.json() as { imageNode?: Json; error?: string }
        if (!response.ok || !body.imageNode) throw new Error(body.error ?? 'Chart rendering failed.')
        setPreviewNode(body.imageNode)
        setRenderError(null)
      } catch (error) {
        if (controller.signal.aborted) return
        setRenderError(error instanceof Error ? error.message : 'Chart rendering failed.')
      }
    }, 300)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [block, isSetDiagram, open])

  function svgPoint(clientX: number, clientY: number): Point {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: ((clientX - rect.left) / rect.width) * 720, y: ((clientY - rect.top) / rect.height) * 430 }
  }

  useEffect(() => {
    function move(event: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const point = svgPoint(event.clientX, event.clientY)
      const dx = point.x - drag.start.x
      const dy = point.y - drag.start.y
      const next = structuredClone(drag.spec)
      if (drag.mode === 'move-label') {
        const labels = Array.isArray(next.regionLabels) ? [...next.regionLabels] : []
        const label = isRecord(labels[drag.index]) ? labels[drag.index] as Record<string, unknown> : {}
        labels[drag.index] = { ...label, x: numeric(label.x, 320) + dx, y: numeric(label.y, 220) + dy, manualPosition: true }
        next.regionLabels = labels
      } else {
        const shapes = Array.isArray(next.shapes) ? [...next.shapes] : []
        const shape = isRecord(shapes[drag.index]) ? shapes[drag.index] as Record<string, unknown> : {}
        shapes[drag.index] = drag.mode === 'resize-shape'
          ? resizeShape(shape, drag.index, dx, dy)
          : moveShape(shape, drag.index, dx, dy)
        next.shapes = shapes
      }
      setSpec(next)
    }
    function up() { dragRef.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  const shapes = Array.isArray(spec.shapes) ? spec.shapes.filter(isRecord) : []
  const labels = Array.isArray(spec.regionLabels) ? spec.regionLabels.filter(isRecord) : []
  const legendItems = isSetDiagram ? setLegendItems(shapes) : []
  const warnings = isSetDiagram ? getSetDiagramManualPlacementWarnings(spec) : []
  const selectedShape = selection?.kind === 'shape' ? shapes[selection.index] : null
  const selectedLabel = selection?.kind === 'label' ? labels[selection.index] : null
  const selectedBounds = selectedShape ? shapeBounds(selectedShape, selection?.index ?? 0) : null
  const previewSrc = isRecord(previewNode) && isRecord(previewNode.attrs) && typeof previewNode.attrs.src === 'string'
    ? previewNode.attrs.src
    : null
  const axisControls = isSetDiagram ? [] : collectAxisControls(spec)
  const dataSources = isSetDiagram ? [] : collectVegaDataSources(spec)
  const selectedDataSource = dataSources.find((source) => dataSourceKey(source.path) === dataPathKey) ?? dataSources[0]

  function updateShape(index: number, patch: Record<string, unknown>) {
    setSpec((current) => {
      const shapes = Array.isArray(current.shapes) ? [...current.shapes] : []
      shapes[index] = { ...(isRecord(shapes[index]) ? shapes[index] as Record<string, unknown> : {}), ...patch }
      return { ...current, shapes }
    })
  }

  function updateLabel(index: number, patch: Record<string, unknown>) {
    setSpec((current) => {
      const labels = Array.isArray(current.regionLabels) ? [...current.regionLabels] : []
      labels[index] = { ...(isRecord(labels[index]) ? labels[index] as Record<string, unknown> : {}), ...patch }
      return { ...current, regionLabels: labels }
    })
  }

  function applyDataText() {
    try {
      const values = JSON.parse(dataText) as unknown
      if (!Array.isArray(values) || !values.every(isRecord)) throw new Error('Data must be a JSON array of objects.')
      const path = selectedDataSource?.path ?? ['data', 'values']
      setSpec((current) => setNested(current, path, values))
      setRenderError(null)
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'Invalid chart data.')
    }
  }

  function applySpecText() {
    try {
      const value = JSON.parse(specText) as unknown
      if (!isRecord(value)) throw new Error('The Vega-Lite specification must be a JSON object.')
      setSpec(value)
      setSpecText(JSON.stringify(value, null, 2))
      const sources = collectVegaDataSources(value)
      const nextSource = sources.find((source) => dataSourceKey(source.path) === dataPathKey) ?? sources[0]
      setDataPathKey(nextSource ? dataSourceKey(nextSource.path) : dataSourceKey(['data', 'values']))
      setDataText(JSON.stringify(nextSource?.values ?? [], null, 2))
      setRenderError(null)
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'Invalid Vega-Lite specification.')
    }
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={() => onOpenChange(false)}
      title={isSetDiagram ? 'Edit Venn / set diagram' : 'Edit Vega chart'}
      subtitle={isSetDiagram
        ? 'Drag shapes and labels directly. Resize the selected shape using its blue handle.'
        : 'Edit source data and semantic chart settings; marks remain derived from the data.'}
      onSave={() => previewNode && onApply(previewNode)}
      saveLabel="Apply visual"
      saveDisabled={!previewNode || Boolean(renderError)}
      defaultExpanded
      mobileFullscreen
    >
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className={tutorCardCn('flex min-h-0 flex-col gap-3 overflow-auto bg-white p-4 text-black')}>
            {isSetDiagram ? (
              <svg ref={svgRef} viewBox="0 0 720 430" className="min-h-[360px] w-full touch-none select-none" aria-label="Editable set diagram">
                <rect width="720" height="430" fill="white" />
                {title ? <text x="40" y="34" fontSize="20" fontWeight="600">{title}</text> : null}
                <g transform={`translate(0 ${title ? 34 : 0})`}>
                  {shapes.map((shape, index) => (
                    <SetShape
                      key={`shape-${index}`}
                      shape={shape}
                      index={index}
                      selected={selection?.kind === 'shape' && selection.index === index}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        setSelection({ kind: 'shape', index })
                        dragRef.current = { mode: 'move-shape', index, start: svgPoint(event.clientX, event.clientY), spec: structuredClone(spec) }
                      }}
                    />
                  ))}
                  {labels.map((label, index) => (
                    <text
                      key={`label-${index}`}
                      x={numeric(label.x, 320)}
                      y={numeric(label.y, 220)}
                      fontSize={numeric(label.fontSize, 18)}
                      fontWeight={label.bold ? 700 : 500}
                      textAnchor="middle"
                      paintOrder="stroke"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      className="cursor-move"
                      fill={selection?.kind === 'label' && selection.index === index ? '#2563eb' : '#111111'}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        setSelection({ kind: 'label', index })
                        dragRef.current = { mode: 'move-label', index, start: svgPoint(event.clientX, event.clientY), spec: structuredClone(spec) }
                      }}
                    >
                      {String(label.text ?? label.value ?? '')}
                    </text>
                  ))}
                  {selectedBounds ? (
                    <>
                      <rect {...selectedBounds} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none" />
                      <rect
                        x={selectedBounds.x + selectedBounds.width - 7}
                        y={selectedBounds.y + selectedBounds.height - 7}
                        width="14"
                        height="14"
                        rx="2"
                        fill="#2563eb"
                        className="cursor-nwse-resize"
                        onPointerDown={(event) => {
                          if (!selection || selection.kind !== 'shape') return
                          event.preventDefault()
                          event.stopPropagation()
                          dragRef.current = { mode: 'resize-shape', index: selection.index, start: svgPoint(event.clientX, event.clientY), spec: structuredClone(spec) }
                        }}
                      />
                    </>
                  ) : null}
                </g>
                {legendItems.map((item) => {
                  const selected = selection?.kind === 'shape' && selection.index === item.index
                  const firstLineY = item.y - ((item.lines.length - 1) * 9)
                  return (
                    <g
                      key={`legend-${item.index}`}
                      className="cursor-pointer"
                      onPointerDown={(event) => {
                        event.preventDefault()
                        setSelection({ kind: 'shape', index: item.index })
                      }}
                    >
                      <SetLegendSwatch shape={item.shape} x={560} y={item.y} selected={selected} />
                      <text fontSize="15" fontWeight={selected ? 700 : 500} fill={selected ? '#2563eb' : '#111111'}>
                        {item.lines.map((line, lineIndex) => (
                          <tspan key={`${line}-${lineIndex}`} x="610" y={firstLineY + lineIndex * 18}>{line}</tspan>
                        ))}
                      </text>
                    </g>
                  )
                })}
              </svg>
            ) : previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt={altText || 'Vega chart preview'} className="max-h-[650px] w-full object-contain" />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">Rendering chart…</div>
            )}
          </div>

          <ScrollArea className={tutorCardCn('min-h-0')}>
            <div className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="visual-title">Title</Label>
                <Input id="visual-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="visual-alt">Alternative text</Label>
                <Textarea id="visual-alt" value={altText} onChange={(event) => setAltText(event.target.value)} />
              </div>

              {isSetDiagram ? (
                <>
                  <div className="space-y-2">
                    <Label>Shapes</Label>
                    {shapes.map((shape, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="ghost"
                        aria-pressed={selection?.kind === 'shape' && selection.index === index}
                        className={cn(
                          'h-auto w-full justify-start rounded-xl border px-3 py-2.5 text-left shadow-none transition-colors',
                          selection?.kind === 'shape' && selection.index === index
                            ? 'border-primary/50 bg-primary/10 text-foreground ring-2 ring-primary/20 hover:bg-primary/10'
                            : 'border-black/[0.06] bg-muted/30 hover:bg-muted/50 dark:border-white/10',
                        )}
                        onClick={() => setSelection({ kind: 'shape', index })}
                      >
                        {String(shape.label ?? shape.id ?? `Set ${index + 1}`)} · {shapeType(shape)}
                      </Button>
                    ))}
                  </div>
                  {selectedShape && selection?.kind === 'shape' ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="space-y-1.5">
                        <Label>Set label</Label>
                        <Input value={String(selectedShape.label ?? '')} onChange={(event) => updateShape(selection.index, { label: event.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {shapeType(selectedShape) === 'circle' ? (
                          <label className="space-y-1 text-xs">Radius<Input type="number" value={numeric(selectedShape.r, 95)} onChange={(event) => updateShape(selection.index, { r: numeric(event.target.value, 95) })} /></label>
                        ) : shapeType(selectedShape) === 'ellipse' ? (
                          <>
                            <label className="space-y-1 text-xs">Radius X<Input type="number" value={numeric(selectedShape.rx, 120)} onChange={(event) => updateShape(selection.index, { rx: numeric(event.target.value, 120) })} /></label>
                            <label className="space-y-1 text-xs">Radius Y<Input type="number" value={numeric(selectedShape.ry, 82)} onChange={(event) => updateShape(selection.index, { ry: numeric(event.target.value, 82) })} /></label>
                          </>
                        ) : (
                          <>
                            <label className="space-y-1 text-xs">Width<Input type="number" value={numeric(selectedShape.width, selectedBounds?.width ?? 170)} onChange={(event) => updateShape(selection.index, { width: numeric(event.target.value, 170) })} /></label>
                            <label className="space-y-1 text-xs">Height<Input type="number" value={numeric(selectedShape.height, selectedBounds?.height ?? 160)} onChange={(event) => updateShape(selection.index, { height: numeric(event.target.value, 160) })} /></label>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Region labels</Label>
                    {labels.map((label, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="ghost"
                        aria-pressed={selection?.kind === 'label' && selection.index === index}
                        className={cn(
                          'h-auto w-full justify-start rounded-xl border px-3 py-2.5 text-left shadow-none transition-colors',
                          selection?.kind === 'label' && selection.index === index
                            ? 'border-primary/50 bg-primary/10 text-foreground ring-2 ring-primary/20 hover:bg-primary/10'
                            : 'border-black/[0.06] bg-muted/30 hover:bg-muted/50 dark:border-white/10',
                        )}
                        onClick={() => setSelection({ kind: 'label', index })}
                      >
                        {String(label.text ?? label.value ?? `Label ${index + 1}`)}
                      </Button>
                    ))}
                  </div>
                  {selectedLabel && selection?.kind === 'label' ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="space-y-1.5"><Label>Text</Label><Input value={String(selectedLabel.text ?? selectedLabel.value ?? '')} onChange={(event) => updateLabel(selection.index, { text: event.target.value, value: undefined })} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1 text-xs">X<Input type="number" value={numeric(selectedLabel.x, 320)} onChange={(event) => updateLabel(selection.index, { x: numeric(event.target.value, 320), manualPosition: true })} /></label>
                        <label className="space-y-1 text-xs">Y<Input type="number" value={numeric(selectedLabel.y, 220)} onChange={(event) => updateLabel(selection.index, { y: numeric(event.target.value, 220), manualPosition: true })} /></label>
                      </div>
                      <label className="space-y-1 text-xs">Font size<Input type="number" min="8" max="48" value={numeric(selectedLabel.fontSize, 18)} onChange={(event) => updateLabel(selection.index, { fontSize: numeric(event.target.value, 18) })} /></label>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs">Chart width<Input type="number" min="520" max="780" value={numeric(spec.width, 640)} onChange={(event) => setSpec((current) => ({ ...current, width: numeric(event.target.value, 640) }))} /></label>
                    <label className="space-y-1 text-xs">Chart height<Input type="number" min="180" max="620" value={numeric(spec.height, 340)} onChange={(event) => setSpec((current) => ({ ...current, height: numeric(event.target.value, 340) }))} /></label>
                  </div>
                  <UcatVegaStyleControls spec={spec} onChange={setSpec} />
                  {axisControls.map((control, index) => (
                    <div key={`${control.label}-${index}`} className="space-y-1.5">
                      <Label>{control.label} title</Label>
                      <Input value={control.title} onChange={(event) => setSpec((current) => setNested(current, control.path, event.target.value))} />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label htmlFor="vega-data">Source data (JSON rows)</Label>
                    {dataSources.length > 1 ? (
                      <select
                        aria-label="Chart data source"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={selectedDataSource ? dataSourceKey(selectedDataSource.path) : dataPathKey}
                        onChange={(event) => {
                          const source = dataSources.find((candidate) => dataSourceKey(candidate.path) === event.target.value)
                          if (!source) return
                          setDataPathKey(dataSourceKey(source.path))
                          setDataText(JSON.stringify(source.values, null, 2))
                        }}
                      >
                        {dataSources.map((source) => (
                          <option key={dataSourceKey(source.path)} value={dataSourceKey(source.path)}>{source.label}</option>
                        ))}
                      </select>
                    ) : null}
                    <Textarea id="vega-data" className="min-h-56 font-mono text-xs" value={dataText} onChange={(event) => setDataText(event.target.value)} onBlur={applyDataText} />
                    <Button type="button" variant="outline" size="sm" onClick={applyDataText}>Apply data</Button>
                  </div>
                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Advanced Vega-Lite specification</summary>
                    <Textarea
                      className="mt-3 min-h-72 font-mono text-xs"
                      value={specText}
                      onChange={(event) => setSpecText(event.target.value)}
                      onBlur={applySpecText}
                    />
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={applySpecText}>Apply specification</Button>
                  </details>
                </>
              )}

              {warnings.map((warning) => (
                <Alert key={warning} className="border-amber-300 bg-amber-50 text-amber-950">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{warning} You can still apply this manual edit.</AlertDescription>
                </Alert>
              ))}
              {renderError ? (
                <Alert variant="destructive"><AlertDescription>{renderError}</AlertDescription></Alert>
              ) : null}
            </div>
          </ScrollArea>
        </div>
    </UcatDialogShell>
  )
}
