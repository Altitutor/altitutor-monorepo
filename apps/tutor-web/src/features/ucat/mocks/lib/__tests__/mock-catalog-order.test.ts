import {
  belongsInMockCatalogOrder,
  buildPublishedMockOrder,
  unpublishedMockOrderRows,
  type MockCatalogOrderRow,
} from '@/features/ucat/mocks/lib/mock-catalog-order'

function row(
  overrides: Partial<MockCatalogOrderRow> & Pick<MockCatalogOrderRow, 'id'>,
): MockCatalogOrderRow {
  return {
    displayName: overrides.id,
    authoringNote: null,
    catalogIndex: null,
    status: 'draft',
    ...overrides,
    id: overrides.id,
  }
}

describe('published Mock catalog order', () => {
  it('orders published mocks independently of unpublished rows', () => {
    expect(
      buildPublishedMockOrder([
        row({ id: 'draft', status: 'draft' }),
        row({ id: 'mock-2', catalogIndex: 2, status: 'published' }),
        row({ id: 'mock-1', catalogIndex: 1, status: 'published' }),
        row({ id: 'review', status: 'in_review' }),
      ]),
    ).toEqual(['mock-1', 'mock-2'])
  })

  it('keeps unpublished mocks out of the published sequence and lists them after', () => {
    expect(belongsInMockCatalogOrder({ deletedAt: null })).toBe(true)
    expect(
      belongsInMockCatalogOrder({ deletedAt: '2026-09-02T00:00:00Z' }),
    ).toBe(false)
    expect(
      unpublishedMockOrderRows([
        row({ id: 'mock-1', catalogIndex: 1, status: 'published' }),
        row({ id: 'zeta', status: 'draft', displayName: 'Zeta' }),
        row({ id: 'alpha', status: 'draft', displayName: 'Alpha' }),
        row({ id: 'review', status: 'in_review', displayName: 'Review' }),
      ]).map((item) => item.id),
    ).toEqual(['alpha', 'zeta', 'review'])
  })
})
