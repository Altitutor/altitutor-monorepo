'use client'

import type { Json } from '@altitutor/shared'
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'

type SectionOption = {
  id: string | null
  name: string | null
}

type Step1PasteAiImportDocumentProps = {
  sectionId: string
  sections: SectionOption[]
  document: Json | null
  expectedQuestionCount: string
  onSectionIdChange: (value: string) => void
  onDocumentChange: (value: Json) => void
  onExpectedQuestionCountChange: (value: string) => void
  onImageFileIdsChange: (fileIds: string[]) => void
}

export function Step1PasteAiImportDocument({
  sectionId,
  sections,
  document,
  expectedQuestionCount,
  onSectionIdChange,
  onDocumentChange,
  onExpectedQuestionCountChange,
  onImageFileIdsChange,
}: Step1PasteAiImportDocumentProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Section</Label>
          <Select value={sectionId} onValueChange={onSectionIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id ?? ''} value={section.id ?? ''}>
                  {section.name ?? 'Untitled'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Expected question count (optional)</Label>
          <Input
            type="number"
            min={1}
            max={400}
            placeholder="e.g. 44"
            value={expectedQuestionCount}
            onChange={(event) => onExpectedQuestionCountChange(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Paste UCAT document</Label>
        <p className="text-xs text-muted-foreground">
          Paste one rich-text document containing stems, questions, options, answers, explanations, and images.
        </p>
        <div className="rounded-md border bg-muted/40 p-3">
          <UcatRichTextEditor
            value={document}
            onChange={onDocumentChange}
            placeholder="Paste your UCAT content here..."
            minHeight="360px"
            stemId={null}
            enableImages={true}
            onImageFileIdsChange={onImageFileIdsChange}
            pasteTableBehavior="keep"
          />
        </div>
      </div>
    </div>
  )
}
