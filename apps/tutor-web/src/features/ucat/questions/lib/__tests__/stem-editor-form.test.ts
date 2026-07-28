import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { persistStemFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { snapshotQuestionStemFormValues } from '@/features/ucat/shared/lib/dirty-state'

function formValues(status: 'in_review' | 'published'): UcatQuestionStemFormValues {
  return {
    sectionId: '5286dbd1-aa7e-40da-b330-823347292f01',
    categoryId: '01f44d22-345e-806c-a3c1-c05665d6a1dc',
    stemText: plainTextToProseMirror('Shared stem'),
    accessScope: 'public',
    status,
    questions: [
      {
        questionText: plainTextToProseMirror('Which option is correct?'),
        questionType: 'multiple_choice',
        answerExplanation: plainTextToProseMirror('Option A is correct.'),
        tagIds: [],
        options: [
          {
            answerText: plainTextToProseMirror('Option A'),
            answerExplanation: null,
            isAnswer: true,
          },
          {
            answerText: plainTextToProseMirror('Option B'),
            answerExplanation: null,
            isAnswer: false,
          },
        ],
      },
    ],
  }
}

describe('persistStemFormValues', () => {
  it('publishes unchanged saved content without rewriting the stem bundle', async () => {
    const baseline = formValues('in_review')
    const published = formValues('published')
    const updateStem = jest.fn().mockResolvedValue(undefined)
    const setStatus = jest.fn().mockResolvedValue(undefined)

    await persistStemFormValues('01f44d22-345e-806c-a3c1-c05665d6a1dc', published, {
      baselineSnapshot: snapshotQuestionStemFormValues(baseline),
      updateStem,
      setStatus,
    })

    expect(updateStem).not.toHaveBeenCalled()
    expect(setStatus).toHaveBeenCalledWith('published')
  })
})
