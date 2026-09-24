'use client'

import { Button, Input, Label } from '@altitutor/ui'

type CreatedAtDateTimeRangeFilterProps = {
  fromValue: string
  toValue: string
  onChange: (from: string | null, to: string | null) => void
}

function isoToLocalInput(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return ''
  const localTimestamp = parsed.getTime() - parsed.getTimezoneOffset() * 60_000
  return new Date(localTimestamp).toISOString().slice(0, 16)
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

export function CreatedAtDateTimeRangeFilter({
  fromValue,
  toValue,
  onChange,
}: CreatedAtDateTimeRangeFilterProps) {
  const fromLocal = isoToLocalInput(fromValue)
  const toLocal = isoToLocalInput(toValue)

  function applyPreset(durationMs: number) {
    const to = new Date()
    const from = new Date(to.getTime() - durationMs)
    onChange(from.toISOString(), to.toISOString())
  }

  return (
    <div className="space-y-3 p-3">
      <div className="grid gap-2">
        <Label htmlFor="question-created-from" className="text-xs">
          From
        </Label>
        <Input
          id="question-created-from"
          type="datetime-local"
          value={fromLocal}
          max={toLocal || undefined}
          onChange={(event) => onChange(localInputToIso(event.target.value), toValue || null)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="question-created-to" className="text-xs">
          To
        </Label>
        <Input
          id="question-created-to"
          type="datetime-local"
          value={toLocal}
          min={fromLocal || undefined}
          onChange={(event) => onChange(fromValue || null, localInputToIso(event.target.value))}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset(60 * 60 * 1000)}>
          Last hour
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset(24 * 60 * 60 * 1000)}>
          Last 24 hours
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset(7 * 24 * 60 * 60 * 1000)}>
          Last 7 days
        </Button>
      </div>
    </div>
  )
}
