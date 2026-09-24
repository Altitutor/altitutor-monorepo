'use client'

import { useCallback, useRef, useState } from 'react'
import { useToast } from '@altitutor/ui'
import {
  createInFlightIdStore,
  hasInFlightOverlap,
  startBackgroundBulkAction,
  type BackgroundBulkAction,
  type InFlightIdStore,
} from '../lib/background-bulk-action'

export function useBackgroundBulkAction() {
  const { toast, dismiss } = useToast()
  const storeRef = useRef<InFlightIdStore>(createInFlightIdStore())
  const [, setGeneration] = useState(0)

  const notify = useCallback(() => {
    setGeneration((generation) => generation + 1)
  }, [])

  function start<T>(action: BackgroundBulkAction<T>) {
    return startBackgroundBulkAction({
      store: storeRef.current,
      toast,
      dismiss,
      onInFlightChange: notify,
      action,
    })
  }

  function selectionIsBusy(ids: Iterable<string>) {
    return hasInFlightOverlap(storeRef.current, Array.from(ids))
  }

  return { start, selectionIsBusy }
}
