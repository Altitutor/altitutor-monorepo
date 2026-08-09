import {
  parseAttemptContentSnapshot,
  parseLegacyPlacementProjection,
  projectAttemptReview,
  resultForAttempt,
  snapshotToReviewQuestion,
  type AttemptReviewQuestion,
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
      legacyPlacementSnapshot: {
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

  it('projects Most/Least placements with their canonical tokens', () => {
    const question: AttemptReviewQuestion = {
      id: 'most-least',
      stemId: 'stem-most-least',
      questionSetId: 'set-most-least',
      sectionDisplayColumns: 1,
      stemText: 'Scenario',
      questionText: 'Choose Most and Least.',
      questionType: 'multiple_choice',
      responseType: 'drag_and_drop',
      answerScheme: 'situational_judgement_most_least',
      options: [
        { id: 'a', index: 0, text: 'Action A', answerKeyValue: 'most' },
        { id: 'b', index: 1, text: 'Action B', answerKeyValue: null },
        { id: 'c', index: 2, text: 'Action C', answerKeyValue: 'least' },
      ],
    }

    const persistedProjection = parseLegacyPlacementProjection({
      type: 'ucat_response_v1',
      questionId: 'most-least',
      answerScheme: 'situational_judgement_most_least',
      response: {
        kind: 'placement',
        placements: { a: 'most', c: 'least' },
      },
    })
    expect(persistedProjection).toEqual({ a: true, c: false })

    expect(projectAttemptReview({
      question,
      legacyPlacementSnapshot: persistedProjection,
    })).toMatchObject({
      kind: 'placement',
      outcome: 'correct',
      rows: [
        { targetId: 'a', placedToken: 'most', correctToken: 'most' },
        { targetId: 'b', placedToken: null, correctToken: null },
        { targetId: 'c', placedToken: 'least', correctToken: 'least' },
      ],
    })
  })
})
