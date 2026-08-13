import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import {
  ucatQuestionItemSchema,
  ucatQuestionStemSchema,
} from '@/features/ucat/questions/types/schema'

function emptyDoc() {
  return plainTextToProseMirror('')
}

function imageOnlyDoc() {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'image', attrs: { src: 'https://example.com/option.png' } }],
      },
    ],
  }
}

describe('ucatQuestionItemSchema', () => {
  const baseQuestion = {
    questionText: plainTextToProseMirror('Which option is correct?'),
    responseType: 'multiple_choice', answerScheme: 'single_choice' as const,
    options: [
      {
        answerText: emptyDoc(),
        answerKeyValue: 'correct',
      },
    ],
  }

  it('accepts image-only answer options', () => {
    const result = ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [
        {
          answerText: imageOnlyDoc(),
          answerKeyValue: 'correct',
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it('still rejects questions when every answer option is empty', () => {
    const result = ucatQuestionItemSchema.safeParse(baseQuestion)

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('Expected validation to fail for empty answer options.')
    }
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['options'],
          message: 'At least one answer option must have content.',
        }),
      ])
    )
  })

  it('accepts only positive whole seconds or mm:ss for expected time to correct', () => {
    expect(ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [{ answerText: plainTextToProseMirror('A'), answerKeyValue: 'correct' }],
      timeBurdenSeconds: '1:30',
    }).success).toBe(true)
    expect(ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [{ answerText: plainTextToProseMirror('A'), answerKeyValue: 'correct' }],
      timeBurdenSeconds: '90',
    }).success).toBe(true)
    expect(ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [{ answerText: plainTextToProseMirror('A'), answerKeyValue: 'correct' }],
      timeBurdenSeconds: '',
    }).success).toBe(true)
    expect(ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [{ answerText: plainTextToProseMirror('A'), answerKeyValue: 'correct' }],
      timeBurdenSeconds: '0',
    }).success).toBe(false)
    expect(ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [{ answerText: plainTextToProseMirror('A'), answerKeyValue: 'correct' }],
      timeBurdenSeconds: '1:75',
    }).success).toBe(false)
  })
})

describe('ucatQuestionStemSchema', () => {
  it('accepts an image-only shared stem', () => {
    const result = ucatQuestionStemSchema.safeParse({
      sectionId: '10000000-0000-4000-8000-000000000001',
      categoryId: null,
      stemText: imageOnlyDoc(),
      accessScope: 'public',
      questions: [{
        questionText: plainTextToProseMirror('Which sector is largest?'),
        responseType: 'multiple_choice', answerScheme: 'single_choice',
        options: [{
          answerText: plainTextToProseMirror('Services'),
          answerKeyValue: 'correct',
        }],
      }],
    })

    expect(result.success).toBe(true)
  })
})
