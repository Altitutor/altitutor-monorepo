import { UCAT_FILTER_NO_CATEGORY } from '@/features/ucat/shared/lib/table-filter-sentinel'
import {
  buildFindSimilarQuestionStemFilters,
  createdAtLeewayMsFromMinutes,
  encodeCreatedAtWindow,
  FIND_SIMILAR_CREATED_AT_LEEWAY_MS,
  FIND_SIMILAR_CREATED_AT_LEEWAY_MINUTES,
  formatCreatedAtWindowLabel,
  getAvailableFindSimilarCriteria,
  parseCreatedAtWindow,
  rowMatchesCreatedAtWindow,
} from '@/features/ucat/questions/lib/find-similar-question-stems'
import type { QuestionRow } from '@/features/ucat/questions/hooks/useUcatQuestionsTable'

function baseRow(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id: 'stem-1',
    section_name: 'Verbal Reasoning',
    section_id: 'section-1',
    category_name: 'True/False/Cant Tell',
    question_stem_category_id: 'cat-1',
    question_count: 1,
    access_scope: 'public',
    created_at: '2026-07-25T12:00:00.000Z',
    updated_at: '2026-07-25T12:00:00.000Z',
    created_by: 'user-1',
    created_by_name: 'Ada Lovelace',
    tag_ids: ['tag-1', 'tag-2'],
    type_summary: 'multiple_choice',
    stem_text: 'Stem',
    question_text: '',
    answer_option_text: '',
    tutor_source_note: '',
    set_names: '—',
    sets: [],
    set_ids: [],
    deleted_at: null,
    status: 'draft',
    source_channel: 'bulk_import',
    source: {
      sourceChannel: 'bulk_import',
      channelLabel: 'Bulk import',
      aiModel: null,
      generatedAt: null,
      generatedAtLabel: null,
      generatedByName: 'Ada Lovelace',
      statusChangedByName: null,
      statusChangedAt: null,
      statusChangedAtLabel: null,
      tutorSourceNote: null,
    },
    is_available_in_question_pool: true,
    ...overrides,
  }
}

describe('find-similar-question-stems', () => {
  it('defaults the creation-time window to 1 minute', () => {
    expect(FIND_SIMILAR_CREATED_AT_LEEWAY_MINUTES).toBe(1)
    expect(FIND_SIMILAR_CREATED_AT_LEEWAY_MS).toBe(60_000)
    expect(createdAtLeewayMsFromMinutes(10)).toBe(600_000)
    expect(createdAtLeewayMsFromMinutes(0)).toBe(60_000)
    expect(createdAtLeewayMsFromMinutes(999)).toBe(7_200_000)
  })

  it('encodes and parses a created_at window', () => {
    const encoded = encodeCreatedAtWindow('2026-07-25T12:00:00.000Z', 60_000)
    expect(encoded).toBe('2026-07-25T11:59:00.000Z/2026-07-25T12:01:00.000Z')
    expect(parseCreatedAtWindow(encoded)).toEqual({
      fromMs: Date.parse('2026-07-25T11:59:00.000Z'),
      toMs: Date.parse('2026-07-25T12:01:00.000Z'),
    })
  })

  it('matches created_at values inside the window only', () => {
    const window = encodeCreatedAtWindow('2026-07-25T12:00:00.000Z', 60_000)
    expect(rowMatchesCreatedAtWindow('2026-07-25T12:00:30.000Z', window)).toBe(true)
    expect(rowMatchesCreatedAtWindow('2026-07-25T12:02:00.000Z', window)).toBe(false)
    expect(rowMatchesCreatedAtWindow(null, window)).toBe(false)
    expect(rowMatchesCreatedAtWindow('2026-07-25T12:00:00.000Z', null)).toBe(true)
  })

  it('builds filters for selected criteria only', () => {
    const row = baseRow({ question_stem_category_id: null, category_name: null })
    expect(
      buildFindSimilarQuestionStemFilters(row, ['created_by', 'source_channel', 'category']),
    ).toEqual({
      created_by: ['user-1'],
      source_channel: ['bulk_import'],
      question_stem_category_id: [UCAT_FILTER_NO_CATEGORY],
    })
  })

  it('includes a created_at window and tags when requested', () => {
    const row = baseRow()
    const filters = buildFindSimilarQuestionStemFilters(row, ['created_at', 'tags'], 60_000)
    expect(filters.created_at_from).toEqual(['2026-07-25T11:59:00.000Z'])
    expect(filters.created_at_to).toEqual(['2026-07-25T12:01:00.000Z'])
    expect(filters.question_tag_id).toEqual(['tag-1', 'tag-2'])
  })

  it('lists available criteria with descriptions', () => {
    const options = getAvailableFindSimilarCriteria(baseRow(), new Map([['tag-1', 'Inference'], ['tag-2', 'Tone']]))
    expect(options.map((option) => option.id)).toEqual([
      'created_at',
      'created_by',
      'source_channel',
      'section_id',
      'category',
      'tags',
    ])
    expect(options.find((option) => option.id === 'created_at')?.description).toBe('±1 min window')
    expect(options.find((option) => option.id === 'created_by')?.description).toBe('Ada Lovelace')
    expect(options.find((option) => option.id === 'tags')?.description).toBe('Inference, Tone')
    expect(
      getAvailableFindSimilarCriteria(baseRow(), undefined, 600_000).find((option) => option.id === 'created_at')
        ?.description,
    ).toBe('±10 min window')
  })

  it('formats created_at window labels', () => {
    const label = formatCreatedAtWindowLabel('2026-07-25T11:59:00.000Z/2026-07-25T12:01:00.000Z')
    expect(label).toContain('2026')
    expect(label).toContain('–')
  })
})
