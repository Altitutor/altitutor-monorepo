import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  filterStemCatalogItems,
  getDefaultStemCatalogFiltersForSetStatus,
  stemIsInAnotherPublishedSet,
} from '@/features/ucat/shared/lib/stem-catalog-filters'
import { UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET } from '@/features/ucat/shared/lib/table-filter-sentinel'

function stem(overrides: Partial<UcatStemCatalogItem> & Pick<UcatStemCatalogItem, 'id'>): UcatStemCatalogItem {
  return {
    text: overrides.id,
    questionsCount: 1,
    sectionName: 'Verbal Reasoning',
    sectionNumber: 1,
    sectionId: 'vr',
    categoryId: null,
    categoryName: null,
    accessScope: 'public',
    status: 'published',
    sourceChannel: 'individual',
    questionTypes: ['multiple_choice'],
    tagIds: [],
    createdAt: null,
    questionSearchText: '',
    answerOptionSearchText: '',
    setNames: '—',
    setIds: [],
    typeSummary: 'multiple_choice',
    ...overrides,
  }
}

describe('getDefaultStemCatalogFiltersForSetStatus', () => {
  it('defaults published sets to published stems not in another published set', () => {
    expect(getDefaultStemCatalogFiltersForSetStatus('published')).toEqual({
      status: ['published'],
      question_set_id: [UCAT_FILTER_NOT_IN_ANY_PUBLISHED_SET],
    })
  })

  it('leaves draft and in-review sets unfiltered by default', () => {
    expect(getDefaultStemCatalogFiltersForSetStatus('draft')).toEqual({})
    expect(getDefaultStemCatalogFiltersForSetStatus('in_review')).toEqual({})
    expect(getDefaultStemCatalogFiltersForSetStatus(null)).toEqual({})
  })
})

describe('stemIsInAnotherPublishedSet', () => {
  it('ignores membership in the current set', () => {
    expect(
      stemIsInAnotherPublishedSet(['current', 'other-published'], new Set(['current', 'other-published']), 'current'),
    ).toBe(true)
    expect(
      stemIsInAnotherPublishedSet(['current'], new Set(['current', 'other-published']), 'current'),
    ).toBe(false)
  })

  it('ignores draft-set membership', () => {
    expect(
      stemIsInAnotherPublishedSet(['draft-set'], new Set(['published-set']), 'current'),
    ).toBe(false)
  })
})

describe('filterStemCatalogItems published-set defaults', () => {
  const publishedSetIds = new Set(['published-a', 'published-b'])
  const stems = [
    stem({ id: 'available', status: 'published', setIds: [] }),
    stem({ id: 'draft-stem', status: 'draft', setIds: [] }),
    stem({ id: 'in-other-published', status: 'published', setIds: ['published-b'] }),
    stem({ id: 'only-current', status: 'published', setIds: ['published-a'] }),
    stem({ id: 'in-draft-set', status: 'published', setIds: ['draft-set'] }),
  ]

  it('applies published-set default filters', () => {
    const filtered = filterStemCatalogItems({
      stems,
      search: '',
      filters: getDefaultStemCatalogFiltersForSetStatus('published'),
      publishedSetIds,
      currentSetId: 'published-a',
    })

    expect(filtered.map((item) => item.id)).toEqual(['available', 'only-current', 'in-draft-set'])
  })
})
