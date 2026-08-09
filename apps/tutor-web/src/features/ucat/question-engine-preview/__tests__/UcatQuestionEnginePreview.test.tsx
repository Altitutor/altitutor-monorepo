import React from 'react'
import { render, screen } from '@testing-library/react'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'

jest.mock('@/features/ucat/question-engine-preview/UcatRichContentBlock', () => ({
  UcatRichContentBlock: ({ plainText }: { plainText?: string }) => plainText ?? null,
}))

describe('UcatQuestionEnginePreview', () => {
  it('previews the authored Most/Least physical placement surface', () => {
    render(
      <UcatQuestionEnginePreview
        question={{
          id: 'most-least-preview',
          sectionDisplayColumns: 1,
          stemText: 'Scenario',
          questionText: 'Drag each destination.',
          questionType: 'multiple_choice',
          responseType: 'drag_and_drop',
          answerScheme: 'situational_judgement_most_least',
          options: [
            { id: 'a', index: 0, text: 'Action A', answerKeyValue: 'most' },
            { id: 'b', index: 1, text: 'Action B', answerKeyValue: null },
            { id: 'c', index: 2, text: 'Action C', answerKeyValue: 'least' },
          ],
        }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Most Appropriate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Least Appropriate' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Drop Most Appropriate or Least Appropriate here')).toHaveLength(3)
  })
})
