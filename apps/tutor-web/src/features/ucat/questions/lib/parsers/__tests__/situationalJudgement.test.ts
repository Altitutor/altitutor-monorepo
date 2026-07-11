import {
  getSituationalJudgementStemCategoryName,
  getSituationalJudgementTagPathsForQuestion,
} from '../situationalJudgement'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'

function stem(overrides: Partial<ParsedStem>): ParsedStem {
  return {
    stemText: '',
    questions: [],
    ...overrides,
  }
}

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

describe('Situational Judgement metadata detection', () => {
  it('detects practical safety and ethics principle tag paths', () => {
    const parsedStem = stem({
      stemText:
        'Arran becomes ill with tonsillitis before a rare surgical procedure. His illness could put the patient in the surgery at risk.',
      questions: [
        {
          number: 1,
          text: 'His illness could put the patient in the surgery at risk.',
          options: [{ label: 'A', text: 'Very important' }],
        },
      ],
    })

    expect(
      getSituationalJudgementTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual(expect.arrayContaining([
      ['Patient welfare and safety', 'Patient safety'],
      ['Patient welfare and safety', 'Infection risk'],
      ['Ethical principles', 'Non-maleficence'],
    ]))
  })

  it('detects confidentiality as practical conduct and an ethical principle', () => {
    const parsedStem = stem({
      stemText:
        'Damion realises that Phillipa has accidentally been revealing patient data to some of her peers.',
      questions: [
        {
          number: 1,
          text: 'The breach of patient confidentiality by Phillipa.',
          options: [{ label: 'A', text: 'Very important' }],
        },
      ],
    })

    expect(
      getSituationalJudgementTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual(expect.arrayContaining([
      ['Professional conduct', 'Confidentiality'],
      ['Ethical principles', 'Confidentiality'],
    ]))
  })

  it('detects workload and career-opportunity judgement', () => {
    const parsedStem = stem({
      stemText:
        'Jamal has undertaken an additional project that will add value to him and help develop his experimental technique, but the final submission is two weeks before his medical school exams.',
      questions: [
        {
          number: 1,
          text: 'Continue with the project and fit preparation for his medical exams into the two weeks after the project submission deadline.',
          options: [{ label: 'A', text: 'Appropriate but not ideal' }],
        },
      ],
    })

    expect(
      getSituationalJudgementTagPathsForQuestion({
        stem: parsedStem,
        question: parsedStem.questions[0]!,
      })
    ).toEqual(expect.arrayContaining([
      ['Personal judgement', 'Workload and prioritisation'],
      ['Personal judgement', 'Career opportunity vs responsibility'],
    ]))
  })
})
