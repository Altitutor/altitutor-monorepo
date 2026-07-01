'use client'

import { useMemo, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { extractSkillTrainerPlainText, type Json } from '@altitutor/shared'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@altitutor/ui'
import { Plus, Trash2 } from 'lucide-react'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { EMPTY_DOC } from '@/features/ucat/skill-trainer/constants/itemFormConstants'
import type { UcatSkillTrainerItemFormValues } from '@/features/ucat/skill-trainer/types/schema'
import { cn } from '@/shared/utils'

const CALC_KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '+', 'M+', 'M-', 'MR', 'MC', '√', '%', '±', 'C', 'CE', '←'] as const

const SKILL_TRAINER_RTE_CLASS =
  'min-h-[240px] rounded-lg border border-border bg-background p-3 text-foreground [&_.tiptap]:text-foreground [&_.ProseMirror]:text-foreground'

const OCCURRENCE_HIGHLIGHT_CLASS =
  'rounded-sm bg-amber-200/80 text-inherit ring-1 ring-amber-500/80 dark:bg-amber-500/30 dark:ring-amber-400/60'

type OccurrenceRange = { start: number; end: number }

function buildOccurrenceSegments(plain: string, occurrences: OccurrenceRange[]) {
  const segments: Array<{ text: string; highlighted?: boolean }> = []
  let cursor = 0
  const sorted = [...occurrences].sort((a, b) => a.start - b.start)

  for (const occurrence of sorted) {
    if (occurrence.start > cursor) {
      segments.push({ text: plain.slice(cursor, occurrence.start) })
    }
    if (occurrence.end > occurrence.start) {
      segments.push({
        text: plain.slice(occurrence.start, occurrence.end),
        highlighted: true,
      })
    }
    cursor = Math.max(cursor, occurrence.end)
  }

  if (cursor < plain.length) {
    segments.push({ text: plain.slice(cursor) })
  }

  return segments
}

function getPlainTextSelectionOffsets(container: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  const startRange = document.createRange()
  startRange.selectNodeContents(container)
  startRange.setEnd(range.startContainer, range.startOffset)
  const start = startRange.toString().length
  const end = start + range.toString().length

  return { start, end }
}

type Props = {
  form: UseFormReturn<UcatSkillTrainerItemFormValues>
}

function FieldCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function PassageEditor({
  form,
  label = 'Passage',
}: {
  form: UseFormReturn<UcatSkillTrainerItemFormValues>
  label?: string
}) {
  const passage = (form.watch('passage') ?? EMPTY_DOC) as Json
  return (
    <FieldCard title={label}>
      <UcatRichTextEditor
        value={passage}
        onChange={(value) => form.setValue('passage', value as Record<string, unknown>, { shouldDirty: true })}
        className={SKILL_TRAINER_RTE_CLASS}
        placeholder="Enter the VR passage…"
        enableImages
      />
    </FieldCard>
  )
}

function FindWordEditor({ form }: Props) {
  const keywords = form.watch('keywords') ?? []
  const keywordErrors = form.formState.errors.keywords

  return (
    <div className="space-y-6">
      <PassageEditor form={form} />
      <FieldCard title="Keywords">
        <div className="space-y-3">
          {keywords.map((keyword, index) => (
            <div
              key={keyword.id || index}
              className={cn(
                'grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]',
                keywordErrors?.[index]?.text ? 'border-destructive/70 bg-destructive/5' : ''
              )}
            >
              <div className="space-y-1">
                <Label>Keyword</Label>
                <Input
                  value={keyword.text}
                  aria-invalid={Boolean(keywordErrors?.[index]?.text)}
                  onChange={(e) => {
                    const next = [...keywords]
                    next[index] = { ...keyword, text: e.target.value }
                    form.setValue('keywords', next, { shouldDirty: true })
                  }}
                />
                {keywordErrors?.[index]?.text?.message ? (
                  <p className="text-xs text-destructive">
                    {String(keywordErrors[index]?.text?.message)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    form.setValue(
                      'keywords',
                      keywords.filter((_, i) => i !== index),
                      { shouldDirty: true }
                    )
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              form.setValue(
                'keywords',
                [
                  ...keywords,
                  { id: `k${Date.now()}`, text: 'keyword' },
                ],
                { shouldDirty: true }
              )
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add keyword
          </Button>
        </div>
      </FieldCard>
    </div>
  )
}

function FindConceptEditor({ form }: Props) {
  const occurrences = form.watch('occurrences') ?? []
  const passage = (form.watch('passage') ?? EMPTY_DOC) as Record<string, unknown>
  const plainPassage = useMemo(
    () => extractSkillTrainerPlainText(passage, { blockSeparator: '\n' }),
    [passage]
  )
  const passageRef = useRef<HTMLDivElement | null>(null)
  const occurrenceSegments = useMemo(
    () => buildOccurrenceSegments(plainPassage, occurrences),
    [plainPassage, occurrences]
  )

  const addSelectionAsOccurrence = () => {
    const container = passageRef.current
    if (!container) return
    const selection = getPlainTextSelectionOffsets(container)
    if (!selection) return
    const start = Math.min(selection.start, selection.end)
    const end = Math.max(selection.start, selection.end)
    if (start === end) return
    const selectedText = plainPassage.slice(start, end)
    if (!selectedText.trim()) return
    const alreadyExists = occurrences.some((occurrence) => occurrence.start === start && occurrence.end === end)
    if (alreadyExists) return
    form.setValue(
      'occurrences',
      [...occurrences, { start, end }].sort((a, b) => a.start - b.start),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  return (
    <div className="space-y-6">
      <PassageEditor form={form} />
      <FieldCard title="Concept">
        <Input
          value={form.watch('concept') ?? ''}
          onChange={(e) => form.setValue('concept', e.target.value, { shouldDirty: true })}
          placeholder="Key concept or theme"
        />
      </FieldCard>
      <FieldCard title="Occurrences">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Highlight text in the passage preview</Label>
            <div
              ref={passageRef}
              role="textbox"
              tabIndex={0}
              aria-label="Passage preview for selecting concept occurrences"
              onMouseUp={addSelectionAsOccurrence}
              onKeyUp={addSelectionAsOccurrence}
              className="min-h-[12rem] cursor-text select-text rounded-lg border border-border bg-background p-3 font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground"
            >
              {plainPassage.length === 0 ? (
                <span className="text-muted-foreground">Add passage text above, then select occurrences here.</span>
              ) : (
                occurrenceSegments.map((segment, index) =>
                  segment.highlighted ? (
                    <mark key={`${index}-${segment.text}`} className={OCCURRENCE_HIGHLIGHT_CLASS}>
                      {segment.text}
                    </mark>
                  ) : (
                    <span key={`${index}-${segment.text}`}>{segment.text}</span>
                  )
                )
              )}
            </div>
          </div>
          {occurrences.length === 0 ? (
            <p className="text-sm text-muted-foreground">No occurrences selected.</p>
          ) : null}
          {occurrences.map((occurrence, index) => {
            const label = plainPassage.slice(occurrence.start, occurrence.end)
            return (
              <div key={`${occurrence.start}-${occurrence.end}-${index}`} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <Label>Occurrence {index + 1}</Label>
                  <p className="rounded bg-muted px-3 py-2 text-sm">{label || 'Empty selection'}</p>
                </div>
                <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    form.setValue(
                      'occurrences',
                      occurrences.filter((_, i) => i !== index),
                      { shouldDirty: true }
                    )
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            )
          })}
        </div>
      </FieldCard>
    </div>
  )
}

function QuickSyllogismEditor({ form }: Props) {
  return (
    <FieldCard title="Syllogism">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Statement</Label>
          <Textarea
            value={form.watch('statement') ?? ''}
            onChange={(e) => form.setValue('statement', e.target.value, { shouldDirty: true })}
            rows={4}
            placeholder="One-sentence syllogism statement"
          />
        </div>
        <div className="space-y-2">
          <Label>Correct answer</Label>
          <Select
            value={form.watch('syllogismAnswer') === false ? 'false' : 'true'}
            onValueChange={(value) => form.setValue('syllogismAnswer', value === 'true', { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </FieldCard>
  )
}

function MentalMathsEditor({ form }: Props) {
  return (
    <FieldCard title="Mental maths">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Expression</Label>
          <Input
            value={form.watch('expression') ?? ''}
            onChange={(e) => form.setValue('expression', e.target.value, { shouldDirty: true })}
            placeholder="e.g. 12 + 8 - 3"
          />
        </div>
        <div className="space-y-2">
          <Label>Answer</Label>
          <Input
            type="number"
            step="any"
            value={form.watch('answer') ?? ''}
            onChange={(e) => form.setValue('answer', Number(e.target.value), { shouldDirty: true })}
          />
        </div>
      </div>
    </FieldCard>
  )
}

function NumpadSpeedEditor({ form }: Props) {
  const sequence = form.watch('buttonSequence') ?? []

  return (
    <div className="space-y-6">
      <FieldCard title="Sequence label (optional)">
        <Input
          value={form.watch('label') ?? ''}
          onChange={(e) => form.setValue('label', e.target.value, { shouldDirty: true })}
          placeholder="e.g. 7 + 3"
        />
      </FieldCard>
      <FieldCard title="Button sequence">
        <div className="flex flex-wrap gap-2">
          {sequence.map((key, index) => (
            <div key={`${key}-${index}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <span>{key}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  form.setValue(
                    'buttonSequence',
                    sequence.filter((_, i) => i !== index),
                    { shouldDirty: true }
                  )
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {CALC_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => form.setValue('buttonSequence', [...sequence, key], { shouldDirty: true })}
            >
              {key}
            </Button>
          ))}
        </div>
      </FieldCard>
    </div>
  )
}

function CalculatorMathsEditor({ form }: Props) {
  const question = (form.watch('question') ?? EMPTY_DOC) as Json

  return (
    <div className="space-y-6">
      <FieldCard title="Question">
        <UcatRichTextEditor
          value={question}
          onChange={(value) => form.setValue('question', value as Record<string, unknown>, { shouldDirty: true })}
          className={SKILL_TRAINER_RTE_CLASS}
          placeholder="Enter the QR-style question…"
          enableImages
        />
      </FieldCard>
      <FieldCard title="Answer">
        <Input
          type="number"
          step="any"
          value={form.watch('answer') ?? ''}
          onChange={(e) => form.setValue('answer', Number(e.target.value), { shouldDirty: true })}
        />
      </FieldCard>
    </div>
  )
}

export function UcatSkillTrainerContentEditor({ form }: Props) {
  const trainerKey = form.watch('trainerKey')

  switch (trainerKey) {
    case 'find_word':
      return <FindWordEditor form={form} />
    case 'find_concept':
      return <FindConceptEditor form={form} />
    case 'quick_syllogism':
      return <QuickSyllogismEditor form={form} />
    case 'mental_maths':
      return <MentalMathsEditor form={form} />
    case 'numpad_speed':
      return <NumpadSpeedEditor form={form} />
    case 'calculator_maths':
      return <CalculatorMathsEditor form={form} />
    default:
      return null
  }
}
