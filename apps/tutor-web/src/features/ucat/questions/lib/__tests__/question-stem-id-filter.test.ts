import { parseQuestionStemIdInput } from '@/features/ucat/questions/lib/question-stem-id-filter'

describe('parseQuestionStemIdInput', () => {
  it('accepts one ID or a comma-separated list and removes duplicates', () => {
    expect(parseQuestionStemIdInput(`
      10000000-0000-4000-8000-000000000001,
      10000000-0000-4000-8000-000000000002,
      10000000-0000-4000-8000-000000000001
    `)).toEqual({
      ids: [
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
      ],
      invalidTokens: [],
    })
  })

  it('keeps invalid tokens out of the database filter', () => {
    expect(parseQuestionStemIdInput('not-an-id, 10000000-0000-4000-8000-000000000001')).toEqual({
      ids: ['10000000-0000-4000-8000-000000000001'],
      invalidTokens: ['not-an-id'],
    })
  })
})
