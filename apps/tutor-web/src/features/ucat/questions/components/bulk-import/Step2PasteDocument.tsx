'use client'

import type { Json } from '@altitutor/shared'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'

type Step2PasteDocumentProps = {
  value: Json | null
  onChange: (value: Json) => void
}

export function Step2PasteDocument({ value, onChange }: Step2PasteDocumentProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Paste questions document</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste or type the UCAT questions you want to import. For Verbal Reasoning, we&apos;ll
          attempt to parse this into stems, questions, and answer options in the next step.
        </p>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 min-h-[360px]">
        <UcatRichTextEditor
          value={value}
          onChange={onChange}
          placeholder="Paste your UCAT questions here…"
          minHeight="320px"
          enableImages={false}
        />
      </div>
    </div>
  )
}

