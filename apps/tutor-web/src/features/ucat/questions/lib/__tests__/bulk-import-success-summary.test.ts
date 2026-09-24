import { bulkImportSuccessSummary } from '../bulk-import-success-summary'

describe('bulkImportSuccessSummary', () => {
  it('reports stem and question totals with a lifecycle breakdown', () => {
    expect(bulkImportSuccessSummary({
      questionCount: 30,
      statuses: {
        one: 'in_review',
        two: 'in_review',
        three: 'draft',
      },
    })).toEqual({
      title: '3 stems imported (30 questions)',
      description: '2 In review · 1 Draft',
    })
  })

  it('uses singular labels', () => {
    expect(bulkImportSuccessSummary({
      questionCount: 1,
      statuses: { one: 'draft' },
    })).toEqual({
      title: '1 stem imported (1 question)',
      description: '0 In review · 1 Draft',
    })
  })
})
