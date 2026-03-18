import { SECTION_NUMBER_TO_NAME } from '@/features/sets/lib/section-labels'

/** Maps path segments to display labels for breadcrumbs. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  progress: 'Progress',
  sets: 'Sets',
  sections: 'Sections',
  mocks: 'Mocks',
  learn: 'Learn',
  sessions: 'Sessions',
  practice: 'Practice',
  'set-generator': 'Set Generator',
}

/** Label for dynamic segments (UUIDs, etc.) when parent is known. */
const DYNAMIC_SEGMENT_LABELS: Record<string, string> = {
  sets: 'Set',
  sections: 'Section',
  mocks: 'Mock',
  sessions: 'Session',
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isDynamicSegment(segment: string): boolean {
  return UUID_REGEX.test(segment) || /^\d+$/.test(segment)
}

/**
 * Paths that have actual pages. Intermediate segments (e.g. /progress/mocks,
 * /progress/mocks/[id]/sets) are not valid - linking to them would 404.
 */
function isValidPagePath(path: string): boolean {
  if (!path || path === '/') return false
  const segments = path.split('/').filter(Boolean)

  switch (segments.length) {
    case 1:
      return ['dashboard', 'progress', 'learn', 'sessions', 'practice', 'sets', 'mocks'].includes(
        segments[0]
      )
    case 2:
      return (
        (segments[0] === 'progress' && segments[1] === 'mocks') ||
        (segments[0] === 'sessions' && isDynamicSegment(segments[1])) ||
        (segments[0] === 'sets' && isDynamicSegment(segments[1])) ||
        (segments[0] === 'sets' && segments[1] === 'set-generator') ||
        (segments[0] === 'mocks' && isDynamicSegment(segments[1]))
      )
    case 3:
      return (
        (segments[0] === 'progress' &&
          ['sets', 'sections', 'mocks'].includes(segments[1]) &&
          isDynamicSegment(segments[2])) ||
        (segments[0] === 'sets' &&
          segments[1] === 'sections' &&
          /^[1-4]$/.test(segments[2])) ||
        (segments[0] === 'sets' &&
          segments[1] === 'set-generator' &&
          isDynamicSegment(segments[2]))
      )
    case 4:
      return (
        segments[0] === 'sets' &&
        segments[1] === 'sections' &&
        /^[1-4]$/.test(segments[2]) &&
        isDynamicSegment(segments[3])
      )
    case 5:
      return (
        segments[0] === 'progress' &&
        segments[1] === 'mocks' &&
        isDynamicSegment(segments[2]) &&
        segments[3] === 'sets' &&
        isDynamicSegment(segments[4])
      )
    default:
      return false
  }
}

/**
 * Returns the nearest valid page path that is an ancestor of or equal to the given path.
 */
function getEffectiveHref(path: string): string | null {
  const segments = path.split('/').filter(Boolean)
  for (let len = segments.length; len >= 1; len--) {
    const candidate = '/' + segments.slice(0, len).join('/')
    if (isValidPagePath(candidate)) return candidate
  }
  return null
}

export type BreadcrumbItem = {
  href: string
  label: string
  /** When set, this segment has no page - use effectiveHref for linking or render as text */
  effectiveHref: string | null
}

/**
 * Builds breadcrumb items from a pathname.
 * Returns empty array for exam routes (question engine).
 */
export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  if (pathname.startsWith('/exam')) {
    return []
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []

  const items: BreadcrumbItem[] = []
  let href = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    href += `/${segment}`

    let label =
      SEGMENT_LABELS[segment] ??
      (isDynamicSegment(segment)
        ? DYNAMIC_SEGMENT_LABELS[segments[i - 1]] ?? 'Detail'
        : segment)

    // For /sets/sections/[1-4] or /progress/sections/[1-4], show section name (e.g. "Verbal Reasoning") instead of "Section"
    if (
      segments[1] === 'sections' &&
      i === 2 &&
      /^[1-4]$/.test(segment)
    ) {
      label = SECTION_NUMBER_TO_NAME[parseInt(segment, 10)] ?? label
    }

    const effectiveHref = getEffectiveHref(href)

    items.push({ href, label, effectiveHref })
  }

  return items
}
