import { buildSetQuestionDistributions } from '@/features/ucat/sets/lib/set-question-distribution'

describe('buildSetQuestionDistributions', () => {
  it('counts questions per stem category and per-question tags', () => {
    const distributions = buildSetQuestionDistributions([
      {
        categoryName: 'Reading Comprehension',
        questions: [
          { tags: [{ name: 'Inference' }, { name: 'Detail' }] },
          { tags: [{ name: 'Inference' }] },
        ],
      },
      {
        categoryName: '  ',
        questions: [{ tags: [] }],
      },
    ])

    expect(distributions.categories).toEqual([
      { label: 'Reading Comprehension', count: 2 },
      { label: 'Uncategorised', count: 1 },
    ])
    expect(distributions.tags).toEqual([
      { label: 'Inference', count: 2 },
      { label: 'Detail', count: 1 },
      { label: 'Untagged', count: 1 },
    ])
  })
})
