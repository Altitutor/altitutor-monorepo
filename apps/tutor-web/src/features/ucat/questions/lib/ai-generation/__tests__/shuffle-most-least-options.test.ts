import {
  shuffleGeneratedStemMostLeastOptions,
  shuffleWithSeed,
} from '../shuffle-most-least-options'
import type { GeneratedStem } from '../schema'

function mostLeastStem(options: GeneratedStem['questions'][number]['options']): GeneratedStem {
  return {
    stemText: 'Scenario text',
    categoryName: 'Most/Least Appropriate',
    warnings: [],
    questions: [{
      questionText: 'Place the most and least appropriate actions.',
      responseType: 'drag_and_drop',
      answerScheme: 'situational_judgement_most_least',
      answerExplanation: 'Most is best; least is worst.',
      tagIds: [],
      options,
    }],
  }
}

describe('shuffleWithSeed', () => {
  it('is deterministic for the same seed', () => {
    const items = ['a', 'b', 'c']
    expect(shuffleWithSeed(items, 'seed-1')).toEqual(shuffleWithSeed(items, 'seed-1'))
  })

  it('produces different orders for different seeds', () => {
    const items = ['most', 'neutral', 'least']
    const first = shuffleWithSeed(items, 'seed-a').join(',')
    const second = shuffleWithSeed(items, 'seed-b').join(',')
    expect(first).not.toBe(second)
  })
})

describe('shuffleGeneratedStemMostLeastOptions', () => {
  it('reorders Most/Least actions while keeping keys attached', () => {
    const stem = mostLeastStem([
      { answerText: 'Most action', answerKeyValue: 'most', answerExplanation: null },
      { answerText: 'Neutral action', answerKeyValue: null, answerExplanation: null },
      { answerText: 'Least action', answerKeyValue: 'least', answerExplanation: null },
    ])

    const shuffled = shuffleGeneratedStemMostLeastOptions(stem, 'run:stem:0')
    const options = shuffled.questions[0]!.options

    expect(options.map((option) => option.answerText)).not.toEqual([
      'Most action',
      'Neutral action',
      'Least action',
    ])
    expect(options.find((option) => option.answerKeyValue === 'most')?.answerText).toBe('Most action')
    expect(options.find((option) => option.answerKeyValue === 'least')?.answerText).toBe('Least action')
    expect(options.find((option) => option.answerKeyValue === null)?.answerText).toBe('Neutral action')
  })

  it('varies order across stem indexes in the same run', () => {
    const stem = mostLeastStem([
      { answerText: 'Most action', answerKeyValue: 'most', answerExplanation: null },
      { answerText: 'Neutral action', answerKeyValue: null, answerExplanation: null },
      { answerText: 'Least action', answerKeyValue: 'least', answerExplanation: null },
    ])

    const first = shuffleGeneratedStemMostLeastOptions(stem, 'run:stem:0').questions[0]!.options
    const second = shuffleGeneratedStemMostLeastOptions(stem, 'run:stem:1').questions[0]!.options

    expect(first.map((option) => option.answerText)).not.toEqual(
      second.map((option) => option.answerText),
    )
  })

  it('leaves non-Most/Least questions unchanged', () => {
    const stem: GeneratedStem = {
      stemText: 'Scenario',
      warnings: [],
      questions: [{
        questionText: 'How appropriate is this?',
        responseType: 'multiple_choice',
        answerScheme: 'situational_judgement_rating',
        answerExplanation: 'Because...',
        tagIds: [],
        options: [
          { answerText: 'A very appropriate thing to do', answerKeyValue: 'correct', answerExplanation: null },
          { answerText: 'Appropriate, but not ideal', answerKeyValue: null, answerExplanation: null },
          { answerText: 'Inappropriate, but not awful', answerKeyValue: null, answerExplanation: null },
          { answerText: 'A very inappropriate thing to do', answerKeyValue: null, answerExplanation: null },
        ],
      }],
    }

    expect(shuffleGeneratedStemMostLeastOptions(stem, 'run:stem:0')).toEqual(stem)
  })
})
