'use client'

import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import {
  SegmentedControl,
  type SegmentedControlOption,
} from './segmented-control'

export type SegmentedTabPanelProps<T extends string = string> = {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  className?: string
  selectorClassName?: string
  fullWidth?: boolean
  'aria-label'?: string
  children: ReactNode
}

/** Segmented control + switchable panel content (replaces Radix Tabs for simple tab UIs). */
export function SegmentedTabPanel<T extends string>({
  value,
  onValueChange,
  options,
  className,
  selectorClassName,
  fullWidth = true,
  'aria-label': ariaLabel,
  children,
}: SegmentedTabPanelProps<T>) {
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <SegmentedControl
        fullWidth={fullWidth}
        value={value}
        onValueChange={onValueChange}
        options={options}
        className={cn('shrink-0', selectorClassName)}
        aria-label={ariaLabel}
      />
      {children}
    </div>
  )
}

export type SegmentedTabPanelContentProps = {
  when: string
  activeTab: string
  className?: string
  children: ReactNode
}

export function SegmentedTabPanelContent({
  when,
  activeTab,
  className,
  children,
}: SegmentedTabPanelContentProps) {
  if (activeTab !== when) return null
  return <div className={className}>{children}</div>
}
