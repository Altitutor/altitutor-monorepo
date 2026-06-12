import type { UcatSection } from '@/features/ucat/shared/types'

function sectionFilterValues(filters: Record<string, unknown[]>): unknown[] {
  const values = filters.section_id
  if (!Array.isArray(values)) return []
  return values.filter((value) => value !== 'all')
}

/** Resolve selected section UUIDs from a filter whose values are section IDs. */
export function resolveSectionIdsFromIdFilter(
  filters: Record<string, unknown[]>
): string[] {
  return sectionFilterValues(filters).map(String)
}

/** Resolve selected section UUIDs from a filter whose values are section numbers. */
export function resolveSectionIdsFromNumberFilter(
  sections: UcatSection[],
  filters: Record<string, unknown[]>
): string[] {
  const numbers = new Set(sectionFilterValues(filters).map((value) => Number(value)))
  if (numbers.size === 0) return []
  return sections
    .filter((section) => section.id && numbers.has(section.section_number ?? -1))
    .map((section) => section.id as string)
}
