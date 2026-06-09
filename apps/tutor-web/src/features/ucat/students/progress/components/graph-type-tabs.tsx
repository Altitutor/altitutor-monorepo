'use client'

import { SegmentedControl } from '@/shared/components/segmented-control'

type GraphTypeTabsProps = {
  value: 'line' | 'bar'
  onValueChange: (value: 'line' | 'bar') => void
}

export function GraphTypeTabs({ value, onValueChange }: GraphTypeTabsProps) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={onValueChange}
      options={[
        { value: 'line', label: 'Line' },
        { value: 'bar', label: 'Bar' },
      ]}
    />
  )
}
