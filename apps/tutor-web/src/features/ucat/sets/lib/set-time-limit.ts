import { minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'

export type SetTimeLimitSource = 'untimed' | 'paced' | 'custom'

export const PACED_SPEED_MIN = 0.5
export const PACED_SPEED_MAX = 2
export const PACED_SPEED_STEP = 0.1
export const PACED_SPEED_DEFAULT = 1

export function clampPacedSpeed(speed: number): number {
  return Math.max(PACED_SPEED_MIN, Math.min(PACED_SPEED_MAX, speed))
}

export function pacedTimeLimitSeconds(
  timePerQuestion: number | null | undefined,
  questionCount: number,
  speed: number,
): number | null {
  if (timePerQuestion == null || timePerQuestion <= 0 || questionCount <= 0) return null
  return Math.round((questionCount * timePerQuestion) / clampPacedSpeed(speed))
}

export function resolveSetTimeLimitSeconds({
  source,
  timePerQuestion,
  questionCount,
  speed,
  customMinutes,
  customSeconds,
}: {
  source: SetTimeLimitSource
  timePerQuestion: number | null | undefined
  questionCount: number
  speed: number
  customMinutes: string
  customSeconds: string
}): number | null {
  if (source === 'untimed') return null
  if (source === 'paced') return pacedTimeLimitSeconds(timePerQuestion, questionCount, speed)
  return minutesSecondsToTotal(customMinutes, customSeconds)
}
