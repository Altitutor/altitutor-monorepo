import {
  buildQuestionCatalogQuery,
  CREATED_AT_FROM_FILTER_KEY,
  CREATED_AT_TO_FILTER_KEY,
  QUESTION_COUNT_MAX_FILTER_KEY,
  QUESTION_COUNT_MIN_FILTER_KEY,
} from '@/features/ucat/questions/lib/question-catalog-query'
import {
  UCAT_FILTER_NO_CATEGORY,
  UCAT_FILTER_NOT_IN_ANY_SET,
  UCAT_FILTER_NOT_IN_PRACTICE_POOL,
  UCAT_FILTER_PRACTICE_POOL,
} from '@/features/ucat/shared/lib/table-filter-sentinel'

describe('buildQuestionCatalogQuery', () => {
  it('translates table state into the server catalog contract', () => {
    const query = buildQuestionCatalogQuery({
      status: 'in_review',
      showDeleted: false,
      searchScopes: ['stem_text', 'question_text'],
      tableState: {
        search: ' Kidney ',
        filters: {
          section_id: ['section-1'],
          question_stem_category_id: [UCAT_FILTER_NO_CATEGORY, 'category-1'],
          question_tag_id: ['tag-1'],
          visibility: ['private', UCAT_FILTER_PRACTICE_POOL],
          question_set_id: [UCAT_FILTER_NOT_IN_ANY_SET, 'set-1'],
          source_channel: ['bulk_import'],
          ai_review_status: ['concerns', 'critical'],
          created_by: ['staff-1'],
          [CREATED_AT_FROM_FILTER_KEY]: ['2026-07-01T09:30:00+09:30'],
          [CREATED_AT_TO_FILTER_KEY]: ['2026-07-02T10:45:00+09:30'],
          [QUESTION_COUNT_MIN_FILTER_KEY]: ['2'],
          [QUESTION_COUNT_MAX_FILTER_KEY]: ['5.9'],
        },
        sortBy: 'created_at',
        sortDirection: 'asc',
        groupBy: null,
        page: 3,
        pageSize: 50,
        visibleColumns: [],
      },
    })

      expect(query).toMatchObject({
      status: 'in_review',
      search: 'Kidney',
      sectionIds: ['section-1'],
      categoryIds: ['category-1'],
      includeNoCategory: true,
      tagIds: ['tag-1'],
      accessScopes: ['private'],
      practicePool: true,
      setIds: ['set-1'],
      includeWithoutSet: true,
      sourceChannels: ['bulk_import'],
      aiReviewStatuses: ['concerns', 'critical'],
      createdByIds: ['staff-1'],
      createdFrom: '2026-07-01T00:00:00.000Z',
      createdTo: '2026-07-02T01:15:00.000Z',
      questionCountMin: 2,
      questionCountMax: 5,
      sortBy: 'created_at',
      sortDirection: 'asc',
      page: 3,
      pageSize: 50,
    })
  })

  it('treats both practice-pool choices as no pool-membership restriction', () => {
    const query = buildQuestionCatalogQuery({
      status: 'draft',
      showDeleted: false,
      searchScopes: ['stem_text'],
      tableState: {
        search: '',
        filters: {
          visibility: [UCAT_FILTER_PRACTICE_POOL, UCAT_FILTER_NOT_IN_PRACTICE_POOL],
        },
        sortBy: null,
        sortDirection: 'desc',
        groupBy: null,
        page: 1,
        pageSize: 20,
        visibleColumns: [],
      },
    })

    expect(query.accessScopes).toEqual([])
    expect(query.practicePool).toBeNull()
  })
})
