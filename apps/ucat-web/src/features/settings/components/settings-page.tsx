'use client'

import { useState, useEffect } from 'react'
import { Button, Label } from '@altitutor/ui'
import { UcatPageHeader } from '@/features/layout'

export function SettingsPage() {
  const [timezone, setTimezone] = useState<string>('Australia/Adelaide')
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/ucat/profile')
        if (!res.ok) throw new Error('Failed to load profile')
        const data = (await res.json()) as { timezone?: string; timezoneOptions?: string[] }
        setTimezone(data.timezone ?? 'Australia/Adelaide')
        setOptions(data.timezoneOptions ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ucat/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Settings" description="Manage your account settings" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader title="Settings" description="Manage your account settings" />

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold">Timezone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Used for practice day discounts (e.g. 20 questions per day).
        </p>
        <div className="mt-4">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-2 block w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {options.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
