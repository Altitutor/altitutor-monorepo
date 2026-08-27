import { contentChangeDiff } from '../content-change-diff'

describe('contentChangeDiff', () => {
  it('reports nested changes with readable paths', () => {
    expect(contentChangeDiff(
      { questions: [{ answerKeyValue: 'A' }] },
      { questions: [{ answerKeyValue: 'B' }] },
    )).toEqual([{
      field: 'questions #1 › answer Key Value',
      before: 'A',
      after: 'B',
    }])
  })

  it('renders rich-text documents as readable text', () => {
    const doc = (text: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })

    expect(contentChangeDiff(
      { stemText: doc('Before') },
      { stemText: doc('After') },
    )).toEqual([{
      field: 'stem Text',
      before: 'Before',
      after: 'After',
    }])
  })

  it('omits unchanged fields', () => {
    expect(contentChangeDiff({ title: 'Same' }, { title: 'Same' })).toEqual([])
  })
})
