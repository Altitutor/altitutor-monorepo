import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { ucatQuestionItemSchema } from '@/features/ucat/questions/types/schema'

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
