'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
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
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  tags: BulkImportTagOption[]
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

function TagMultiSelect({
  tags,
  selectedIds,
  onChange,
}: {
  tags: BulkImportTagOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const selectedTags = tags.filter((tag) => selectedIds.includes(tag.id))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          <span className="truncate">
            {selectedTags.length === 0 ? 'Add tags' : `${selectedTags.length} tag(s) selected`}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[24rem] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search tags..." />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => {
                const checked = selectedIds.includes(tag.id)
                return (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.id}-${taxonomyDisplayLabel(tag)}`}
                    onSelect={() => {
                      onChange(
                        checked
                          ? selectedIds.filter((id) => id !== tag.id)
                          : [...selectedIds, tag.id]
                      )
                    }}
                  >
                    <Checkbox checked={checked} className="mr-2" />
                    <span>{taxonomyDisplayLabel(tag)}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function StepQuestionTags({ stems, tags, onUpdateStem }: StepQuestionTagsProps) {
  const rows = useMemo(() => buildQuestionRows(stems), [stems])
  const [expandedKey, setExpandedKey] = useState<string | null>(rows[0]?.key ?? null)

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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-3">
          {rows.map((row) => {
            const expanded = expandedKey === row.key
            const question = row.stem.values.questions[row.questionIndex]
            const selectedCount = question?.tagIds?.length ?? 0
            return (
              <div key={row.key} className="rounded-md border bg-background">
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
                      <span className="text-sm font-medium">Question {row.globalQuestionNumber}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {selectedCount === 0 ? 'No tags' : `${selectedCount} tag(s)`}
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
            )
          })}
        </div>

        <div className="rounded-md border bg-background p-4">
          {rows.map((row) => {
            if (row.key !== expandedKey) return null
            const question = row.stem.values.questions[row.questionIndex]
            const selectedIds = question?.tagIds ?? []
            const selectedTags = tags.filter((tag) => selectedIds.includes(tag.id))
            return (
              <Fragment key={row.key}>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Question {row.globalQuestionNumber} tags</div>
                  <TagMultiSelect
                    tags={tags}
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
                {selectedTags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className={cn(
                          'rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground'
                        )}
                      >
                        {taxonomyDisplayLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
