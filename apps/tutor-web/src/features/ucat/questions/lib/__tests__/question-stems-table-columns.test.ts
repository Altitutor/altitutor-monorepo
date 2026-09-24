import {
  defaultVisibleColumnKeys,
  QUESTION_STEM_TABLE_COLUMNS,
  SET_MEMBERSHIP_TABLE_COLUMNS,
} from '@/features/ucat/questions/lib/question-stems-table-columns'

describe('set membership table columns', () => {
  it('keeps the questions table columns and only changes which are on by default', () => {
    expect(SET_MEMBERSHIP_TABLE_COLUMNS.map((column) => column.key)).toEqual(
      QUESTION_STEM_TABLE_COLUMNS.map((column) => column.key),
    )
    expect(defaultVisibleColumnKeys(SET_MEMBERSHIP_TABLE_COLUMNS)).toEqual([
      'section_category',
      'stem_text',
      'question_count',
      'source',
      'actions',
    ])
  })
})
