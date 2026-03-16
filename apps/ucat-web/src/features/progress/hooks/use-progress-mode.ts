'use client'

import { useState, useCallback, useMemo } from 'react'
import type { ProgressMode, TimeFrameDays } from '../lib/progress-mode'

export function useProgressMode() {
  const [mode, setMode] = useState<ProgressMode>('weighted')
  const [timeFrameDays, setTimeFrameDays] = useState<TimeFrameDays>('30')

  const handleModeChange = useCallback((m: ProgressMode) => {
    setMode(m)
  }, [])

  const handleTimeFrameDaysChange = useCallback((d: TimeFrameDays) => {
    setTimeFrameDays(d)
  }, [])

  return useMemo(
    () => ({
      mode,
      timeFrameDays,
      onModeChange: handleModeChange,
      onTimeFrameDaysChange: handleTimeFrameDaysChange,
    }),
    [mode, timeFrameDays, handleModeChange, handleTimeFrameDaysChange]
  )
}
