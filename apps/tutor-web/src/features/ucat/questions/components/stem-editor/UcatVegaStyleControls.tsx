'use client'

import { Button, Input, Label, Switch } from '@altitutor/ui'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'

const DEFAULT_PALETTE = ['#111111', '#4b4b4b', '#737373', '#9b9b9b', '#c4c4c4', '#e0e0e0']
const NEW_COLOR = '#2563eb'

type Path = Array<string | number>

type PaletteControl = {
  path: Path
  label: string
  values: string[]
  categories: string[]
}

type MarkControl = {
  path: Path
  label: string
  type: string
  mark: Record<string, unknown>
  colorEncoded: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readablePath(path: Path): string {
  const layers = path.filter((part) => typeof part === 'number').map((part) => Number(part) + 1)
  return layers.length ? `Layer ${layers.join('.')}` : 'Chart'
}

function setNested(record: Record<string, unknown>, path: Path, value: unknown): Record<string, unknown> {
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

function allRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(allRows)
  if (!isRecord(value)) return []
  const ownRows = isRecord(value.data) && Array.isArray(value.data.values)
    ? value.data.values.filter(isRecord)
    : []
  const datasetRows = isRecord(value.datasets)
    ? Object.values(value.datasets).flatMap((dataset) => Array.isArray(dataset) ? dataset.filter(isRecord) : [])
    : []
  return [...ownRows, ...datasetRows, ...Object.values(value).flatMap(allRows)]
}

function collectPaletteControls(spec: Record<string, unknown>, root: Record<string, unknown>, path: Path = []): PaletteControl[] {
  const controls: PaletteControl[] = []
  if (isRecord(spec.encoding)) {
    for (const channel of ['color', 'fill', 'stroke']) {
      const definition = spec.encoding[channel]
      if (!isRecord(definition) || definition.scale === null || (!definition.field && definition.datum === undefined)) continue
      const scale = isRecord(definition.scale) ? definition.scale : {}
      const range = Array.isArray(scale.range) ? scale.range.filter((value): value is string => typeof value === 'string') : []
      const field = typeof definition.field === 'string' ? definition.field : null
      const categories = field
        ? Array.from(new Set(allRows(root).map((row) => row[field]).filter((value) => value !== undefined).map(String)))
        : [String(definition.datum)]
      const count = Math.max(1, range.length, Math.min(categories.length, 12))
      controls.push({
        path: [...path, 'encoding', channel, 'scale', 'range'],
        label: `${readablePath(path)} · ${channel}${field ? ` (${field})` : ''}`,
        values: range.length ? range : DEFAULT_PALETTE.slice(0, count),
        categories,
      })
    }
  }
  for (const key of ['layer', 'concat', 'hconcat', 'vconcat'] as const) {
    const children = spec[key]
    if (!Array.isArray(children)) continue
    children.forEach((child, index) => {
      if (isRecord(child)) controls.push(...collectPaletteControls(child, root, [...path, key, index]))
    })
  }
  if (isRecord(spec.spec)) controls.push(...collectPaletteControls(spec.spec, root, [...path, 'spec']))
  return controls
}

function markType(mark: unknown): string {
  if (typeof mark === 'string') return mark
  return isRecord(mark) && typeof mark.type === 'string' ? mark.type : 'mark'
}

function collectMarkControls(spec: Record<string, unknown>, path: Path = []): MarkControl[] {
  const controls: MarkControl[] = []
  if (typeof spec.mark === 'string' || isRecord(spec.mark)) {
    const mark = isRecord(spec.mark) ? spec.mark : { type: spec.mark }
    const encoding = isRecord(spec.encoding) ? spec.encoding : {}
    controls.push({
      path: [...path, 'mark'],
      label: `${readablePath(path)} · ${markType(mark)}`,
      type: markType(mark),
      mark,
      colorEncoded: ['color', 'fill', 'stroke'].some((channel) => isRecord(encoding[channel]) && encoding[channel] !== null),
    })
  }
  for (const key of ['layer', 'concat', 'hconcat', 'vconcat'] as const) {
    const children = spec[key]
    if (!Array.isArray(children)) continue
    children.forEach((child, index) => {
      if (isRecord(child)) controls.push(...collectMarkControls(child, [...path, key, index]))
    })
  }
  if (isRecord(spec.spec)) controls.push(...collectMarkControls(spec.spec, [...path, 'spec']))
  return controls
}

function pickerColor(value: unknown): string {
  const text = String(value ?? '')
  if (/^#[0-9a-f]{6}$/iu.test(text)) return text
  if (/^#[0-9a-f]{3}$/iu.test(text)) return `#${text.slice(1).split('').map((part) => `${part}${part}`).join('')}`
  return '#111111'
}

function ColorField({ id, label, value, onChange }: {
  id: string
  label: string
  value: unknown
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          id={id}
          type="color"
          className="h-9 w-11 cursor-pointer rounded-md border border-input bg-background p-1"
          value={pickerColor(value)}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input aria-label={`${label} value`} value={String(value ?? '')} placeholder="#111111" onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  )
}

export function UcatVegaStyleControls({
  spec,
  onChange,
}: {
  spec: Record<string, unknown>
  onChange: (spec: Record<string, unknown>) => void
}) {
  const config = isRecord(spec.config) ? spec.config : {}
  const titleConfig = isRecord(config.title) ? config.title : {}
  const axisConfig = isRecord(config.axis) ? config.axis : {}
  const legendConfig = isRecord(config.legend) ? config.legend : {}
  const palettes = collectPaletteControls(spec, spec)
  const marks = collectMarkControls(spec)
  const setValue = (path: Path, value: unknown) => onChange(setNested(spec, path, value))

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Chart appearance</h3>
        <ColorField id="vega-background" label="Background" value={spec.background ?? '#ffffff'} onChange={(value) => setValue(['background'], value)} />
        <div className="grid grid-cols-2 gap-2">
          <ColorField id="vega-title-color" label="Title color" value={titleConfig.color ?? '#111111'} onChange={(value) => setValue(['config', 'title', 'color'], value)} />
          <label className="space-y-1.5 text-xs">Title size<Input type="number" min="8" max="48" value={numeric(titleConfig.fontSize, 20)} onChange={(event) => setValue(['config', 'title', 'fontSize'], numeric(event.target.value, 20))} /></label>
        </div>
      </div>

      {palettes.length ? (
        <div className="space-y-3 rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
          <div>
            <h3 className="text-sm font-semibold">Series palettes</h3>
            <p className="mt-1 text-xs text-muted-foreground">Colors follow the data values shown beside each swatch.</p>
          </div>
          {palettes.map((palette) => (
            <div key={JSON.stringify(palette.path)} className="space-y-2 rounded-lg border bg-background/60 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{palette.label}</span>
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Reset ${palette.label} palette`} onClick={() => setValue(palette.path, DEFAULT_PALETTE)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
              {palette.values.map((color, index) => (
                <div key={`${JSON.stringify(palette.path)}-${index}`} className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${palette.categories[index] ?? `Series ${index + 1}`} color`}
                    className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-1"
                    value={pickerColor(color)}
                    onChange={(event) => setValue(palette.path, palette.values.map((value, colorIndex) => colorIndex === index ? event.target.value : value))}
                  />
                  <Input
                    className="h-8 min-w-0 flex-1 text-xs"
                    aria-label={`${palette.categories[index] ?? `Series ${index + 1}`} color value`}
                    value={color}
                    onChange={(event) => setValue(palette.path, palette.values.map((value, colorIndex) => colorIndex === index ? event.target.value : value))}
                  />
                  <span className="max-w-24 truncate text-xs text-muted-foreground" title={palette.categories[index]}>{palette.categories[index] ?? `Series ${index + 1}`}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled={palette.values.length <= 1} aria-label={`Remove ${palette.categories[index] ?? `series ${index + 1}`} color`} onClick={() => setValue(palette.path, palette.values.filter((_, colorIndex) => colorIndex !== index))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setValue(palette.path, [...palette.values, NEW_COLOR])}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add color
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {marks.length ? (
        <div className="space-y-3 rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
          <div>
            <h3 className="text-sm font-semibold">Marks</h3>
            <p className="mt-1 text-xs text-muted-foreground">Series palettes take precedence when a mark color is data-encoded.</p>
          </div>
          {marks.map((control, index) => {
            const mark = control.mark
            const updateMark = (patch: Record<string, unknown>) => setValue(control.path, { ...mark, ...patch })
            return (
              <div key={JSON.stringify(control.path)} className="space-y-2 rounded-lg border bg-background/60 p-2.5">
                <span className="text-xs font-medium">{control.label}</span>
                {!control.colorEncoded ? (
                  <div className="grid grid-cols-2 gap-2">
                    <ColorField id={`vega-mark-fill-${index}`} label="Fill" value={mark.fill ?? mark.color ?? '#737373'} onChange={(value) => updateMark({ fill: value, color: undefined })} />
                    <ColorField id={`vega-mark-stroke-${index}`} label="Stroke" value={mark.stroke ?? '#111111'} onChange={(value) => updateMark({ stroke: value })} />
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5 text-xs">Opacity<Input type="number" min="0" max="1" step="0.05" value={numeric(mark.opacity, 0.9)} onChange={(event) => updateMark({ opacity: numeric(event.target.value, 0.9) })} /></label>
                  <label className="space-y-1.5 text-xs">Stroke width<Input type="number" min="0" max="20" step="0.25" value={numeric(mark.strokeWidth, control.type === 'line' ? 3 : 1)} onChange={(event) => updateMark({ strokeWidth: numeric(event.target.value, 1) })} /></label>
                  {['point', 'circle', 'square'].includes(control.type) ? (
                    <label className="space-y-1.5 text-xs">Point size<Input type="number" min="1" max="1000" value={numeric(mark.size, 70)} onChange={(event) => updateMark({ size: numeric(event.target.value, 70) })} /></label>
                  ) : null}
                  {control.type === 'text' ? (
                    <label className="space-y-1.5 text-xs">Text size<Input type="number" min="8" max="48" value={numeric(mark.fontSize, 14)} onChange={(event) => updateMark({ fontSize: numeric(event.target.value, 14) })} /></label>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Axes and grid</h3>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="vega-grid">Show grid lines</Label>
          <Switch id="vega-grid" checked={axisConfig.grid !== false} onCheckedChange={(checked) => setValue(['config', 'axis', 'grid'], checked)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ColorField id="vega-axis-label-color" label="Label color" value={axisConfig.labelColor ?? '#111111'} onChange={(value) => setValue(['config', 'axis', 'labelColor'], value)} />
          <ColorField id="vega-axis-title-color" label="Title color" value={axisConfig.titleColor ?? '#111111'} onChange={(value) => setValue(['config', 'axis', 'titleColor'], value)} />
          <ColorField id="vega-grid-color" label="Grid color" value={axisConfig.gridColor ?? '#d6d6d6'} onChange={(value) => setValue(['config', 'axis', 'gridColor'], value)} />
          <ColorField id="vega-domain-color" label="Axis line color" value={axisConfig.domainColor ?? '#111111'} onChange={(value) => setValue(['config', 'axis', 'domainColor'], value)} />
          <label className="space-y-1.5 text-xs">Label size<Input type="number" min="8" max="32" value={numeric(axisConfig.labelFontSize, 13)} onChange={(event) => setValue(['config', 'axis', 'labelFontSize'], numeric(event.target.value, 13))} /></label>
          <label className="space-y-1.5 text-xs">Title size<Input type="number" min="8" max="36" value={numeric(axisConfig.titleFontSize, 15)} onChange={(event) => setValue(['config', 'axis', 'titleFontSize'], numeric(event.target.value, 15))} /></label>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
        <h3 className="text-sm font-semibold">Legend</h3>
        <label className="space-y-1.5 text-xs">Position
          <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={String(legendConfig.orient ?? 'bottom')} onChange={(event) => setValue(['config', 'legend', 'orient'], event.target.value)}>
            {['bottom', 'top', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'none'].map((position) => <option key={position} value={position}>{position}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ColorField id="vega-legend-label-color" label="Label color" value={legendConfig.labelColor ?? '#111111'} onChange={(value) => setValue(['config', 'legend', 'labelColor'], value)} />
          <ColorField id="vega-legend-title-color" label="Title color" value={legendConfig.titleColor ?? '#111111'} onChange={(value) => setValue(['config', 'legend', 'titleColor'], value)} />
          <label className="space-y-1.5 text-xs">Label size<Input type="number" min="8" max="32" value={numeric(legendConfig.labelFontSize, 13)} onChange={(event) => setValue(['config', 'legend', 'labelFontSize'], numeric(event.target.value, 13))} /></label>
          <label className="space-y-1.5 text-xs">Title size<Input type="number" min="8" max="36" value={numeric(legendConfig.titleFontSize, 14)} onChange={(event) => setValue(['config', 'legend', 'titleFontSize'], numeric(event.target.value, 14))} /></label>
        </div>
      </div>
    </div>
  )
}
