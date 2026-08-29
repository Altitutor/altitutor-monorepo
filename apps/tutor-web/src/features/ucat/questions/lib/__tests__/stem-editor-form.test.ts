import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  formValuesToStemBundlePayload,
  persistStemFormValues,
  stemDetailToFormValues,
} from '@/features/ucat/questions/lib/stem-editor-form'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { snapshotQuestionStemFormValues } from '@/features/ucat/shared/lib/dirty-state'
import { ucatQuestionStemSchema } from '@/features/ucat/questions/types/schema'

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
         responseType: 'multiple_choice',
        answerScheme: 'single_choice',
        answerExplanation: plainTextToProseMirror('Option A is correct.'),
        tagIds: [],
        options: [
          {
            answerText: plainTextToProseMirror('Option A'),
            answerExplanation: null,
            answerKeyValue: 'correct',
          },
          {
            answerText: plainTextToProseMirror('Option B'),
            answerExplanation: null,
            answerKeyValue: null,
          },
        ],
      },
    ],
  }
}

describe('persistStemFormValues', () => {
  it('enforces the authored question cardinality for both SJT schemes', () => {
    const mostLeast = formValues('in_review')
    mostLeast.questions = [
      {
        ...mostLeast.questions[0]!,
        responseType: 'drag_and_drop',
        answerScheme: 'situational_judgement_most_least',
      },
      { ...mostLeast.questions[0]! },
    ]
    expect(ucatQuestionStemSchema.safeParse(mostLeast)).toEqual(
      expect.objectContaining({ success: false }),
    )

    const rating = formValues('in_review')
    rating.questions = Array.from({ length: 7 }, () => ({
      ...rating.questions[0]!,
      answerScheme: 'situational_judgement_rating' as const,
    }))
    expect(ucatQuestionStemSchema.safeParse(rating)).toEqual(
      expect.objectContaining({ success: false }),
    )
    rating.questions.pop()
    expect(ucatQuestionStemSchema.safeParse(rating).success).toBe(true)
  })

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

  it('restores and serializes the canonical response contract without deriving it from category', () => {
    const values = stemDetailToFormValues({
      id: '01f44d22-345e-806c-a3c1-c05665d6a1dc',
      section_id: '5286dbd1-aa7e-40da-b330-823347292f01',
      section_name: 'Decision Making',
      section_number: 2,
      display_columns: 2,
      question_stem_category_id: '11111111-1111-4111-8111-111111111111',
      category_name: 'Interpreting Information and Drawing Conclusions',
      status: 'draft',
      access_scope: 'public',
      stem_text: plainTextToProseMirror('Data presentation'),
      questions: [{
        id: '22222222-2222-4222-8222-222222222222',
        question_text: plainTextToProseMirror('Place Yes or No.'),
        answer_explanation: null,
        index: 1,
        difficulty: null,
        time_burden_seconds: null,
        response_type: 'drag_and_drop',
        answer_scheme: 'decision_making_binary_placement',
        answer_options: Array.from({ length: 5 }, (_, index) => ({
          id: `30000000-0000-4000-8000-00000000000${index}`,
          answer_text: plainTextToProseMirror(`Statement ${index + 1}`),
          answer_explanation: null,
          index: index + 1,
          answer_key_value: index < 2 ? 'yes' : 'no',
        })),
      }],
    })

    expect(values.questions[0]).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    })
    expect(values.questions[0]?.options.map((option) => option.answerKeyValue)).toEqual([
      'yes', 'yes', 'no', 'no', 'no',
    ])

    const payload = formValuesToStemBundlePayload(values)
    expect(payload.questions[0]).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    })
    expect(payload.questions[0]?.options.map((option) => option.answerKeyValue)).toEqual([
      'yes', 'yes', 'no', 'no', 'no',
    ])
  })

  it('still builds form questions with options when a deleted stem has no live nested rows', () => {
    const values = stemDetailToFormValues({
      id: '0107f6e0-2751-45fd-9b7a-89f0d5e4d9ae',
      section_id: '5286dbd1-aa7e-40da-b330-823347292f01',
      section_name: 'Decision Making',
      section_number: 2,
      display_columns: 1,
      question_stem_category_id: null,
      category_name: null,
      status: 'draft',
      access_scope: 'public',
      stem_text: plainTextToProseMirror(
        'Should a prime minister require political experience before leading the country?',
      ),
      questions: null as never,
    })

    expect(values.questions).toHaveLength(1)
    expect(values.questions[0]?.options.length).toBeGreaterThan(0)
  })

  it('preserves an unkeyed Most/Least action', () => {
    const values = formValues('in_review')
    const question = values.questions[0]!
    question.responseType = 'drag_and_drop'
    question.answerScheme = 'situational_judgement_most_least'
    question.options = ['most', 'least', null].map((answerKeyValue, index) => ({
      answerText: plainTextToProseMirror(`Action ${index + 1}`),
      answerExplanation: null,
      answerKeyValue: answerKeyValue as 'most' | 'least' | null,
    }))

    const payload = formValuesToStemBundlePayload(values)

    expect(payload.questions[0]?.options.map((option) => option.answerKeyValue)).toEqual([
      'most', 'least', null,
    ])
  })
})
