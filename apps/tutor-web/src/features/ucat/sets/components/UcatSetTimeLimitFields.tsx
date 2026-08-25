'use client'

import { Input, SearchableSelect, Slider } from '@altitutor/ui'
import { formatSecondsToDuration, secondsToMinutesAndSeconds } from '@/features/ucat/shared/lib/time-utils'
import {
  PACED_SPEED_DEFAULT,
  PACED_SPEED_MAX,
  PACED_SPEED_MIN,
  PACED_SPEED_STEP,
  clampPacedSpeed,
  pacedTimeLimitSeconds,
  resolveSetTimeLimitSeconds,
  type SetTimeLimitSource,
} from '@/features/ucat/sets/lib/set-time-limit'

const TIME_LIMIT_OPTIONS: Array<{ value: SetTimeLimitSource; label: string }> = [
  { value: 'untimed', label: 'Untimed' },
  { value: 'paced', label: 'Paced' },
  { value: 'custom', label: 'Custom' },
]

export function UcatSetTimeLimitFields({
  source,
  speed,
  minutes,
  seconds,
  questionCount,
  timePerQuestion,
  onChangeSource,
  onChangeSpeed,
  onChangeMinutes,
  onChangeSeconds,
}: {
  source: SetTimeLimitSource
  speed: number
  minutes: string
  seconds: string
  questionCount: number
  timePerQuestion: number | null | undefined
  onChangeSource: (value: SetTimeLimitSource) => void
  onChangeSpeed: (value: number) => void
  onChangeMinutes: (value: string) => void
  onChangeSeconds: (value: string) => void
}) {
  const clampedSpeed = clampPacedSpeed(speed)
  const pacedSeconds = pacedTimeLimitSeconds(timePerQuestion, questionCount, clampedSpeed)
  const effectiveSeconds = resolveSetTimeLimitSeconds({
    source,
    timePerQuestion,
    questionCount,
    speed: clampedSpeed,
    customMinutes: minutes,
    customSeconds: seconds,
  })

  function handleSourceChange(next: SetTimeLimitSource) {
    if (next === 'untimed') {
      onChangeMinutes('')
      onChangeSeconds('')
    } else if (next === 'custom' && minutes.trim() === '' && seconds.trim() === '' && pacedSeconds != null) {
      const parts = secondsToMinutesAndSeconds(pacedSeconds)
      onChangeMinutes(parts.minutes)
      onChangeSeconds(parts.seconds)
    }
    if (next === 'paced' && speed !== PACED_SPEED_DEFAULT && speed < PACED_SPEED_MIN) {
      onChangeSpeed(PACED_SPEED_DEFAULT)
    }
    onChangeSource(next)
  }

  return (
    <div className="space-y-3">
      <SearchableSelect<(typeof TIME_LIMIT_OPTIONS)[number]>
        items={TIME_LIMIT_OPTIONS}
        value={TIME_LIMIT_OPTIONS.find((item) => item.value === source) ?? null}
        onValueChange={(item) => {
          if (!item) return
          handleSourceChange(item.value)
        }}
        getItemLabel={(item) => item.label}
        getItemId={(item) => item.value}
        triggerClassName="w-full"
      />
      {source === 'paced' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Pace</span>
            <span className="text-muted-foreground">
              {clampedSpeed === PACED_SPEED_DEFAULT
                ? '1.0× exam pace'
                : `${clampedSpeed.toFixed(1)}×`}
            </span>
          </div>
          <Slider
            min={PACED_SPEED_MIN}
            max={PACED_SPEED_MAX}
            step={PACED_SPEED_STEP}
            value={[clampedSpeed]}
            onValueChange={([value]) => onChangeSpeed(clampPacedSpeed(value))}
          />
          {timePerQuestion == null || timePerQuestion <= 0 ? (
            <p className="text-xs text-muted-foreground">
              Select a section with exam timing to calculate paced time.
            </p>
          ) : questionCount <= 0 ? (
            <p className="text-xs text-muted-foreground">
              Time will be set from the number of questions in the set.
            </p>
          ) : null}
        </div>
      ) : null}
      {source === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="0"
            className="w-20"
            value={minutes}
            onChange={(event) => onChangeMinutes(event.target.value)}
          />
          <span className="font-medium text-muted-foreground">:</span>
          <Input
            type="number"
            min={0}
            max={59}
            placeholder="0"
            className="w-20"
            value={seconds}
            onChange={(event) => onChangeSeconds(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">min : sec</span>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Time limit:{' '}
        {effectiveSeconds != null && effectiveSeconds > 0
          ? formatSecondsToDuration(effectiveSeconds)
          : 'Untimed'}
      </p>
    </div>
  )
}
