import type { SetsFilters } from '../api/sets-api'

/** Convert ListToolbar filters format to SetsFilters for filterSets */
export function recordToSetsFilters(record: Record<string, unknown[]>): SetsFilters {
  const f: SetsFilters = {}
  const timed = record.timed?.[0]
  if (timed === 'timed' || timed === 'untimed') f.timed = timed
  const source = record.source?.[0]
  if (source === 'my' || source === 'public') f.source = source
  const sectionNum = record.sectionNumber?.[0]
  if (typeof sectionNum === 'number' && Number.isFinite(sectionNum)) f.sectionNumber = sectionNum
  if (record.attempted?.[0] === 'unattempted') f.attempted = 'unattempted'
  return f
}

/** Convert SetsFilters to ListToolbar filters format */
export function setsFiltersToRecord(f: SetsFilters): Record<string, unknown[]> {
  const record: Record<string, unknown[]> = {}
  if (f.timed === 'timed' || f.timed === 'untimed') record.timed = [f.timed]
  if (f.source === 'my' || f.source === 'public') record.source = [f.source]
  if (f.sectionNumber != null) record.sectionNumber = [f.sectionNumber]
  if (f.attempted === 'unattempted') record.attempted = ['unattempted']
  return record
}
