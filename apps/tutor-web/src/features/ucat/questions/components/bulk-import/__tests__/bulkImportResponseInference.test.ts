import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  applyBulkAnswersToStems,
  validateBulkAnswersDocument,
} from '../bulkImportBulkAnswers'

function doc(value: string): Json {
  return {
    type: 'doc',
    content: value.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  }
}

function values(questionText: string, optionCount: number): UcatQuestionStemFormValues {
  return {
    sectionId: '11111111-1111-4111-8111-111111111111',
    categoryId: null,
    stemText: doc('Source material.'),
    accessScope: 'public',
    questions: [{
      questionText: doc(questionText),
       responseType: 'multiple_choice',
      answerScheme: 'single_choice',
      answerExplanation: null,
      difficulty: null,
      timeBurdenSeconds: '',
      tagIds: [],
      options: Array.from({ length: optionCount }, (_, index) => ({
        answerText: doc(`Option ${index + 1}`),
        answerExplanation: null,
        answerKeyValue: null,
      })),
    }],
  }
}

describe('bulk import response inference', () => {
  it('applies five-token Yes/No evidence without a preselected legacy type', () => {
    const stem = {
      id: 'stem-1',
      values: values(
        "Place 'Yes' if the conclusion follows. Place 'No' if it does not follow.",
        5,
      ),
    }
    const update = jest.fn()

    applyBulkAnswersToStems(doc('Y N N Y N'), [stem], true, update)

    expect(update).toHaveBeenCalledWith(
      'stem-1',
      expect.objectContaining({
        questions: [expect.objectContaining({
          responseType: 'drag_and_drop',
          answerScheme: 'decision_making_binary_placement',
          options: expect.arrayContaining([
            expect.objectContaining({ answerKeyValue: 'yes' }),
            expect.objectContaining({ answerKeyValue: 'no' }),
          ]),
        })],
      }),
    )
  })

  it('applies labelled Most/Least keys independently of category', () => {
    const stem = {
      id: 'stem-1',
      values: values(
        'Choose the most appropriate action and the least appropriate action.',
        3,
      ),
    }
    const update = jest.fn()

    applyBulkAnswersToStems(doc('Most: B\tLeast: C'), [stem], false, update)

    const updated = update.mock.calls[0]?.[1] as UcatQuestionStemFormValues
    expect(updated.questions[0]).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'situational_judgement_most_least',
    })
    expect(updated.questions[0]?.options.map((option) => option.answerKeyValue)).toEqual([
      null,
      'most',
      'least',
    ])
  })

  it('blocks invalid answer letters instead of defaulting to option A', () => {
    const stem = { id: 'stem-1', values: values('Which option is correct?', 4) }
    const update = jest.fn()

    expect(validateBulkAnswersDocument(doc('F'), [stem], false)).toEqual({
      ok: false,
      message: 'Answer evidence conflicts: invalid_answer_letter.',
    })
    applyBulkAnswersToStems(doc('F'), [stem], false, update)
    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    ['E', 'Which option is correct?', 4],
    ['Most: B\tLeast: E', 'Choose the most appropriate action and the least appropriate action.', 3],
  ])('blocks keys outside the target option range: %s', (answer, questionText, optionCount) => {
    const stem = { id: 'stem-1', values: values(questionText, optionCount) }

    expect(validateBulkAnswersDocument(doc(answer), [stem], false)).toEqual({
      ok: false,
      message: 'Answer evidence does not fit the target question options.',
    })
  })
})
