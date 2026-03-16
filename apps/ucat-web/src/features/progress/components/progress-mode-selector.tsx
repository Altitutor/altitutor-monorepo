'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui'
import { SegmentedControl } from './segmented-control'
import {
  type ProgressMode,
  type TimeFrameDays,
  TIME_FRAME_OPTIONS,
} from '../lib/progress-mode'

type ProgressModeSelectorProps = {
  mode: ProgressMode
  onModeChange: (mode: ProgressMode) => void
  timeFrameDays: TimeFrameDays
  onTimeFrameDaysChange: (days: TimeFrameDays) => void
  className?: string
}

export function ProgressModeSelector({
  mode,
  onModeChange,
  timeFrameDays,
  onTimeFrameDaysChange,
  className,
}: ProgressModeSelectorProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={mode}
          onValueChange={(v) => onModeChange(v as ProgressMode)}
          options={[
            { value: 'all_time', label: 'All time' },
            {
              value: 'weighted',
              label: 'Weighted average',
              infoTooltip:
                'Recent attempts are weighted more heavily than older ones. Percentages and scaled scores use EMA; counts show all time.',
            },
            { value: 'time_frame', label: 'Time frame' },
          ]}
        />
        {mode === 'time_frame' && (
          <Select
            value={timeFrameDays}
            onValueChange={(v) => onTimeFrameDaysChange(v as TimeFrameDays)}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Days" />
            </SelectTrigger>
            <SelectContent>
              {TIME_FRAME_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
