import { buildMockSetsColumnRows } from '@/features/ucat/shared/lib/mock-sets-column-display'

describe('buildMockSetsColumnRows', () => {
  it('uses the deterministic display name supplied by the mock detail view', () => {
    const rows = buildMockSetsColumnRows(
      [{
        id: 'set-1',
        name: null,
        display_name: 'Mock 1 Verbal Reasoning',
        sections: [{ section_number: 1, name: 'Verbal Reasoning' }],
        question_count: 44,
        time_limit_seconds: 1320,
      }],
      [{
        id: 'vr',
        section_number: 1,
        name: 'Verbal Reasoning',
        number_of_questions: 44,
        time_limit_seconds: 1320,
      }],
    )

    expect(rows[0]).toEqual(expect.objectContaining({
      kind: 'set',
      name: 'Mock 1 Verbal Reasoning',
    }))
  })
})
