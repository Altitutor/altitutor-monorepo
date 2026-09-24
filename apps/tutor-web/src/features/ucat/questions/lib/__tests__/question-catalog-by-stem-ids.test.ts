import type { UcatQuestionCatalogRow } from '@/features/ucat/questions/api/questions'
import {
  chunkStemIds,
  mergeCatalogRowsByStemIds,
  orderCatalogRowsByStemIds,
  questionCatalogQueryForStemIds,
} from '@/features/ucat/questions/lib/question-catalog-by-stem-ids'

function catalogRow(id: string): UcatQuestionCatalogRow {
  return { id } as UcatQuestionCatalogRow
}

describe('chunkStemIds', () => {
  it('drops blanks, dedupes, and chunks by page size', () => {
    expect(chunkStemIds(['a', 'a', '', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']])
  })

  it('returns no chunks when there are no stem ids', () => {
    expect(chunkStemIds([])).toEqual([])
  })
})

describe('questionCatalogQueryForStemIds', () => {
  it('asks the questions catalog RPC for those ids without extra filters', () => {
    const query = questionCatalogQueryForStemIds(
      ['10000000-0000-4000-8000-000000000001'],
      'published',
    )

    expect(query).toMatchObject({
      status: 'published',
      showDeleted: false,
      search: '',
      stemIds: ['10000000-0000-4000-8000-000000000001'],
      sectionIds: [],
      setIds: [],
      page: 1,
      pageSize: 1,
    })
  })
})

describe('orderCatalogRowsByStemIds', () => {
  it('keeps set order and ignores catalog rows that are not in the set', () => {
    const ordered = orderCatalogRowsByStemIds(
      [catalogRow('c'), catalogRow('a'), catalogRow('extra')],
      ['a', 'b', 'c'],
    )

    expect(ordered.map((row) => row.id)).toEqual(['a', 'c'])
  })
})

describe('mergeCatalogRowsByStemIds', () => {
  it('merges status-scoped catalog pages and keeps the first copy of each stem', () => {
    const merged = mergeCatalogRowsByStemIds(
      [
        { items: [catalogRow('a')] },
        { items: [catalogRow('a'), catalogRow('c')] },
        { items: [catalogRow('b')] },
      ],
      ['c', 'a', 'b'],
    )

    expect(merged.map((row) => row.id)).toEqual(['c', 'a', 'b'])
  })
})
