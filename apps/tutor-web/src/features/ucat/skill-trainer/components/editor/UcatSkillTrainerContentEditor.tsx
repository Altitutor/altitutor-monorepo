'use client'

import type { UseFormReturn } from 'react-hook-form'
import type { Json } from '@altitutor/shared'
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
import { tutorCardCn } from '@/shared/lib/tutor-visual'

const CALC_KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '=', '+', 'M+', 'M-', 'MR', 'MC', '√', '%', '±', 'C', 'CE', '←'] as const

const SKILL_TRAINER_RTE_CLASS =
  'min-h-[240px] rounded-lg border border-border bg-background p-3 text-foreground [&_.tiptap]:text-foreground [&_.ProseMirror]:text-foreground'

type Props = {
  form: UseFormReturn<UcatSkillTrainerItemFormValues>
}

function FieldCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(tutorCardCn('p-4'), className)}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
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

  return (
    <div className="space-y-4">
      <PassageEditor form={form} />
      <FieldCard title="Keywords">
        <div className="space-y-3">
          {keywords.map((keyword, index) => (
            <div key={keyword.id || index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_120px_auto]">
              <div className="space-y-1">
                <Label>Keyword</Label>
                <Input
                  value={keyword.text}
                  onChange={(e) => {
                    const next = [...keywords]
                    next[index] = { ...keyword, text: e.target.value }
                    form.setValue('keywords', next, { shouldDirty: true })
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Sentence #</Label>
                <Input
                  type="number"
                  min={0}
                  value={keyword.target_sentence_index}
                  onChange={(e) => {
                    const next = [...keywords]
                    next[index] = { ...keyword, target_sentence_index: Number(e.target.value) || 0 }
                    form.setValue('keywords', next, { shouldDirty: true })
                  }}
                />
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
                  { id: `k${Date.now()}`, text: 'keyword', target_sentence_index: 0 },
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

  return (
    <div className="space-y-4">
      <PassageEditor form={form} />
      <FieldCard title="Concept">
        <Input
          value={form.watch('concept') ?? ''}
          onChange={(e) => form.setValue('concept', e.target.value, { shouldDirty: true })}
          placeholder="Key concept or theme"
        />
      </FieldCard>
      <FieldCard title="Occurrences (character offsets)">
        <div className="space-y-3">
          {occurrences.map((occurrence, index) => (
            <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input
                  type="number"
                  min={0}
                  value={occurrence.start}
                  onChange={(e) => {
                    const next = [...occurrences]
                    next[index] = { ...occurrence, start: Number(e.target.value) || 0 }
                    form.setValue('occurrences', next, { shouldDirty: true })
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input
                  type="number"
                  min={0}
                  value={occurrence.end}
                  onChange={(e) => {
                    const next = [...occurrences]
                    next[index] = { ...occurrence, end: Number(e.target.value) || 0 }
                    form.setValue('occurrences', next, { shouldDirty: true })
                  }}
                />
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
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              form.setValue('occurrences', [...occurrences, { start: 0, end: 0 }], { shouldDirty: true })
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add occurrence
          </Button>
        </div>
      </FieldCard>
    </div>
  )
}

function QuickSyllogismEditor({ form }: Props) {
  return (
    <FieldCard title="Syllogism">
      <div className="space-y-4">
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
      <div className="space-y-4">
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
    <div className="space-y-4">
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
    <div className="space-y-4">
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
