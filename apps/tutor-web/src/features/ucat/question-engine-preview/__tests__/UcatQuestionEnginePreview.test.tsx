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
          sectionDisplayColumns: 2,
          stemText: 'Scenario',
          questionText: 'Drag each destination.',
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

    expect(screen.getByText('Most Appropriate')).toBeInTheDocument()
    expect(screen.getByText('Least Appropriate')).toBeInTheDocument()
    const mostTarget = screen.getByLabelText('Drop an action into Most Appropriate')

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => mostTarget,
    })
    fireEvent.pointerDown(screen.getByText('Action A'), {
      pointerId: 1,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    })
    expect(mostTarget).toHaveTextContent('Action A')
  })

  it('shows the unkeyed middle action as not placed in read-only feedback', () => {
    render(
      <UcatQuestionEnginePreview
        interactive={false}
        showAnswerResults
        placementSnapshot={{ b: 'most' }}
        question={{
          id: 'most-least-review',
          sectionDisplayColumns: 1,
          stemText: 'Scenario',
          questionText: 'Review destinations.',
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
    expect(screen.getByText('Action B').closest('.bg-red-100')).not.toBeNull()
  })
})
