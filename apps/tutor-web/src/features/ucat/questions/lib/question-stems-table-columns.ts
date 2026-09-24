import type { DataTableColumnDefinition } from '@altitutor/shared'

export const QUESTION_STEM_NESTED_QUESTION_COLUMNS: DataTableColumnDefinition[] = [
  { key: 'index', label: 'Index', visibleByDefault: false },
  { key: 'question_text', label: 'Question text', visibleByDefault: true },
  { key: 'explanation', label: 'Explanation', visibleByDefault: true },
  { key: 'difficulty', label: 'Difficulty', visibleByDefault: true },
  { key: 'time_burden', label: 'Expected time to correct', visibleByDefault: true },
]

export const QUESTION_STEM_NESTED_ANSWER_COLUMNS: DataTableColumnDefinition[] = [
  { key: 'index', label: 'Index', visibleByDefault: false },
  { key: 'answer_text', label: 'Answer text', visibleByDefault: true },
  { key: 'answer_explanation', label: 'Answer explanation', visibleByDefault: true },
  { key: 'answer_key_value', label: 'Answer key', visibleByDefault: true },
]

export const QUESTION_STEM_TABLE_COLUMNS: DataTableColumnDefinition[] = [
  { key: 'section_category', label: 'Section', visibleByDefault: true },
  { key: 'stem_text', label: 'Stem text', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: false },
  { key: 'sets', label: 'Sets', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: false },
  { key: 'source', label: 'Source', visibleByDefault: true },
  { key: 'created_at', label: 'Date created', visibleByDefault: false },
  { key: 'status', label: 'Status', visibleByDefault: false },
  { key: 'review', label: 'Review', visibleByDefault: true },
  { key: 'type_summary', label: 'Type', visibleByDefault: false },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const SET_MEMBERSHIP_DEFAULT_VISIBLE = new Set([
  'section_category',
  'stem_text',
  'question_count',
  'source',
  'actions',
])

export const SET_MEMBERSHIP_TABLE_COLUMNS: DataTableColumnDefinition[] = QUESTION_STEM_TABLE_COLUMNS.map(
  (column) => ({
    ...column,
    visibleByDefault: SET_MEMBERSHIP_DEFAULT_VISIBLE.has(column.key),
  }),
)

export function defaultVisibleColumnKeys(columns: DataTableColumnDefinition[]): string[] {
  return columns.filter((column) => column.visibleByDefault).map((column) => column.key)
}
