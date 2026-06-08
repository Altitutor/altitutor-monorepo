'use client'

import { Checkbox, Label, SearchableSelect } from '@altitutor/ui'
import type { UcatSection } from '@/features/ucat/shared/types'

type Step1ChooseSectionProps = {
  sectionId: string | null
  sections: UcatSection[]
  onChangeSection: (sectionId: string) => void
  separateStemDocument: boolean
  onSeparateStemDocumentChange: (value: boolean) => void
}

export function Step1ChooseSection({
  sectionId,
  sections,
  onChangeSection,
  separateStemDocument,
  onSeparateStemDocumentChange,
}: Step1ChooseSectionProps) {
  const hasSections = sections.length > 0
  const selected = sections.find((s) => (s.id ?? '') === (sectionId ?? '')) ?? null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Choose UCAT section</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All imported question stems will be created under this section. You can change the
          category and other properties for each stem in later steps.
        </p>
      </div>

      <div className="max-w-sm">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Section</span>
          <SearchableSelect<UcatSection>
            items={sections}
            value={selected}
            onValueChange={(item) => item && onChangeSection(item.id ?? '')}
            getItemLabel={(s) => s.name ?? 'Untitled section'}
            getItemId={(s) => s.id ?? 'none'}
            placeholder={hasSections ? 'Select a section' : 'No sections available'}
            disabled={!hasSections}
          />
        </label>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-3 max-w-lg">
        <Checkbox
          id="bulk-import-separate-stem-document"
          checked={separateStemDocument}
          onCheckedChange={(checked) => onSeparateStemDocumentChange(checked === true)}
        />
        <div className="space-y-1">
          <Label
            htmlFor="bulk-import-separate-stem-document"
            className="cursor-pointer text-sm font-medium"
          >
            Stems in separate document
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            Paste question stems from one document and questions from another. Available for all
            UCAT sections.
          </p>
        </div>
      </div>
    </div>
  )
}

