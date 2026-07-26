import { UCAT_FILTER_NO_CATEGORY } from '@/features/ucat/shared/lib/table-filter-sentinel'
import type { QuestionRow } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'

/** Window around a stem's created_at used to catch same bulk-import runs. */
export const FIND_SIMILAR_CREATED_AT_LEEWAY_MS = 10 * 60 * 1000

export const FIND_SIMILAR_CRITERIA = [
  'created_at',
  'created_by',
  'source_channel',
  'section_id',
  'category',
  'tags',
] as const

export type FindSimilarCriterion = (typeof FIND_SIMILAR_CRITERIA)[number]

/** Encoded as `fromIso/toIso` in `created_at_window` filter values. */
export const CREATED_AT_WINDOW_FILTER_KEY = 'created_at_window'

export type FindSimilarCriterionOption = {
  id: FindSimilarCriterion
  label: string
  description?: string
}

export function parseCreatedAtWindow(raw: unknown): { fromMs: number; toMs: number } | null {
  if (typeof raw !== 'string') return null
  const [fromRaw, toRaw] = raw.split('/')
  if (!fromRaw || !toRaw) return null
  const fromMs = Date.parse(fromRaw)
  const toMs = Date.parse(toRaw)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null
  return { fromMs, toMs }
}

export function encodeCreatedAtWindow(createdAt: string, leewayMs = FIND_SIMILAR_CREATED_AT_LEEWAY_MS): string | null {
  const centerMs = Date.parse(createdAt)
  if (!Number.isFinite(centerMs)) return null
  const from = new Date(centerMs - leewayMs).toISOString()
  const to = new Date(centerMs + leewayMs).toISOString()
  return `${from}/${to}`
}

export function formatCreatedAtWindowLabel(raw: unknown): string | null {
  const window = parseCreatedAtWindow(raw)
  if (!window) return null
  const from = new Date(window.fromMs)
  const to = new Date(window.toMs)
  const sameDay =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate()
  const datePart = from.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  const fromTime = from.toLocaleTimeString(undefined, timeOpts)
  const toTime = to.toLocaleTimeString(undefined, timeOpts)
  if (sameDay) return `${datePart}, ${fromTime} – ${toTime}`
  return `${from.toLocaleString()} – ${to.toLocaleString()}`
}

export function rowMatchesCreatedAtWindow(
  createdAt: string | null | undefined,
  windowRaw: unknown,
): boolean {
  const window = parseCreatedAtWindow(windowRaw)
  if (!window) return true
  if (!createdAt) return false
  const createdMs = Date.parse(createdAt)
  if (!Number.isFinite(createdMs)) return false
  return createdMs >= window.fromMs && createdMs <= window.toMs
}

export function getAvailableFindSimilarCriteria(
  row: Pick<
    QuestionRow,
    | 'created_at'
    | 'created_by'
    | 'created_by_name'
    | 'source_channel'
    | 'source'
    | 'section_id'
    | 'section_name'
    | 'question_stem_category_id'
    | 'category_name'
    | 'tag_ids'
  >,
  tagLabelsById?: Map<string, string>,
): FindSimilarCriterionOption[] {
  const options: FindSimilarCriterionOption[] = []

  if (row.created_at) {
    options.push({
      id: 'created_at',
      label: 'Creation time',
      description: `±${FIND_SIMILAR_CREATED_AT_LEEWAY_MS / 60000} min window`,
    })
  }

  if (row.created_by) {
    options.push({
      id: 'created_by',
      label: 'Author',
      description: row.created_by_name || undefined,
    })
  }

  if (row.source_channel) {
    options.push({
      id: 'source_channel',
      label: 'Generation source',
      description: row.source.channelLabel,
    })
  }

  if (row.section_id) {
    options.push({
      id: 'section_id',
      label: 'Section',
      description: row.section_name !== '-' ? row.section_name : undefined,
    })
  }

  options.push({
    id: 'category',
    label: 'Category',
    description: row.category_name?.trim() || 'No category',
  })

  if (row.tag_ids.length > 0) {
    const tagNames = row.tag_ids
      .map((id) => tagLabelsById?.get(id))
      .filter((name): name is string => Boolean(name?.trim()))
    options.push({
      id: 'tags',
      label: 'Tag',
      description:
        tagNames.length > 0
          ? tagNames.slice(0, 3).join(', ') + (tagNames.length > 3 ? '…' : '')
          : `${row.tag_ids.length} tag${row.tag_ids.length === 1 ? '' : 's'}`,
    })
  }

  return options
}

export function buildFindSimilarQuestionStemFilters(
  row: Pick<
    QuestionRow,
    | 'created_at'
    | 'created_by'
    | 'source_channel'
    | 'section_id'
    | 'question_stem_category_id'
    | 'tag_ids'
  >,
  criteria: readonly FindSimilarCriterion[],
  leewayMs = FIND_SIMILAR_CREATED_AT_LEEWAY_MS,
): Record<string, unknown[]> {
  const selected = new Set(criteria)
  const filters: Record<string, unknown[]> = {}

  if (selected.has('created_at') && row.created_at) {
    const encoded = encodeCreatedAtWindow(row.created_at, leewayMs)
    if (encoded) filters[CREATED_AT_WINDOW_FILTER_KEY] = [encoded]
  }

  if (selected.has('created_by') && row.created_by) {
    filters.created_by = [row.created_by]
  }

  if (selected.has('source_channel') && row.source_channel) {
    filters.source_channel = [row.source_channel]
  }

  if (selected.has('section_id') && row.section_id) {
    filters.section_id = [row.section_id]
  }

  if (selected.has('category')) {
    filters.question_stem_category_id = [row.question_stem_category_id ?? UCAT_FILTER_NO_CATEGORY]
  }

  if (selected.has('tags') && row.tag_ids.length > 0) {
    filters.question_tag_id = [...row.tag_ids]
  }

  return filters
}
