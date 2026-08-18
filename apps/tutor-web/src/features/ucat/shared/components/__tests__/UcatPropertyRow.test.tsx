import React from 'react'
import { render, screen } from '@testing-library/react'
import { UcatPropertyRow } from '../UcatPropertyRow'

describe('UcatPropertyRow', () => {
  it('keeps labels and values in consistent fixed and flexible columns', () => {
    render(
      <UcatPropertyRow label="Section">
        <button type="button">Verbal Reasoning</button>
      </UcatPropertyRow>,
    )

    const label = screen.getByText('Section')
    const value = screen.getByRole('button', { name: 'Verbal Reasoning' })
    const row = label.parentElement

    expect(row).toHaveClass('grid', 'grid-cols-[7rem_minmax(0,1fr)]')
    expect(value.parentElement).toHaveClass('min-w-0')
  })
})
