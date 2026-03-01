'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui'
import type { UcatSection } from '@/features/ucat/shared/types'

type Step1ChooseSectionProps = {
  sectionId: string | null
  sections: UcatSection[]
  onChangeSection: (sectionId: string) => void
}

export function Step1ChooseSection({
  sectionId,
  sections,
  onChangeSection,
}: Step1ChooseSectionProps) {
  const hasSections = sections.length > 0

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
          <Select
            value={sectionId ?? ''}
            onValueChange={(value) => {
              if (!value) return
              onChangeSection(value)
            }}
            disabled={!hasSections}
          >
            <SelectTrigger>
              <SelectValue placeholder={hasSections ? 'Select a section' : 'No sections available'} />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id ?? 'none'} value={section.id ?? ''}>
                  {section.name ?? 'Untitled section'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  )
}

