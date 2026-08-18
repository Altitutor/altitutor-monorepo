'use client'

import React, { useEffect, useState } from 'react'
import { SearchableSelect, Textarea } from '@altitutor/ui'
import type { UcatSection } from '@/features/ucat/shared/types'
import { UcatPropertyRow } from '@/features/ucat/shared/components/UcatPropertyRow'

type StemDocumentOption = {
  value: 'combined' | 'separate'
  label: string
}

const STEM_DOCUMENT_OPTIONS: StemDocumentOption[] = [
  { value: 'combined', label: 'Combined document' },
  { value: 'separate', label: 'Separate documents' },
]

type Step1ChooseSectionProps = {
  sectionId: string | null
  sections: UcatSection[]
  onChangeSection: (sectionId: string) => void
  separateStemDocument: boolean
  onSeparateStemDocumentChange: (value: boolean) => void
  tutorSourceNote: string
  onTutorSourceNoteChange: (value: string) => void
}

export function Step1ChooseSection({
  sectionId,
  sections,
  onChangeSection,
  separateStemDocument,
  onSeparateStemDocumentChange,
  tutorSourceNote,
  onTutorSourceNoteChange,
}: Step1ChooseSectionProps) {
  const hasSections = sections.length > 0
  const selected = sections.find((s) => (s.id ?? '') === (sectionId ?? '')) ?? null
  const [sectionSelectOpen, setSectionSelectOpen] = useState(false)

  useEffect(() => {
    if (!sectionSelectOpen) return

    function handleSectionShortcut(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) {
        return
      }

      const sectionIndex = Number(event.key) - 1
      if (!Number.isInteger(sectionIndex) || sectionIndex < 0 || sectionIndex > 3) return

      const shortcutSection = sections[sectionIndex]
      if (!shortcutSection?.id) return

      event.preventDefault()
      event.stopPropagation()
      onChangeSection(shortcutSection.id)
      setSectionSelectOpen(false)
    }

    window.addEventListener('keydown', handleSectionShortcut, true)
    return () => window.removeEventListener('keydown', handleSectionShortcut, true)
  }, [onChangeSection, sectionSelectOpen, sections])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Choose UCAT section</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All imported question stems will be created under this section. You can change the
          category and other properties for each stem in later steps.
        </p>
      </div>

      <div className="max-w-2xl space-y-1">
        <UcatPropertyRow label="Section">
          <SearchableSelect<UcatSection>
            items={sections}
            value={selected}
            onValueChange={(item) => item && onChangeSection(item.id ?? '')}
            getItemLabel={(s) => s.name ?? 'Untitled section'}
            getItemId={(s) => s.id ?? 'none'}
            placeholder={hasSections ? 'Select a section' : 'No sections available'}
            disabled={!hasSections}
            fullWidth
            ariaLabel="Section"
            open={sectionSelectOpen}
            onOpenChange={setSectionSelectOpen}
          />
        </UcatPropertyRow>
        <UcatPropertyRow label="Tutor source note">
          <Textarea
            className="min-h-24"
            value={tutorSourceNote}
            onChange={(event) => onTutorSourceNoteChange(event.target.value)}
            placeholder="e.g. Altitutor mock 3, official practice bank, in-house worksheet"
            aria-label="Tutor source note"
          />
        </UcatPropertyRow>
        <UcatPropertyRow label="Document layout">
          <div className="space-y-1">
            <SearchableSelect<StemDocumentOption>
              items={STEM_DOCUMENT_OPTIONS}
              value={STEM_DOCUMENT_OPTIONS[separateStemDocument ? 1 : 0]}
              onValueChange={(item) => {
                if (item) onSeparateStemDocumentChange(item.value === 'separate')
              }}
              getItemLabel={(item) => item.label}
              getItemId={(item) => item.value}
              fullWidth
              ariaLabel="Document layout"
            />
          </div>
        </UcatPropertyRow>
      </div>
    </div>
  )
}
