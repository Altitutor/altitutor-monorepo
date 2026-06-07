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
import { cn } from '@/shared/utils'
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

const PREVIEW_LINE_LIMIT = 4

function getStemLines(text: string): string[] {
  return text.trim().split('\n')
}

function stemNeedsExpand(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  const lines = getStemLines(text)
  return (
    lines.length > PREVIEW_LINE_LIMIT ||
    trimmed.replace(/\s+/g, ' ').length > 160
  )
}

function DetectedStemCard({
  index,
  stem,
  expanded,
  onToggle,
}: {
  index: number
  stem: string
  expanded: boolean
  onToggle: () => void
}) {
  const trimmedStem = stem.trim()
  if (trimmedStem.length === 0) return null

  const canExpand = stemNeedsExpand(stem)
  const showExpandHint = !expanded && canExpand

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'w-full shrink-0 cursor-pointer rounded-md border bg-background px-3 py-2 text-left text-xs transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      aria-expanded={expanded}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-muted-foreground">Stem {index + 1}</span>
        {showExpandHint ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">Click to expand</span>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-1 whitespace-pre-wrap font-sans leading-relaxed text-foreground/90',
          !expanded && canExpand && 'line-clamp-4'
        )}
      >
        {trimmedStem}
      </div>
    </div>
  )
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
                  <DetectedStemCard
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
