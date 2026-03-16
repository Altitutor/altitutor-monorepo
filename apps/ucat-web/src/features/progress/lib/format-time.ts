/**
 * Format seconds as mm:ss. Rounds to nearest second.
 */
export function formatTimeSeconds(seconds: number): string {
  const rounded = Math.round(seconds)
  const m = Math.floor(rounded / 60)
  const s = rounded % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
