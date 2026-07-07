import { applyStemTypeSwitch } from '../stemEditorStemType'

describe('applyStemTypeSwitch', () => {
  it('clears the Syllogisms category when switching back to multiple choice', () => {
    const values: {
      categoryId: string | null
      questions: Array<{
        questionType: 'multiple_choice' | 'syllogism'
        questionText: { type: string; content: never[] }
        options: never[]
      }>
    } = {
      categoryId: 'syllogisms',
      questions: [
        {
          questionType: 'syllogism',
          questionText: { type: 'doc', content: [] },
          options: [],
        },
      ],
    }
    const setValue = jest.fn((path: string, value: unknown) => {
      if (path === 'categoryId') values.categoryId = value as string | null
      if (path === 'questions.0.questionType') values.questions[0]!.questionType = value as 'multiple_choice' | 'syllogism'
    })
    const form = {
      watch: (path: string) => (path === 'questions.0.questionType' ? values.questions[0]?.questionType : undefined),
      getValues: (path: string) => {
        if (path === 'questions') return values.questions
        if (path === 'categoryId') return values.categoryId
        return undefined
      },
      setValue,
    }

    const ok = applyStemTypeSwitch(
      form as never,
      'multiple_choice',
      [{ id: 'dm-section', name: 'Decision Making' }],
      [{ id: 'syllogisms', name: 'Syllogisms', ucat_section_id: 'dm-section' }]
    )

    expect(ok).toBe(true)
    expect(setValue).toHaveBeenCalledWith('questions.0.questionType', 'multiple_choice', { shouldDirty: true })
    expect(setValue).toHaveBeenCalledWith('categoryId', null, { shouldDirty: true })
  })
})
