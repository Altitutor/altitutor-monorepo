import {
  compileStemCatalogFilter,
  hasQuestionCatalogFilters,
} from '@/features/ucat/mcp/server/catalog-filters'

describe('UCAT MCP catalog filters', () => {
  it('maps flat fields into a single clause expression', () => {
    expect(compileStemCatalogFilter({
      statuses: ['published', 'in_review'],
      sectionId: '60000000-0000-0000-0000-000000000001',
      auditFilters: ['not_audited'],
    })).toEqual({
      clause: {
        statuses: ['published', 'in_review'],
        sectionIds: ['60000000-0000-0000-0000-000000000001'],
        auditFilters: ['not_audited'],
      },
    })
  })

  it('ANDs explicit filter trees with flat fields', () => {
    expect(compileStemCatalogFilter({
      filter: {
        any: [
          { clause: { auditFilters: ['73100000-0000-0000-0000-000000000001:failed'] } },
          { clause: { auditFilters: ['not_audited'] } },
        ],
      },
      statuses: ['published'],
    })).toEqual({
      all: [
        {
          any: [
            { clause: { auditFilters: ['73100000-0000-0000-0000-000000000001:failed'] } },
            { clause: { auditFilters: ['not_audited'] } },
          ],
        },
        {
          clause: {
            statuses: ['published'],
          },
        },
      ],
    })
  })

  it('returns null when no stem predicates are provided', () => {
    expect(compileStemCatalogFilter({})).toBeNull()
  })

  it('detects extended catalog filters', () => {
    expect(hasQuestionCatalogFilters({})).toBe(false)
    expect(hasQuestionCatalogFilters({
      auditFilters: ['73100000-0000-0000-0000-000000000001:failed'],
    })).toBe(true)
  })
})
