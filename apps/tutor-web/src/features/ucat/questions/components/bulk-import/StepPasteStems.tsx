'use client'

import { useCallback, useMemo, useState } from 'react'
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
import { CollapsibleStemCard } from '@/features/ucat/questions/components/bulk-import/CollapsibleStemCard'
import { BulkImportParseLegendButton } from '@/features/ucat/questions/components/bulk-import/BulkImportParseLegendButton'
import { BULK_IMPORT_RTE_PASTE } from '@/features/ucat/questions/components/bulk-import/bulkImportRichTextDefaults'
import {
  splitStemDocumentFromDoc,
  type StemSplitMode,
  type StemSplitOptions,
} from '@/features/ucat/questions/lib/parsers/splitStemDocument'
import type { PasteTableBehavior } from '@/features/ucat/questions/components/bulk-import/Step2PasteDocument'

const STEM_SPLIT_MODE_OPTIONS: { value: StemSplitMode; label: string }[] = [
  { value: 'line_breaks', label: 'Line breaks' },
  { value: 'stem_numbers', label: 'Stem numbers' },
  { value: 'keyword', label: 'Keyword prefix' },
]

const STEM_NUMBER_INDICATOR_OPTIONS: {
  value: StemSplitOptions['stemNumberIndicator']
  label: string
}[] = [
  { value: 'dot', label: '1. 2. 3.' },
  { value: 'paren', label: '1) 2) 3)' },
]

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
  const [expandedStemIndices, setExpandedStemIndices] = useState<Set<number>>(() => new Set())

  const splitResult = useMemo(
    () => splitStemDocumentFromDoc(value, stemSplitOptions),
    [value, stemSplitOptions]
  )

  const toggleStemExpanded = useCallback((index: number) => {
    setExpandedStemIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const stemHighlight = useMemo(
    () => ({
      mode: 'stem_split' as const,
      splitLineIndices: splitResult.splitLineIndices,
      discardedLineIndices: splitResult.discardedLineIndices,
      discardedLineSpans: splitResult.discardedLineSpans,
    }),
    [splitResult.splitLineIndices, splitResult.discardedLineIndices, splitResult.discardedLineSpans]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Paste stems</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BulkImportParseLegendButton variant="stem_split" />
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
                  <Label className="text-xs">At least this many consecutive blank lines</Label>
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
              {stemSplitOptions.mode === 'stem_numbers' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Stem number format</Label>
                  <SearchableSelect<(typeof STEM_NUMBER_INDICATOR_OPTIONS)[number]>
                    items={STEM_NUMBER_INDICATOR_OPTIONS}
                    value={
                      STEM_NUMBER_INDICATOR_OPTIONS.find(
                        (o) => o.value === stemSplitOptions.stemNumberIndicator
                      ) ?? STEM_NUMBER_INDICATOR_OPTIONS[0]
                    }
                    onValueChange={(item) =>
                      item &&
                      onStemSplitOptionsChange({
                        ...stemSplitOptions,
                        stemNumberIndicator: item.value,
                      })
                    }
                    getItemLabel={(i) => i.label}
                    getItemId={(i) => i.value}
                    triggerClassName="w-full"
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {splitResult.warnings.map((warning) => (
              <p key={warning} className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                {warning}
              </p>
            ))}
            {splitResult.stems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stems detected yet.</p>
            ) : (
              <div className="flex w-full flex-col gap-2">
                {splitResult.stems.map((stem, index) => (
                  <CollapsibleStemCard
                    key={index}
                    index={index}
                    stem={stem}
                    expanded={expandedStemIndices.has(index)}
                    onToggle={() => toggleStemExpanded(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
