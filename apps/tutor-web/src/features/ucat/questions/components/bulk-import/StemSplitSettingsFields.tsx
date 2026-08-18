import { Input, Label, SearchableSelect, Textarea } from '@altitutor/ui'
import type {
  StemSplitMode,
  StemSplitOptions,
} from '@/features/ucat/questions/lib/parsers/splitStemDocument'

const STEM_SPLIT_MODE_OPTIONS: { value: StemSplitMode; label: string }[] = [
  { value: 'keyword', label: 'Keyword prefix' },
  { value: 'line_breaks', label: 'Line breaks' },
  { value: 'stem_numbers', label: 'Stem numbers' },
]

const STEM_NUMBER_INDICATOR_OPTIONS: {
  value: StemSplitOptions['stemNumberIndicator']
  label: string
}[] = [
  { value: 'dot', label: '1. 2. 3.' },
  { value: 'paren', label: '1) 2) 3)' },
]

type StemSplitSettingsFieldsProps = {
  options: StemSplitOptions
  onChange: (options: StemSplitOptions) => void
  subject?: 'stems' | 'question groups'
}

export function StemSplitSettingsFields({
  options,
  onChange,
  subject = 'stems',
}: StemSplitSettingsFieldsProps) {
  return (
    <div className="space-y-3">
      <SearchableSelect<{ value: StemSplitMode; label: string }>
        items={STEM_SPLIT_MODE_OPTIONS}
        value={
          STEM_SPLIT_MODE_OPTIONS.find((option) => option.value === options.mode) ??
          STEM_SPLIT_MODE_OPTIONS[0]
        }
        onValueChange={(item) => item && onChange({ ...options, mode: item.value })}
        getItemLabel={(item) => item.label}
        getItemId={(item) => item.value}
        fullWidth
        triggerClassName="w-full"
      />

      {options.mode === 'line_breaks' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">At least this many consecutive blank lines</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={options.lineBreakThreshold}
            onChange={(event) =>
              onChange({
                ...options,
                lineBreakThreshold: Math.max(1, Number.parseInt(event.target.value, 10) || 2),
              })
            }
          />
        </div>
      ) : null}

      {options.mode === 'stem_numbers' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">{subject === 'stems' ? 'Stem' : 'Group'} number format</Label>
          <SearchableSelect<(typeof STEM_NUMBER_INDICATOR_OPTIONS)[number]>
            items={STEM_NUMBER_INDICATOR_OPTIONS}
            value={
              STEM_NUMBER_INDICATOR_OPTIONS.find(
                (option) => option.value === options.stemNumberIndicator
              ) ?? STEM_NUMBER_INDICATOR_OPTIONS[0]
            }
            onValueChange={(item) =>
              item && onChange({ ...options, stemNumberIndicator: item.value })
            }
            getItemLabel={(item) => item.label}
            getItemId={(item) => item.value}
            fullWidth
            triggerClassName="w-full"
          />
        </div>
      ) : null}

      {options.mode === 'keyword' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Keyword prefix sequence</Label>
          <Textarea
            value={options.keywordPrefix}
            onChange={(event) => onChange({ ...options, keywordPrefix: event.target.value })}
            placeholder={'e.g. Passage\nQuestions'}
            className="min-h-20 font-mono text-xs"
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Put each prefix on a new line. The first starts a{' '}
            {subject === 'stems' ? 'stem' : 'group'}; matching labels immediately after it are also
            removed.
          </p>
        </div>
      ) : null}
    </div>
  )
}
