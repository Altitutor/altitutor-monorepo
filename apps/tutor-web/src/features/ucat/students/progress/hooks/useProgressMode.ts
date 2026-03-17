'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type {
  ProgressMode,
  TimeFrameDays,
  AttemptFilter,
} from '../lib/progress-mode'
import {
  TIME_FRAME_OPTIONS,
  ATTEMPT_FILTER_OPTIONS,
} from '../lib/progress-mode'

const VALID_MODES: ProgressMode[] = ['all_time', 'weighted', 'time_frame']
const VALID_DAYS: readonly TimeFrameDays[] = TIME_FRAME_OPTIONS.map(
  (o) => o.value
)
const VALID_FILTERS: readonly AttemptFilter[] = ATTEMPT_FILTER_OPTIONS.map(
  (o) => o.value
)

function parseMode(v: string | null): ProgressMode {
  if (v && VALID_MODES.includes(v as ProgressMode)) return v as ProgressMode
  return 'weighted'
}

function parseDays(v: string | null): TimeFrameDays {
  if (v && VALID_DAYS.includes(v as TimeFrameDays)) return v as TimeFrameDays
  return '30'
}

function parseFilter(v: string | null): AttemptFilter {
  if (v && VALID_FILTERS.includes(v as AttemptFilter)) return v as AttemptFilter
  return 'all'
}

export function useProgressMode() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const mode = parseMode(searchParams.get('mode'))
  const timeFrameDays = parseDays(searchParams.get('days'))
  const attemptFilter = parseFilter(searchParams.get('filter'))

  const updateUrl = useCallback(
    (updates: { mode?: ProgressMode; days?: TimeFrameDays; filter?: AttemptFilter }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (updates.mode !== undefined) params.set('mode', updates.mode)
      if (updates.days !== undefined) params.set('days', updates.days)
      if (updates.filter !== undefined) params.set('filter', updates.filter)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const handleModeChange = useCallback(
    (m: ProgressMode) => {
      updateUrl({ mode: m })
    },
    [updateUrl]
  )

  const handleTimeFrameDaysChange = useCallback(
    (d: TimeFrameDays) => {
      updateUrl({ days: d })
    },
    [updateUrl]
  )

  const handleAttemptFilterChange = useCallback(
    (f: AttemptFilter) => {
      updateUrl({ filter: f })
    },
    [updateUrl]
  )

  return useMemo(
    () => ({
      mode,
      timeFrameDays,
      attemptFilter,
      onModeChange: handleModeChange,
      onTimeFrameDaysChange: handleTimeFrameDaysChange,
      onAttemptFilterChange: handleAttemptFilterChange,
    }),
    [
      mode,
      timeFrameDays,
      attemptFilter,
      handleModeChange,
      handleTimeFrameDaysChange,
      handleAttemptFilterChange,
    ]
  )
}
