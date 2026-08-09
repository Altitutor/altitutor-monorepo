import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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
    const targets = screen.getAllByLabelText('Drop Most Appropriate or Least Appropriate here')
    expect(targets).toHaveLength(3)

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => targets[0],
    })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Most Appropriate' }), {
      pointerId: 1,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    })
    expect(targets[0]).toHaveTextContent('Most Appropriate')
  })

  it('shows the unkeyed middle action as not placed in read-only feedback', () => {
    render(
      <UcatQuestionEnginePreview
        interactive={false}
        showAnswerResults
        syllogismSnapshot={{ b: true }}
        question={{
          id: 'most-least-review',
          sectionDisplayColumns: 1,
          stemText: 'Scenario',
          questionText: 'Review destinations.',
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

    expect(screen.getByText('Correct answer: Not placed')).toBeInTheDocument()
  })
})
