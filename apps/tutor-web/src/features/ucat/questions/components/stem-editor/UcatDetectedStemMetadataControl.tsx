'use client'

import { useState } from 'react'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@altitutor/ui'
import { Sparkles } from 'lucide-react'
import type {
  BulkImportCategoryRow,
  BulkImportTagRow,
  ManualStemMetadataSectionRow,
} from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import type { PendingStemMetadataDiff } from '@/features/ucat/questions/hooks/useManualStemMetadataDetection'
import { taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { cn } from '@/shared/utils'

function DiffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export function UcatDetectedStemMetadataControl({
  pendingDiff,
  sections,
  categories,
  tags,
  onAccept,
  onDismiss,
  className,
}: {
  pendingDiff: PendingStemMetadataDiff | null
  sections: ManualStemMetadataSectionRow[]
  categories: BulkImportCategoryRow[]
  tags: BulkImportTagRow[]
  onAccept: () => void
  onDismiss: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  if (!pendingDiff) return null

  const sectionLabel = pendingDiff.sectionId
    ? sections.find((section) => section.id === pendingDiff.sectionId)?.name ?? 'Unknown section'
    : null
  const categoryLabel = pendingDiff.categoryId
    ? taxonomyDisplayLabel(
        categories.find((category) => category.id === pendingDiff.categoryId) ?? {
          name: 'Unknown category',
        },
      )
    : null
  const responseContractEntries = Object.entries(
    pendingDiff.responseContractsByQuestionIndex
  )
    .map(([indexText, inference]) => ({
      index: Number(indexText),
      value: [
        [
          inference.responseType.value?.replaceAll('_', ' '),
          inference.answerScheme.value?.replaceAll('_', ' '),
        ].filter(Boolean).join(' / ') || 'not inferred',
        [...new Set([
          inference.responseType.confidence,
          inference.answerScheme.confidence,
        ])].join(' / '),
        inference.reviewState.replaceAll('_', ' '),
      ].join(' · '),
      evidence: [...new Set([
        ...inference.responseType.evidence,
        ...inference.answerScheme.evidence,
        ...inference.responseType.conflicts,
        ...inference.answerScheme.conflicts,
      ])].map((item) => item.replaceAll('_', ' ')).join(', ') || 'No structural evidence',
    }))
    .sort((left, right) => left.index - right.index)
  const tagEntries = Object.entries(pendingDiff.tagIdsByQuestionIndex)
    .map(([indexText, tagIds]) => {
      const index = Number(indexText)
      const labels = tagIds
        .map((tagId) =>
          taxonomyDisplayLabel(tags.find((tag) => tag.id === tagId) ?? { name: 'Unknown tag' }),
        )
        .join(', ')
      return { index, labels }
    })
    .filter((entry) => entry.labels.length > 0)
    .sort((a, b) => a.index - b.index)

  function handleAccept() {
    onAccept()
    setOpen(false)
  }

  function handleDismiss() {
    onDismiss()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60',
            className,
          )}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Detected
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        enableModalScroll
        className="z-[100] flex w-[340px] max-h-[min(420px,calc(100vh-96px))] flex-col gap-3 overflow-hidden p-3"
      >
        <div className="shrink-0">
          <p className="text-sm font-semibold text-foreground">Detected metadata</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            From the question content. Accept to apply, or dismiss to keep current values.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-2.5">
          {sectionLabel ? <DiffRow label="Section" value={sectionLabel} /> : null}
          {categoryLabel ? <DiffRow label="Category" value={categoryLabel} /> : null}
          {responseContractEntries.map((entry) => (
            <div key={`response-${entry.index}`} className="space-y-1">
              <DiffRow
                label={responseContractEntries.length > 1 ? `Response (Q${entry.index + 1})` : 'Response'}
                value={entry.value}
              />
              <DiffRow label="Evidence" value={entry.evidence} />
            </div>
          ))}
          {tagEntries.map((entry) => (
            <DiffRow
              key={entry.index}
              label={tagEntries.length > 1 ? `Tags (Q${entry.index + 1})` : 'Tags'}
              value={entry.labels}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button type="button" size="sm" className="h-8" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
