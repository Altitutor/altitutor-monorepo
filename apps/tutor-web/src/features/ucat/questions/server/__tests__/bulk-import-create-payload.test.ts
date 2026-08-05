import { normalizeBulkImportCreatePayload } from '../bulk-import-create-payload'

describe('normalizeBulkImportCreatePayload', () => {
  it('removes client-only IDs before creating stems, questions, and options', () => {
    const payload = [{
      stemId: '10000000-0000-4000-8000-000000000001',
      sectionId: '20000000-0000-4000-8000-000000000001',
      importStatus: 'draft' as const,
      questions: [{
        id: '30000000-0000-4000-8000-000000000001',
        index: 1,
        answer_options: [{
          id: '40000000-0000-4000-8000-000000000001',
          index: 1,
          is_answer: true,
        }],
      }],
    }]

    expect(normalizeBulkImportCreatePayload(payload)).toEqual([{
      ...payload[0],
      stemId: null,
      questions: [{
        ...payload[0].questions[0],
        id: null,
        answer_options: [{
          ...payload[0].questions[0].answer_options[0],
          id: null,
        }],
      }],
    }])
  })

  it('does not mutate the client payload', () => {
    const payload = [{
      stemId: '10000000-0000-4000-8000-000000000001',
      questions: [{
        id: '30000000-0000-4000-8000-000000000001',
        answer_options: [{ id: '40000000-0000-4000-8000-000000000001' }],
      }],
    }]

    normalizeBulkImportCreatePayload(payload)

    expect(payload[0].stemId).toBe('10000000-0000-4000-8000-000000000001')
    expect(payload[0].questions[0].id).toBe('30000000-0000-4000-8000-000000000001')
    expect(payload[0].questions[0].answer_options[0].id)
      .toBe('40000000-0000-4000-8000-000000000001')
  })
})
