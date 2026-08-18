import { buildQuestionCatalogProvenanceFilters } from '@/features/ucat/questions/lib/question-catalog-provenance-filters'

describe('buildQuestionCatalogProvenanceFilters', () => {
  it('keeps creation methods under Source and staff names under Created by', () => {
    const filters = buildQuestionCatalogProvenanceFilters([
      { label: 'Ada Lovelace', value: 'staff-1' },
    ])

    expect(filters).toEqual([
      {
        key: 'source_channel',
        label: 'Source',
        options: [
          { label: 'Individual add', value: 'individual' },
          { label: 'Bulk import', value: 'bulk_import' },
          { label: 'AI generation', value: 'ai_generation' },
        ],
      },
      {
        key: 'created_by',
        label: 'Created by',
        options: [{ label: 'Ada Lovelace', value: 'staff-1' }],
      },
    ])
  })
})
