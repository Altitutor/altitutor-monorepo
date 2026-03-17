'use client'

import { Alert, AlertDescription, AlertTitle } from '@altitutor/ui'
import { AlertTriangle } from 'lucide-react'

type UcatVisibilityCascadeWarningProps =
  | {
      type: 'set'
      count: number
    }
  | {
      type: 'mock'
      count: number
    }

export function UcatVisibilityCascadeWarning(props: UcatVisibilityCascadeWarningProps) {
  const message =
    props.type === 'set'
      ? props.count === 1
        ? '1 question stem will be made public when you save.'
        : `${props.count} question stems will be made public when you save.`
      : props.count === 1
        ? '1 set (and its question stems) will be made public when you save.'
        : `${props.count} sets (and their question stems) will be made public when you save.`

  return (
    <Alert
      variant="default"
      className="shrink-0 border-amber-500/50 bg-amber-50/50 px-6 py-4 mt-4 dark:border-amber-500/30 dark:bg-amber-950/20"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">Visibility will cascade</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
