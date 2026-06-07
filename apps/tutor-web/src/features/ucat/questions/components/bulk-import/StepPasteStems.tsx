'use client'

import { useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Label,
  SearchableSelect,
} from '@altitutor/ui'
import { Settings2 } from 'lucide-react'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import {
  splitStemDocumentFromDoc,
  type StemSplitMode,
  type StemSplitOptions,
} from '@/features/ucat/questions/lib/parsers/splitStemDocument'
import type { PasteTableBehavior } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

const STEM_SPLIT_MODE_OPTIONS: { value: StemSplitMode; label: string }[] = [
  { value: 'line_breaks', label: 'Line breaks' },
  { value: 'stem_numbers', label: 'Stem numbers (1. / 1))' },
  { value: 'keyword', label: 'Keyword prefix' },
]

const PREVIEW_LINE_LIMIT = 4

function truncateStemPreview(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length <= PREVIEW_LINE_LIMIT) return lines.join('\n')
  return `${lines.slice(0, PREVIEW_LINE_LIMIT).join('\n')}\n…`
}

type StepPasteStemsProps = {
  value: Json | null
  onChange: (value: Json) => void
  stemSplitOptions: StemSplitOptions
  onStemSplitOptionsChange: (options: StemSplitOptions) => void
  pasteTableBehavior: PasteTableBehavior
  onPasteTableBehaviorChange: (behavior: PasteTableBehavior) => void
  onImageFileIdsChange?: (fileIds: string[]) => void
}

export function StepPasteStems({
  value,
  onChange,
  stemSplitOptions,
  onStemSplitOptionsChange,
  pasteTableBehavior,
  onImageFileIdsChange,
}: StepPasteStemsProps) {
  const splitResult = useMemo(
    () => splitStemDocumentFromDoc(value, stemSplitOptions),
    [value, stemSplitOptions]
  )

  const stemHighlight = useMemo(
    () => ({
      mode: 'stem_split' as const,
      splitLineIndices: splitResult.splitLineIndices,
    }),
    [splitResult.splitLineIndices]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Paste stems</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste passages on the left. Detected stems appear on the right; purple lines mark
            where the next stem begins.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Stem settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 p-2" align="end">
            <DropdownMenuLabel className="px-0 text-xs">Split stems by</DropdownMenuLabel>
            <div className="space-y-3">
              <SearchableSelect<{ value: StemSplitMode; label: string }>
                items={STEM_SPLIT_MODE_OPTIONS}
                value={
                  STEM_SPLIT_MODE_OPTIONS.find((o) => o.value === stemSplitOptions.mode) ??
                  STEM_SPLIT_MODE_OPTIONS[0]
                }
                onValueChange={(item) =>
                  item && onStemSplitOptionsChange({ ...stemSplitOptions, mode: item.value })
                }
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
                triggerClassName="w-full"
              />
              {stemSplitOptions.mode === 'line_breaks' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Consecutive blank lines</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={stemSplitOptions.lineBreakThreshold}
                    onChange={(e) =>
                      onStemSplitOptionsChange({
                        ...stemSplitOptions,
                        lineBreakThreshold: Math.max(1, Number.parseInt(e.target.value, 10) || 2),
                      })
                    }
                  />
                </div>
              ) : null}
              {stemSplitOptions.mode === 'keyword' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Keyword prefix</Label>
                  <Input
                    value={stemSplitOptions.keywordPrefix}
                    onChange={(e) =>
                      onStemSplitOptionsChange({
                        ...stemSplitOptions,
                        keywordPrefix: e.target.value,
                      })
                    }
                    placeholder="e.g. Prompt"
                  />
                </div>
              ) : null}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:flex-row md:gap-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pr-4">
          <Label className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">
            Stem document
          </Label>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/40 p-3 [&_.ProseMirror]:min-h-[12rem]">
            <UcatRichTextEditor
              value={value}
              onChange={onChange}
              placeholder="Paste stem passages here…"
              minHeight="12rem"
              stemId={null}
              enableImages
              onImageFileIdsChange={onImageFileIdsChange}
              pasteTableBehavior={pasteTableBehavior}
              {...BULK_IMPORT_RTE_PASTE}
              ucatParseHighlight={stemHighlight}
            />
          </div>
        </div>

        <div
          className="hidden shrink-0 self-stretch md:block md:w-px md:bg-border"
          aria-hidden
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pl-4">
          <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Detected stems</Label>
            <span className="text-xs text-muted-foreground">
              {splitResult.stems.length} stem{splitResult.stems.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/20 p-3">
            {splitResult.warnings.map((warning) => (
              <p key={warning} className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                {warning}
              </p>
            ))}
            {splitResult.stems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stems detected yet.</p>
            ) : (
              <div className="space-y-0">
                {splitResult.stems.map((stem, index) => (
                  <div key={index}>
                    {index > 0 ? (
                      <div
                        className="my-3 border-t-2 border-purple-500/50"
                        aria-hidden
                      />
                    ) : null}
                    <div className="rounded border bg-background px-2 py-2 text-xs">
                      <div className="font-medium text-muted-foreground">Stem {index + 1}</div>
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-foreground/90">
                        {truncateStemPreview(stem)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
