import { toPersistencePayload } from '@/features/ucat/questions/server/generation-persistence-payload'

function generatedQuestion() {
  return {
    index: 1,
    questionText: {},
    questionType: 'multiple_choice',
    responseType: 'multiple_choice',
    answerScheme: 'single_choice',
    options: [
      { index: 1, answerText: {}, isAnswer: true, answerKeyValue: 'correct' },
      { index: 2, answerText: {}, isAnswer: false, answerKeyValue: null },
    ],
  }
}

describe('background generation persistence', () => {
  it('emits the complete canonical response contract and answer key', () => {
    const payload = toPersistencePayload({
      sectionId: 'section-1',
      stemText: {},
      questions: [generatedQuestion()],
    })

    expect(payload).toEqual(expect.objectContaining({
      questions: [expect.objectContaining({
        response_type: 'multiple_choice',
        answer_scheme: 'single_choice',
        answer_options: [
          expect.objectContaining({ answer_key_value: 'correct' }),
          expect.objectContaining({ answer_key_value: null }),
        ],
      })],
    }))
  })

  it('fails closed before persistence when a generated answer key is omitted', () => {
    const question = generatedQuestion()
    const legacyOption: Partial<(typeof question.options)[number]> = {
      ...question.options[0],
    }
    delete legacyOption.answerKeyValue
    const secondOption = question.options[1]

    expect(() => toPersistencePayload({
      sectionId: 'section-1',
      stemText: {},
      questions: [{
        ...question,
        options: [legacyOption, secondOption],
      }],
    })).toThrow('missing a canonical answer key')
  })
})
