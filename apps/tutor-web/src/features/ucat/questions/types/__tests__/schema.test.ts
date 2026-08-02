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
    questionType: 'multiple_choice' as const,
    options: [
      {
        answerText: emptyDoc(),
        isAnswer: true,
      },
    ],
  }

  it('accepts image-only answer options', () => {
    const result = ucatQuestionItemSchema.safeParse({
      ...baseQuestion,
      options: [
        {
          answerText: imageOnlyDoc(),
          isAnswer: true,
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
        questionType: 'multiple_choice',
        options: [{
          answerText: plainTextToProseMirror('Services'),
          isAnswer: true,
        }],
      }],
    })

    expect(result.success).toBe(true)
  })
})
