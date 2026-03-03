import {
  isSnapshotDirty,
  snapshotMockDraft,
  snapshotQuestionStemFormValues,
  snapshotSetDetail,
} from '@/features/ucat/shared/lib/dirty-state'

describe('set detail dirty snapshot', () => {
  it('detects changes in ordered stem ids', () => {
    const baseline = snapshotSetDetail({
      name: 'Set 1',
      description: 'Set 1',
      time: 1200,
      isPrivate: false,
      isStudentGenerated: false,
      stemIds: ['s1', 's2'],
    })

    const changed = snapshotSetDetail({
      name: 'Set 1',
      description: 'Set 1',
      time: 1200,
      isPrivate: false,
      isStudentGenerated: false,
      stemIds: ['s2', 's1'],
    })

    expect(isSnapshotDirty(changed, baseline)).toBe(true)
    expect(isSnapshotDirty(baseline, baseline)).toBe(false)
  })
})

describe('question stem form snapshot', () => {
  const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
  const docWithText = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
  }

  it('treats structurally different but semantically equivalent ProseMirror JSON as equal', () => {
    const baseline = snapshotQuestionStemFormValues({
      sectionId: 's1',
      categoryId: null,
      stemText: emptyDoc,
      isPrivate: false,
      questions: [
        {
          questionText: docWithText,
          questionType: 'multiple_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, isAnswer: true },
            { answerText: emptyDoc, answerExplanation: null, isAnswer: false },
          ],
        },
      ],
    })

    // Structurally different: explicit content: [] vs omitted
    const structurallyDifferent = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }
    const current = snapshotQuestionStemFormValues({
      sectionId: 's1',
      categoryId: null,
      stemText: structurallyDifferent,
      isPrivate: false,
      questions: [
        {
          questionText: docWithText,
          questionType: 'multiple_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, isAnswer: true },
            { answerText: structurallyDifferent, answerExplanation: null, isAnswer: false },
          ],
        },
      ],
    })

    expect(isSnapshotDirty(current, baseline)).toBe(false)
  })

  it('detects actual content changes', () => {
    const baseline = snapshotQuestionStemFormValues({
      sectionId: 's1',
      categoryId: null,
      stemText: emptyDoc,
      isPrivate: false,
      questions: [
        {
          questionText: docWithText,
          questionType: 'multiple_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, isAnswer: true },
            { answerText: emptyDoc, answerExplanation: null, isAnswer: false },
          ],
        },
      ],
    })

    const changed = snapshotQuestionStemFormValues({
      sectionId: 's1',
      categoryId: null,
      stemText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Changed' }] }] },
      isPrivate: false,
      questions: [
        {
          questionText: docWithText,
          questionType: 'multiple_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, isAnswer: true },
            { answerText: emptyDoc, answerExplanation: null, isAnswer: false },
          ],
        },
      ],
    })

    expect(isSnapshotDirty(changed, baseline)).toBe(true)
  })
})

describe('mock draft snapshot', () => {
  it('treats structurally different ProseMirror instructionsText as equal when semantically same', () => {
    const baseline = snapshotMockDraft({
      name: 'Mock 1',
      isPrivate: false,
      setIds: ['a', 'b'],
      instructionsText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Instructions' }] }],
      },
    })

    const structurallyDifferent = snapshotMockDraft({
      name: 'Mock 1',
      isPrivate: false,
      setIds: ['a', 'b'],
      instructionsText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      },
    })

    // Empty paragraph vs paragraph with text - semantically different, so should be dirty
    expect(isSnapshotDirty(structurallyDifferent, baseline)).toBe(true)

    const semanticallySame = snapshotMockDraft({
      name: 'Mock 1',
      isPrivate: false,
      setIds: ['a', 'b'],
      instructionsText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Instructions' }] }],
      },
    })
    expect(isSnapshotDirty(semanticallySame, baseline)).toBe(false)
  })
})
