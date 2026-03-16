/** Progress view mode: all time (simple avg), weighted (EMA), or time frame (filtered) */
export type ProgressMode = 'all_time' | 'weighted' | 'time_frame'

export const TIME_FRAME_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const

export type TimeFrameDays = (typeof TIME_FRAME_OPTIONS)[number]['value']

/** Bucket size for graph aggregation: daily for ≤30 days, weekly for 90 days */
export function getGraphBucketDays(days: number): 'day' | 'week' {
  return days <= 30 ? 'day' : 'week'
}

/** Format date as local yyyy-MM-dd (avoids timezone mismatch with getBucketKeysBetween) */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Get bucket key for a date (yyyy-MM-dd for day, yyyy-MM-dd of Monday for week). Uses local time. */
export function getBucketKey(
  date: Date | string,
  bucket: 'day' | 'week'
): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  if (bucket === 'day') {
    return toLocalDateString(d)
  }
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return toLocalDateString(monday)
}

/** Get all bucket keys in range for graph x-axis */
export function getBucketKeysInRange(
  days: number,
  bucket: 'day' | 'week'
): string[] {
  const { start, end } = getTimeFrameRange(days)
  return getBucketKeysBetween(start, end, bucket)
}

/** Get bucket keys between two dates. Uses local time to match getBucketKey. */
export function getBucketKeysBetween(
  start: Date,
  end: Date,
  bucket: 'day' | 'week'
): string[] {
  const keys: string[] = []
  if (bucket === 'day') {
    const d = new Date(start)
    while (d <= end) {
      keys.push(toLocalDateString(d))
      d.setDate(d.getDate() + 1)
    }
  } else {
    const d = new Date(start)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    while (d <= end) {
      keys.push(toLocalDateString(d))
      d.setDate(d.getDate() + 7)
    }
  }
  return keys
}

/** Get date range for time frame filtering */
export function getTimeFrameRange(days: number): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

/** Check if a date falls within the time frame */
export function isInTimeFrame(
  date: Date | string,
  days: number
): boolean {
  const { start, end } = getTimeFrameRange(days)
  const d = typeof date === 'string' ? new Date(date) : date
  return d >= start && d <= end
}
