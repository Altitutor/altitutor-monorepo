import type {
  CandidateResponse,
  ResponseDefinition,
} from '@altitutor/ucat-response-contract'
import {
  computeMaxRawScore,
  computeRawScore,
  type ScoringQuestion,
} from '../index'

function question(
  definition: ResponseDefinition,
  sectionName = 'Decision Making'
): ScoringQuestion {
  return { definition, sectionName }
}

const singleChoice = question({
  questionId: 'single-choice',
  responseType: 'multiple_choice',
  answerScheme: { kind: 'single_choice', correctOptionId: 'b' },
  options: [
    { id: 'a', index: 0 },
    { id: 'b', index: 1 },
  ],
})

const sjRating = question(
  {
    questionId: 'sj-rating',
    responseType: 'multiple_choice',
    answerScheme: {
      kind: 'situational_judgement_rating',
      correctOptionId: 'appropriate',
    },
    options: [
      { id: 'very-appropriate', index: 0 },
      { id: 'appropriate', index: 1 },
      { id: 'inappropriate', index: 2 },
      { id: 'very-inappropriate', index: 3 },
    ],
  },
  'Situational Judgement'
)

const dmBinary = question({
  questionId: 'dm-binary',
  responseType: 'drag_and_drop',
  answerScheme: {
    kind: 'decision_making_binary_placement',
    correctByOptionId: {
      one: 'yes',
      two: 'no',
      three: 'yes',
      four: 'no',
      five: 'yes',
    },
  },
  options: ['one', 'two', 'three', 'four', 'five'].map((id, index) => ({
    id,
    index,
  })),
})

const sjMostLeast = question(
  {
    questionId: 'sj-most-least',
    responseType: 'drag_and_drop',
    answerScheme: {
      kind: 'situational_judgement_most_least',
      mostAppropriateOptionId: 'action-a',
      leastAppropriateOptionId: 'action-c',
    },
    options: ['action-a', 'action-b', 'action-c'].map((id, index) => ({
      id,
      index,
    })),
  },
  'Situational Judgement'
)

describe('UCAT raw scoring', () => {
  it('matches the accepted golden outcomes through Answer schemes', () => {
    const responses = new Map<string, CandidateResponse>([
      [
        'single-choice',
        { kind: 'single_select', selectedOptionId: 'b' },
      ],
      [
        'sj-rating',
        { kind: 'single_select', selectedOptionId: 'very-appropriate' },
      ],
      [
        'dm-binary',
        {
          kind: 'placement',
          placements: {
            one: 'yes',
            two: 'no',
            three: 'yes',
            four: 'yes',
            five: 'no',
          },
        },
      ],
    ])

    expect(
      computeRawScore({
        questions: [singleChoice, sjRating, dmBinary],
        responses,
      })
    ).toEqual({
      questionScores: new Map([
        ['single-choice', 1],
        ['sj-rating', 0.5],
        ['dm-binary', 1],
      ]),
      totalRawScore: 2.5,
      maximumRawScore: 4,
      reviews: expect.any(Map),
    })
  })

  it('derives every denominator from the Answer scheme', () => {
    expect(computeMaxRawScore([singleChoice, sjRating, dmBinary])).toBe(4)
  })

  it('applies the isolated provisional 4/2/0 policy per Most/Least destination', () => {
    const scored = computeRawScore({
      questions: [sjMostLeast],
      responses: new Map([
        [
          'sj-most-least',
          {
            kind: 'placement',
            placements: { 'action-a': 'most', 'action-b': 'least' },
          },
        ],
      ]),
    })

    expect(scored.questionScores.get('sj-most-least')).toBe(6)
    expect(scored.maximumRawScore).toBe(8)
    expect(scored.reviews.get('sj-most-least')).toEqual(
      expect.objectContaining({ kind: 'placement', outcome: 'partial' })
    )
  })

  it('rejects an invalid response contract instead of guessing from category', () => {
    expect(() =>
      computeMaxRawScore([
        question({
          questionId: 'invalid',
          responseType: 'multiple_choice',
          answerScheme: {
            kind: 'decision_making_binary_placement',
            correctByOptionId: {},
          },
          options: [],
        }),
      ])
    ).toThrow('The Response type is incompatible with the Answer scheme.')
  })
})
