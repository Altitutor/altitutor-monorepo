import {
  getSituationalJudgementStemCategoryName,
  getSituationalJudgementTagPathsForQuestion,
  mapParsedSituationalJudgementToFormValues,
  parseSituationalJudgementFromDoc,
} from '../situationalJudgement'
import type { ParsedStem } from '@/features/ucat/questions/lib/parsers/core'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

function stem(overrides: Partial<ParsedStem>): ParsedStem {
  return {
    stemText: '',
    questions: [],
    ...overrides,
  }
}

describe('mapParsedSituationalJudgementToFormValues line breaks', () => {
  it('preserves soft line breaks (hardBreak) inside stem paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Arran becomes ill with tonsillitis.' },
            { type: 'hardBreak' },
            { type: 'text', text: 'His illness could put the patient at risk.' },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '1. How important is the following consideration?' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'A. Very important' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'B. Important' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'C. Of minor importance' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'D. Not important at all' }] },
      ],
    }

    const stems = parseSituationalJudgementFromDoc(doc)
    expect(stems[0]?.stemText).toBe(
      'Arran becomes ill with tonsillitis.\nHis illness could put the patient at risk.'
    )

    const forms = mapParsedSituationalJudgementToFormValues(stems, { sectionId: 'sj' })
    expect(proseMirrorToPlainText(forms[0]?.stemText)).toBe(
      'Arran becomes ill with tonsillitis.\nHis illness could put the patient at risk.'
    )
    expect((forms[0]?.stemText as { content?: unknown[] })?.content).toHaveLength(2)
  })

  it('preserves multi-paragraph question text as separate paragraphs', () => {
    const forms = mapParsedSituationalJudgementToFormValues(
      [
        {
          stemText: 'A student is asked to help on a ward.',
          questions: [
            {
              number: 1,
              text: 'How appropriate is the following response?\nSpeak to the supervisor privately.',
              options: [
                { label: 'A', text: 'Very appropriate' },
                { label: 'B', text: 'Appropriate but not ideal' },
                { label: 'C', text: 'Inappropriate but not awful' },
                { label: 'D', text: 'Very inappropriate' },
              ],
            },
          ],
        },
      ],
      { sectionId: 'sj' }
    )

    expect(proseMirrorToPlainText(forms[0]?.questions[0]?.questionText)).toBe(
      'How appropriate is the following response?\nSpeak to the supervisor privately.'
    )
    expect(
      (forms[0]?.questions[0]?.questionText as { content?: unknown[] })?.content
    ).toHaveLength(2)
  })
})

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

  it('detects category from How Important option scale when prompt wording is missing', () => {
    expect(
      getSituationalJudgementStemCategoryName({
        stemText: 'Andrew notices a classmate using a phone during clinic.',
        questions: [
          {
            number: 1,
            text: 'Whether patients can see the phone.',
            options: [
              { label: 'A', text: 'Very important' },
              { label: 'B', text: 'Important' },
              { label: 'C', text: 'Of minor importance' },
              { label: 'D', text: 'Not important at all' },
            ],
          },
        ],
      })
    ).toBe('How Important')
  })

  it('detects How Appropriate from prompt wording with irregular spacing', () => {
    expect(
      getSituationalJudgementStemCategoryName({
        stemText:
          'Sophie is a junior doctor.\nHow  appropriate are each of the following responses by Sophie in this situation?',
        questions: [
          {
            number: 1,
            text: 'Calling hospital security.',
            options: [
              { label: 'A', text: 'A very appropriate thing to do.' },
              { label: 'B', text: 'Appropriate but not ideal' },
            ],
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
