import type { MocksFilters } from '../api/mocks-api'

/** Convert ListToolbar filters format to MocksFilters for filterMocks */
export function recordToMocksFilters(record: Record<string, unknown[]>): MocksFilters {
  const f: MocksFilters = {}
  const timed = record.timed?.[0]
  if (timed === 'timed' || timed === 'untimed') f.timed = timed
  const source = record.source?.[0]
  if (source === 'my' || source === 'public') f.source = source
  return f
}

/** Convert MocksFilters to ListToolbar filters format */
export function mocksFiltersToRecord(f: MocksFilters): Record<string, unknown[]> {
  const record: Record<string, unknown[]> = {}
  if (f.timed === 'timed' || f.timed === 'untimed') record.timed = [f.timed]
  if (f.source === 'my' || f.source === 'public') record.source = [f.source]
  return record
}
