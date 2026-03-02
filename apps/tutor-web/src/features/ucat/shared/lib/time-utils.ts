/**
 * Parse a time string (mm:ss or seconds only) into total seconds.
 * Examples: "1:30" -> 90, "90" -> 90, "3:400" -> 580 (3*60 + 400).
 */
export function parseTimeToSeconds(input: string): number | null {
  const s = input.trim()
  if (s === '') return null
  const colon = s.indexOf(':')
  if (colon >= 0) {
    const minutes = parseInt(s.slice(0, colon).trim(), 10)
    const seconds = parseInt(s.slice(colon + 1).trim(), 10)
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null
    return minutes * 60 + seconds
  }
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Convert separate minutes and seconds (string inputs) to total seconds.
 * Empty strings are treated as 0. Returns null only when both are empty.
 */
export function minutesSecondsToTotal(minutes: string, seconds: string): number | null {
  const m = minutes.trim()
  const s = seconds.trim()
  if (m === '' && s === '') return null
  return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0)
}

/**
 * Format seconds as mm:ss for display in time inputs.
 */
export function secondsToTimeString(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Format seconds as a short duration for table display, e.g. "1m 43s", "0m 30s", "2m 0s".
 */
export function formatSecondsToDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const parts: string[] = []
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}
