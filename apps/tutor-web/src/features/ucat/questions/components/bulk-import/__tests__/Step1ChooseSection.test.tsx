import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { UcatSection } from '@/features/ucat/shared/types'
import { Step1ChooseSection } from '../Step1ChooseSection'

jest.mock('@altitutor/ui', () => ({
  SearchableSelect: ({
    ariaLabel,
    open,
    onOpenChange,
    onValueChange,
  }: {
    ariaLabel?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onValueChange?: (item: { value: 'separate' }) => void
  }) => (
    <button
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-controls="section-options"
      aria-expanded={open ?? false}
      onClick={() => {
        if (ariaLabel === 'Document layout') {
          onValueChange?.({ value: 'separate' })
        } else {
          onOpenChange?.(true)
        }
      }}
    >
      {ariaLabel === 'Document layout' ? 'Combined document' : 'Select a section'}
    </button>
  ),
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

const sections = [
  { id: 'vr', name: 'Verbal Reasoning' },
  { id: 'dm', name: 'Decision Making' },
  { id: 'qr', name: 'Quantitative Reasoning' },
  { id: 'sjt', name: 'Situational Judgement' },
] as unknown as UcatSection[]

describe('Step1ChooseSection', () => {
  it('selects sections 1–4 by number while the section menu is open', () => {
    const onChangeSection = jest.fn()

    render(
      <Step1ChooseSection
        sectionId={null}
        sections={sections}
        onChangeSection={onChangeSection}
        separateStemDocument={false}
        onSeparateStemDocumentChange={jest.fn()}
        tutorSourceNote=""
        onTutorSourceNoteChange={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Section' }))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: '3' })

    expect(onChangeSection).toHaveBeenCalledWith('qr')
  })

  it('uses a searchable select for the document layout option', () => {
    const onSeparateStemDocumentChange = jest.fn()

    render(
      <Step1ChooseSection
        sectionId={null}
        sections={sections}
        onChangeSection={jest.fn()}
        separateStemDocument={false}
        onSeparateStemDocumentChange={onSeparateStemDocumentChange}
        tutorSourceNote=""
        onTutorSourceNoteChange={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Document layout' }))

    expect(onSeparateStemDocumentChange).toHaveBeenCalledWith(true)
  })
})
