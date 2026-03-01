import { useCallback, useEffect, useRef, useState } from 'react'

import {
  UCAT_LAG_MODE_DEFAULT_ENABLED,
  UCAT_LAG_MODE_MIN_DELAY_MS,
  UCAT_LAG_MODE_MAX_DELAY_MS,
} from '@/features/question-engine/constants/lag-mode'

export function useLagMode() {
  const [enabled, setEnabled] = useState<boolean>(UCAT_LAG_MODE_DEFAULT_ENABLED)
  const [isLagging, setIsLagging] = useState<boolean>(false)
  const timeoutRef = useRef<number | null>(null)

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearPendingTimeout()
    }
  }, [clearPendingTimeout])

  const getDelay = useCallback(() => {
    if (!enabled) {
      return 0
    }

    const min = UCAT_LAG_MODE_MIN_DELAY_MS
    const max = UCAT_LAG_MODE_MAX_DELAY_MS

    if (max <= min) {
      return min
    }

    return min + Math.random() * (max - min)
  }, [enabled])

  const runWithLag = useCallback(
    <T,>(fn: () => T | Promise<T>): Promise<T> => {
      const delay = getDelay()

      if (delay <= 0) {
        return Promise.resolve(fn())
      }

      setIsLagging(true)

      return new Promise<T>((resolve, reject) => {
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null

          Promise.resolve()
            .then(fn)
            .then(resolve)
            .catch(reject)
            .finally(() => {
              setIsLagging(false)
            })
        }, delay)
      })
    },
    [getDelay]
  )

  return {
    enabled,
    setEnabled,
    isLagging,
    runWithLag,
  }
}

