import {
  belongsInStandaloneCatalogOrder,
  buildPublishedSetOrders,
  getSetOrderStatusTransitions,
  type SetCatalogOrderRow,
} from '@/features/ucat/sets/lib/set-catalog-order'

function row(
  overrides: Partial<SetCatalogOrderRow> & Pick<SetCatalogOrderRow, 'id'>,
): SetCatalogOrderRow {
  return {
    displayName: overrides.id,
    authoringNote: null,
    sectionId: 'section-1',
    sectionName: 'Verbal Reasoning',
    sectionNumber: 1,
    setFormat: 'full_section',
    catalogIndex: null,
    status: 'draft',
    timingMode: 'pace',
    paceMultiplier: 1,
    timeLimitSeconds: 120,
    questionCount: 10,
    ...overrides,
    id: overrides.id,
  }
}

describe('published Set catalog order', () => {
  it('orders published sets independently by section and format', () => {
    expect(
      buildPublishedSetOrders([
        row({ id: 'draft', catalogIndex: 1, status: 'draft' }),
        row({ id: 'full-2', catalogIndex: 2, status: 'published' }),
        row({ id: 'full-1', catalogIndex: 1, status: 'published' }),
        row({
          id: 'partial-1',
          catalogIndex: 1,
          status: 'published',
          setFormat: 'partial_section',
        }),
        row({
          id: 'other-section',
          catalogIndex: 1,
          status: 'published',
          sectionId: 'section-2',
        }),
        row({ id: 'review', catalogIndex: 2, status: 'in_review' }),
      ]),
    ).toEqual({
      'section-1:full_section': ['full-1', 'full-2'],
      'section-1:partial_section': ['partial-1'],
      'section-2:full_section': ['other-section'],
    })
  })

  it('keeps unpublished and numbered published sets in the standalone order list', () => {
    expect(
      belongsInStandaloneCatalogOrder({
        status: 'draft',
        catalogIndex: null,
      }),
    ).toBe(true)
    expect(
      belongsInStandaloneCatalogOrder({
        status: 'published',
        catalogIndex: 10,
      }),
    ).toBe(true)
    expect(
      belongsInStandaloneCatalogOrder({
        status: 'published',
        catalogIndex: null,
      }),
    ).toBe(false)
    expect(
      belongsInStandaloneCatalogOrder({
        deletedAt: '2026-08-31T00:00:00Z',
        status: 'published',
        catalogIndex: 1,
      }),
    ).toBe(false)
  })

  it('offers lifecycle actions instead of positional move actions', () => {
    expect(getSetOrderStatusTransitions('draft')).toEqual([
      { status: 'in_review', label: 'Move to in review' },
    ])
    expect(getSetOrderStatusTransitions('in_review')).toEqual([
      { status: 'published', label: 'Publish' },
      { status: 'draft', label: 'Move to draft' },
    ])
    expect(getSetOrderStatusTransitions('published')).toEqual([
      { status: 'in_review', label: 'Move to in review' },
      { status: 'draft', label: 'Move to draft' },
    ])
  })
})
