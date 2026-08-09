import {
  parseAttemptContentSnapshot,
  projectAttemptReview,
  resultForAttempt,
  snapshotToReviewQuestion,
} from '../attempt-content-snapshot'

describe('legacy tutor attempt snapshots', () => {
  it('infers the Decision Making contract before scoring and review', () => {
    const snapshot = parseAttemptContentSnapshot({
      schemaVersion: 1,
      stem: { id: 'stem-1', stemText: 'Legacy stem' },
      question: {
        id: 'question-1',
        questionText: 'Which conclusions follow?',
        index: 0,
        questionType: 'syllogism',
      },
      answerOptions: Array.from({ length: 5 }, (_, index) => ({
        id: `option-${index + 1}`,
        index,
        answerText: `Conclusion ${index + 1}`,
        isAnswer: index < 3,
      })),
    })

    expect(snapshot?.question).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    })
    if (!snapshot) throw new Error('Expected a valid legacy snapshot')

    expect(resultForAttempt(1, snapshot.question.answerScheme, true)).toBe(
      'partial'
    )

    const review = projectAttemptReview({
      question: snapshotToReviewQuestion(snapshot, 1, 'set-1'),
      binaryPlacements: {
        'option-1': true,
        'option-2': true,
        'option-3': true,
        'option-4': false,
        'option-5': true,
      },
    })

    expect(review).toMatchObject({
      kind: 'placement',
      outcome: 'partial',
    })
    if (review.kind !== 'placement') throw new Error('Expected placement review')
    expect(review.rows).toHaveLength(5)
  })
})
