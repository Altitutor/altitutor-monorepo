import { getSituationalJudgementStemCategoryName } from '../situationalJudgement'

describe('getSituationalJudgementStemCategoryName', () => {
  it('returns canonical category labels for Situational Judgement question wording', () => {
    expect(
      getSituationalJudgementStemCategoryName({
        stemText: 'A student is asked to help on a ward.',
        questions: [
          {
            number: 1,
            text: 'How appropriate is it to ask a senior colleague for advice?',
            options: [],
          },
        ],
      })
    ).toBe('How Appropriate')

    expect(
      getSituationalJudgementStemCategoryName({
        stemText: 'A patient raises a safety concern.',
        questions: [
          {
            number: 1,
            text: 'How important is it to document the concern promptly?',
            options: [],
          },
        ],
      })
    ).toBe('How Important')
  })

  it('detects category wording from the parsed stem prompt', () => {
    expect(
      getSituationalJudgementStemCategoryName({
        stemText:
          'A student is on clinical placement. How appropriate are each of these responses to the situation?',
        questions: [
          {
            number: 1,
            text: 'Speak to the supervisor privately.',
            options: [],
          },
        ],
      })
    ).toBe('How Appropriate')
  })
})
