import { buildQuestionStemListIndex } from '@/features/ucat/questions/lib/build-question-stem-list-index'

describe('buildQuestionStemListIndex', () => {
  it('derives types, tags, and search texts from one detail payload', () => {
    const index = buildQuestionStemListIndex([
      {
        id: 'stem-1',
        questions: [
          {
            question_type: 'multiple_choice',
            question_text: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Q1' }] }] },
            tags: [{ id: 'tag-a' }, { id: 'tag-b' }],
            answer_options: [
              {
                answer_text: {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }],
                },
              },
              {
                deleted_at: '2026-01-01T00:00:00.000Z',
                answer_text: {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deleted' }] }],
                },
              },
            ],
          },
          {
            deleted_at: '2026-01-01T00:00:00.000Z',
            question_type: 'syllogism',
            question_text: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Deleted Q' }] }] },
            tags: [{ id: 'tag-c' }],
          },
        ],
      },
    ])

    expect(Array.from(index.types['stem-1'] ?? [])).toEqual(['multiple_choice', 'syllogism'])
    expect(index.tagIds['stem-1']).toEqual(['tag-a', 'tag-b'])
    expect(index.searchTexts['stem-1']).toEqual({
      questionText: 'Q1',
      answerOptionText: 'A',
    })
  })

  it('skips rows without ids', () => {
    const index = buildQuestionStemListIndex([{ id: null, questions: [] }])
    expect(index.types).toEqual({})
    expect(index.tagIds).toEqual({})
    expect(index.searchTexts).toEqual({})
  })
})
