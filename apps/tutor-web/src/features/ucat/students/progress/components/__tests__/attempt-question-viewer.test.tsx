import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { AttemptQuestionViewer } from '../attempt-question-viewer'

jest.mock('@/features/ucat/question-engine-preview/UcatRichContentBlock', () => ({
  UcatRichContentBlock: ({ plainText }: { plainText?: string }) => plainText ?? null,
}))

jest.mock('@/shared/utils', () => ({
  cn: (...values: unknown[]) => values.filter((value) => typeof value === 'string').join(' '),
}))

describe('AttemptQuestionViewer', () => {
  it('reviews Most/Least by destination, matching the answering interaction', () => {
    render(
      <AttemptQuestionViewer
        question={{
          id: 'most-least',
          stemId: 'stem-most-least',
          questionSetId: 'set-most-least',
          sectionDisplayColumns: 1,
          stemText: 'Scenario',
          questionText: 'Choose Most and Least.',
          questionType: 'multiple_choice',
          responseType: 'drag_and_drop',
          answerScheme: 'situational_judgement_most_least',
          options: [
            { id: 'a', index: 0, text: 'Action A', answerKeyValue: 'most' },
            { id: 'b', index: 1, text: 'Action B', answerKeyValue: null },
            { id: 'c', index: 2, text: 'Action C', answerKeyValue: 'least' },
          ],
        }}
        legacyPlacementSnapshot={{ a: false, c: true }}
      />
    )

    const mostRow = screen.getByTestId('placement-destination-most')
    expect(within(mostRow).getByText('Most Appropriate')).toBeInTheDocument()
    expect(within(mostRow).getByText('Action C')).toBeInTheDocument()
    expect(within(mostRow).getByText('Action A')).toBeInTheDocument()

    const leastRow = screen.getByTestId('placement-destination-least')
    expect(within(leastRow).getByText('Least Appropriate')).toBeInTheDocument()
    expect(within(leastRow).getByText('Action A')).toBeInTheDocument()
    expect(within(leastRow).getByText('Action C')).toBeInTheDocument()

    const unplacedRow = screen.getByTestId('placement-destination-not-placed')
    expect(within(unplacedRow).getByText('Not placed')).toBeInTheDocument()
    expect(within(unplacedRow).getAllByText('Action B')).toHaveLength(2)
  })
})
