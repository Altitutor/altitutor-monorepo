import {
  SCALED_MAX,
  SCALED_MIN,
  SCALED_RANGE,
  SCALED_ROUND_TO,
} from './config'
import type { ScaledScoreOptions, ScaledScoreStrategy } from './types'

/**
 * Linear mapping: raw/max * 600 + 300, rounded to nearest 10.
 * For future: section-specific strategies can be passed via options.
 */
export const linearScaledScore: ScaledScoreStrategy = (
  rawScore: number,
  maxRawScore: number,
  _options?: ScaledScoreOptions
): number => {
  if (maxRawScore <= 0) return SCALED_MIN
  const ratio = Math.min(1, Math.max(0, rawScore / maxRawScore))
  const scaled = SCALED_MIN + ratio * SCALED_RANGE
  return Math.round(scaled / SCALED_ROUND_TO) * SCALED_ROUND_TO
}

/**
 * Convert raw score to scaled score (300-900).
 * Uses linear mapping by default; section-specific logic can be added later.
 */
export function scaleTo300_900(
  rawScore: number,
  maxRawScore: number,
  strategy: ScaledScoreStrategy = linearScaledScore,
  options?: ScaledScoreOptions
): number {
  return strategy(rawScore, maxRawScore, options)
}
