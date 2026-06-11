'use client'

import { useMemo, useState } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@altitutor/ui'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import { taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { cn } from '@/shared/utils'

export type BulkImportTagOption = {
  id: string
  name: string
  label?: string | null
}

type StepQuestionTagsProps = {
  stems: BulkImportStemDraft[]
  /** All tags — used to resolve labels for already-selected pills. */
  tags: BulkImportTagOption[]
  /** Tags available in the add-tag picker (section-scoped). */
  selectableTags: BulkImportTagOption[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
}

type QuestionRow = {
  key: string
  stem: BulkImportStemDraft
  stemIndex: number
  questionIndex: number
  globalQuestionNumber: number
}

function buildQuestionRows(stems: BulkImportStemDraft[]): QuestionRow[] {
  const rows: QuestionRow[] = []
  let globalQuestionNumber = 0
  stems.forEach((stem, stemIndex) => {
    stem.values.questions.forEach((_, questionIndex) => {
      globalQuestionNumber += 1
      rows.push({
        key: `${stem.id}-${questionIndex}`,
        stem,
        stemIndex,
        questionIndex,
        globalQuestionNumber,
      })
    })
  })
  return rows
}

function questionPreview(row: QuestionRow): string {
  const question = row.stem.values.questions[row.questionIndex]
  return proseMirrorToPlainText(question?.questionText ?? null)?.replace(/\s+/g, ' ').trim() ?? ''
}

function TagPill({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted py-0.5 pl-2 pr-1 text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="shrink-0 rounded-sm p-0.5 hover:bg-background/80"
        aria-label={`Remove ${label}`}
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function InlineQuestionTags({
  tags,
  selectableTags,
  selectedIds,
  onChange,
}: {
  tags: BulkImportTagOption[]
  selectableTags: BulkImportTagOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedTags = tags.filter((tag) => selectedIds.includes(tag.id))
  const availableTags = selectableTags.filter((tag) => !selectedIds.includes(tag.id))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) => (
        <TagPill
          key={tag.id}
          label={taxonomyDisplayLabel(tag)}
          onRemove={() => onChange(selectedIds.filter((id) => id !== tag.id))}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground',
              'hover:bg-muted/50'
            )}
          >
            + Add tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[24rem] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {availableTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.id}-${taxonomyDisplayLabel(tag)}`}
                    onSelect={() => {
                      onChange([...selectedIds, tag.id])
                      setOpen(false)
                    }}
                  >
                    {taxonomyDisplayLabel(tag)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function StepQuestionTags({
  stems,
  tags,
  selectableTags,
  onUpdateStem,
}: StepQuestionTagsProps) {
  const rows = useMemo(() => buildQuestionRows(stems), [stems])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Add question tags</h2>
        <p className="text-sm text-muted-foreground">No parsed questions are available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Add question tags</h2>
      <div className="space-y-3">
        {rows.map((row) => {
          const expanded = expandedKey === row.key
          const question = row.stem.values.questions[row.questionIndex]
          const selectedIds = question?.tagIds ?? []
          return (
            <div
              key={row.key}
              className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-3"
            >
              <div className="min-w-0 flex-1 rounded-md border bg-background">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left"
                  onClick={() => setExpandedKey(expanded ? null : row.key)}
                >
                  {expanded ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        Question {row.globalQuestionNumber}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {questionPreview(row) || 'No question preview'}
                    </p>
                  </div>
                </button>
                {expanded ? (
                  <div className="space-y-3 border-t px-3 py-3">
                    <BulkImportRichTextPreview json={row.stem.values.stemText} />
                    <div className="border-t pt-3">
                      <BulkImportRichTextPreview json={question?.questionText ?? null} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="w-full shrink-0 lg:max-w-sm lg:pt-1.5">
                <InlineQuestionTags
                  tags={tags}
                  selectableTags={selectableTags}
                  selectedIds={selectedIds}
                  onChange={(tagIds) => {
                    const questions = [...row.stem.values.questions]
                    const current = questions[row.questionIndex]
                    if (!current) return
                    questions[row.questionIndex] = { ...current, tagIds }
                    onUpdateStem(row.stem.id, { ...row.stem.values, questions })
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
