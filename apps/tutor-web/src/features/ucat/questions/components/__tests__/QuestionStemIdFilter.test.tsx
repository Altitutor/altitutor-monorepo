import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QuestionStemIdFilter } from '@/features/ucat/questions/components/QuestionStemIdFilter'

jest.mock('@altitutor/ui', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}))

describe('QuestionStemIdFilter', () => {
  it('emits all valid pasted IDs immediately without an Apply action', () => {
    const onChange = jest.fn()
    render(<QuestionStemIdFilter ids={[]} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Question stem IDs'), {
      target: {
        value: [
          '10000000-0000-4000-8000-000000000001',
          '10000000-0000-4000-8000-000000000002',
        ].join(', '),
      },
    })

    expect(onChange).toHaveBeenLastCalledWith([
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
    ])
  })
})
