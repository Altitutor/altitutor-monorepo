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
      accessScope: 'public',
      sectionId: 'section-vr',
      stemIds: ['s1', 's2'],
    })

    const changed = snapshotSetDetail({
      name: 'Set 1',
      description: 'Set 1',
      time: 1200,
      accessScope: 'public',
      sectionId: 'section-vr',
      stemIds: ['s2', 's1'],
    })

    expect(isSnapshotDirty(changed, baseline)).toBe(true)
    expect(isSnapshotDirty(baseline, baseline)).toBe(false)
  })

  it('detects an authored section change', () => {
    const baseline = snapshotSetDetail({
      name: 'Set 1',
      description: 'Set 1',
      time: 1200,
      accessScope: 'public',
      sectionId: 'section-vr',
      stemIds: [],
    })
    const changed = snapshotSetDetail({
      name: 'Set 1',
      description: 'Set 1',
      time: 1200,
      accessScope: 'public',
      sectionId: 'section-dm',
      stemIds: [],
    })
    expect(isSnapshotDirty(changed, baseline)).toBe(true)
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
      accessScope: 'public',
      questions: [
        {
          questionText: docWithText,
          responseType: 'multiple_choice', answerScheme: 'single_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, answerKeyValue: 'correct' },
            { answerText: emptyDoc, answerExplanation: null, answerKeyValue: null },
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
      accessScope: 'public',
      questions: [
        {
          questionText: docWithText,
          responseType: 'multiple_choice', answerScheme: 'single_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, answerKeyValue: 'correct' },
            { answerText: structurallyDifferent, answerExplanation: null, answerKeyValue: null },
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
      accessScope: 'public',
      questions: [
        {
          questionText: docWithText,
          responseType: 'multiple_choice', answerScheme: 'single_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, answerKeyValue: 'correct' },
            { answerText: emptyDoc, answerExplanation: null, answerKeyValue: null },
          ],
        },
      ],
    })

    const changed = snapshotQuestionStemFormValues({
      sectionId: 's1',
      categoryId: null,
      stemText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Changed' }] }] },
      accessScope: 'public',
      questions: [
        {
          questionText: docWithText,
          responseType: 'multiple_choice', answerScheme: 'single_choice',
          answerExplanation: null,
          difficulty: null,
          timeBurdenSeconds: '90',
          tagIds: [],
          options: [
            { answerText: docWithText, answerExplanation: null, answerKeyValue: 'correct' },
            { answerText: emptyDoc, answerExplanation: null, answerKeyValue: null },
          ],
        },
      ],
    })

    expect(isSnapshotDirty(changed, baseline)).toBe(true)
  })

  it('detects changes to the tutor source note', () => {
    const values = {
      sectionId: 's1',
      categoryId: null,
      stemText: emptyDoc,
      accessScope: 'public' as const,
      tutorSourceNote: 'Original source',
      questions: [
        {
          questionText: docWithText,
          responseType: 'multiple_choice', answerScheme: 'single_choice',
          options: [
            { answerText: docWithText, answerExplanation: null, answerKeyValue: 'correct' },
          ],
        },
      ],
    }
    const baseline = snapshotQuestionStemFormValues(values)
    const changed = snapshotQuestionStemFormValues({
      ...values,
      tutorSourceNote: 'Updated source',
    })

    expect(isSnapshotDirty(changed, baseline)).toBe(true)
  })

  it('tolerates a question whose nested options are still registering', () => {
    const partialValues = {
      sectionId: 's1',
      categoryId: null,
      stemText: emptyDoc,
      accessScope: 'public',
      questions: [
        {
          questionText: docWithText,
          responseType: 'multiple_choice', answerScheme: 'single_choice',
          options: undefined,
        },
      ],
    } as unknown as Parameters<typeof snapshotQuestionStemFormValues>[0]

    expect(() => snapshotQuestionStemFormValues(partialValues)).not.toThrow()
  })
})

describe('mock draft snapshot', () => {
  it('treats structurally different ProseMirror instructionsText as equal when semantically same', () => {
    const baseline = snapshotMockDraft({
      name: 'Mock 1',
      accessScope: 'public',
      setIds: ['a', 'b'],
      instructionsText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Instructions' }] }],
      },
    })

    const structurallyDifferent = snapshotMockDraft({
      name: 'Mock 1',
      accessScope: 'public',
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
      accessScope: 'public',
      setIds: ['a', 'b'],
      instructionsText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Instructions' }] }],
      },
    })
    expect(isSnapshotDirty(semanticallySame, baseline)).toBe(false)
  })
})
