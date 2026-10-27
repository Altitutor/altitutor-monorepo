import type { UcatQuestionSetPayload } from '@/features/ucat/shared/types'

export class SetTimingValidationError extends Error {}

/** Keep only the selected timing intent; inactive editor values are not authored intent. */
export function normalizeSetTiming(input: {
  timingMode?: unknown
  paceMultiplier?: unknown
  fixedTimeLimitSeconds?: unknown
}): Required<Pick<UcatQuestionSetPayload, 'timingMode' | 'paceMultiplier' | 'fixedTimeLimitSeconds'>> {
  if (input.timingMode === 'untimed') {
    return { timingMode: 'untimed', paceMultiplier: null, fixedTimeLimitSeconds: null }
  }
  if (input.timingMode === 'pace') {
    if (typeof input.paceMultiplier !== 'number' ||
        !Number.isFinite(input.paceMultiplier) || input.paceMultiplier <= 0) {
      throw new SetTimingValidationError('Paced sets require a positive finite pace multiplier')
    }
    return { timingMode: 'pace', paceMultiplier: input.paceMultiplier, fixedTimeLimitSeconds: null }
  }
  if (input.timingMode === 'fixed') {
    if (typeof input.fixedTimeLimitSeconds !== 'number' ||
        !Number.isInteger(input.fixedTimeLimitSeconds) || input.fixedTimeLimitSeconds <= 0 ||
        input.fixedTimeLimitSeconds > 2147483647) {
      throw new SetTimingValidationError('Fixed timing requires a positive whole-second duration within the supported integer range')
    }
    return { timingMode: 'fixed', paceMultiplier: null, fixedTimeLimitSeconds: input.fixedTimeLimitSeconds }
  }
  throw new SetTimingValidationError('Timing mode must be pace, fixed, or untimed')
}
