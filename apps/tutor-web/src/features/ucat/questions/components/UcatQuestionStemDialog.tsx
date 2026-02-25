'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Resolver, UseFormReturn } from 'react-hook-form'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@altitutor/ui'
import { Trash2 } from 'lucide-react'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'

/** Trim leading/trailing blank lines and whitespace from plain text. */
function trimTextParagraphs(text: string): string {
  return text
    .split(/\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\s*\n+/, '')
    .replace(/\n+\s*$/, '')
    .trim()
}

export type CategoryOption = { id: string | null; name: string | null; ucat_section_id?: string | null }
export type TagOption = { id: string; name: string }

const DEFAULT_OPTIONS = [
  { answerText: '', answerExplanation: '', isAnswer: true },
  { answerText: '', answerExplanation: '', isAnswer: false },
  { answerText: '', answerExplanation: '', isAnswer: false },
  { answerText: '', answerExplanation: '', isAnswer: false },
]

export function UcatQuestionStemDialog({
  open,
  title,
  submitLabel,
  onClose,
  onSubmit,
  sections,
  categories,
  tags,
  initial,
  loading,
}: {
  open: boolean
  title: string
  submitLabel: string
  onClose: () => void
  onSubmit: (values: UcatQuestionStemFormValues) => Promise<void>
  sections: Array<{ id: string | null; name: string | null }>
  categories: CategoryOption[]
  tags: TagOption[]
  initial?: StemDetailRow | null
  loading?: boolean
}) {
  const defaultValues = useMemo<UcatQuestionStemFormValues>(() => {
    if (!initial) {
      return {
        sectionId: sections.find((section) => section.id)?.id ?? '',
        categoryId: null,
        stemText: '',
        isPrivate: false,
        questions: [
          {
            questionText: '',
            questionType: 'multiple_choice',
            difficulty: null,
            timeBurdenSeconds: '',
            tagIds: [],
            options: [...DEFAULT_OPTIONS],
          },
        ],
      }
    }

    return {
      sectionId: initial.section_id,
      categoryId: initial.question_stem_category_id,
      stemText: proseMirrorToPlainText(initial.stem_text),
      isPrivate: initial.is_private,
      questions: (initial.questions ?? []).map((question) => ({
        questionText: proseMirrorToPlainText(question.question_text),
        questionType: question.question_type,
        difficulty: question.difficulty,
        timeBurdenSeconds: question.time_burden_seconds != null ? secondsToTimeString(question.time_burden_seconds) : '',
        tagIds: (question.tags ?? []).map((tag) => tag.id),
        options:
          (question.answer_options ?? []).length > 0
            ? (question.answer_options ?? []).map((option) => ({
                answerText: proseMirrorToPlainText(option.answer_text),
                answerExplanation: proseMirrorToPlainText(option.answer_explanation),
                isAnswer: option.is_answer,
              }))
            : [...DEFAULT_OPTIONS],
      })),
    }
  }, [initial, sections])

  const form = useForm<UcatQuestionStemFormValues>({
    resolver: zodResolver(ucatQuestionStemSchema) as Resolver<UcatQuestionStemFormValues>,
    defaultValues,
    values: defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })

  // When opening for create (no initial), reset form so previous content is cleared
  useEffect(() => {
    if (open && !initial) {
      const emptyDefaults: UcatQuestionStemFormValues = {
        sectionId: sections.find((section) => section.id)?.id ?? '',
        categoryId: null,
        stemText: '',
        isPrivate: false,
        questions: [
          {
            questionText: '',
            questionType: 'multiple_choice',
            difficulty: null,
            timeBurdenSeconds: '',
            tagIds: [],
            options: [...DEFAULT_OPTIONS],
          },
        ],
      }
      form.reset(emptyDefaults)
    }
  }, [open, initial, sections, form])

  const sectionId = form.watch('sectionId')
  const categoriesFiltered = useMemo(
    () => (sectionId ? categories.filter((c) => (c.ucat_section_id ?? null) === sectionId) : []),
    [categories, sectionId]
  )

  const stemType = form.watch('questions.0.questionType') as 'multiple_choice' | 'syllogism' | undefined

  function setStemType(value: 'multiple_choice' | 'syllogism') {
    fields.forEach((_, i) => {
      form.setValue(`questions.${i}.questionType`, value, { shouldDirty: true })
    })
  }

  async function handleSave() {
    await form.handleSubmit((values) => {
      const transformed = {
        ...values,
        stemText: trimTextParagraphs(values.stemText ?? ''),
        questions: values.questions.map((q) => {
          const filteredOptions = (q.options ?? []).filter((o) => (o.answerText ?? '').trim() !== '')
          const optionsToSend = filteredOptions.length > 0 ? filteredOptions : (q.options ?? []).slice(0, 1)
          return {
            ...q,
            questionText: trimTextParagraphs(q.questionText ?? ''),
            timeBurdenSeconds: parseTimeToSeconds(q.timeBurdenSeconds ?? '') ?? null,
            options: optionsToSend.length > 0 ? optionsToSend : [{ answerText: '', answerExplanation: '', isAnswer: false }],
          }
        }),
      }
      return onSubmit(transformed as unknown as UcatQuestionStemFormValues)
    })()
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Create or update nested UCAT question stems"
      onSave={handleSave}
      saveLabel={submitLabel}
      saveDisabled={loading}
      isSaving={loading}
    >
      <div className="h-full overflow-y-auto">
        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          {/* Row 1: Stem text (left) | Properties (right) */}
          <div className="flex border-b">
            <section className="flex-1 min-w-0 p-6">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Stem text</span>
                <Textarea className="min-h-48" {...form.register('stemText')} />
              </label>
            </section>
            <aside className="w-80 flex-shrink-0 border-l p-6 space-y-4">
              <h2 className="font-semibold">Properties</h2>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Section</span>
                <Select
                  value={form.watch('sectionId')}
                  onValueChange={(value) => {
                    form.setValue('sectionId', value, { shouldDirty: true })
                    form.setValue('categoryId', null, { shouldDirty: true })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id ?? 'none'} value={section.id ?? ''}>
                        {section.name ?? 'Untitled'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Category</span>
                <Select
                  value={form.watch('categoryId') ?? 'none'}
                  onValueChange={(value) => form.setValue('categoryId', value === 'none' ? null : value, { shouldDirty: true })}
                  disabled={!sectionId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!sectionId ? 'Select section first' : undefined} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categoriesFiltered.map((category) => (
                      <SelectItem key={category.id ?? 'none'} value={category.id ?? ''}>
                        {category.name ?? 'Untitled'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Visibility</span>
                <Select
                  value={form.watch('isPrivate') ? 'private' : 'public'}
                  onValueChange={(value) => form.setValue('isPrivate', value === 'private', { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Type (all questions)</span>
                <Select
                  value={stemType ?? 'multiple_choice'}
                  onValueChange={(value: 'multiple_choice' | 'syllogism') => setStemType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="syllogism">Syllogism</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </aside>
          </div>

          {/* Rows 2..n: Question text + options (left) | tags, difficulty, time (right) */}
          {fields.map((field, questionIndex) => (
            <div key={field.id} className="flex border-b">
              <section className="flex-1 min-w-0 p-6 space-y-3">
                <h3 className="font-medium">Question {questionIndex + 1}</h3>
                <label className="block space-y-1 text-sm">
                  <span>Question text</span>
                  <Textarea className="min-h-16" {...form.register(`questions.${questionIndex}.questionText`)} />
                </label>
                <QuestionOptionsEditor form={form} questionIndex={questionIndex} stemType={stemType ?? 'multiple_choice'} />
              </section>
              <aside className="w-80 flex-shrink-0 border-l p-6 space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Tags</span>
                  <QuestionTagsSelect questionIndex={questionIndex} form={form} tags={tags} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Difficulty (0–1)</span>
                  <Input type="number" step="0.01" {...form.register(`questions.${questionIndex}.difficulty`)} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Time burden (mm:ss or seconds)</span>
                  <Input type="text" placeholder="e.g. 1:30 or 90" {...form.register(`questions.${questionIndex}.timeBurdenSeconds`)} />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(questionIndex)}
                  className="w-full justify-center border-destructive text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete question
                </Button>
              </aside>
            </div>
          ))}

          <div className="p-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  questionText: '',
                  questionType: stemType ?? 'multiple_choice',
                  difficulty: null,
                  timeBurdenSeconds: '',
                  tagIds: [],
                  options: [...DEFAULT_OPTIONS],
                })
              }
            >
              Add Question
            </Button>
          </div>
        </form>
      </div>
    </UcatDialogShell>
  )
}

function QuestionTagsSelect({
  questionIndex,
  form,
  tags,
}: {
  questionIndex: number
  form: UseFormReturn<UcatQuestionStemFormValues>
  tags: TagOption[]
}) {
  const [open, setOpen] = useState(false)
  const selectedIds = (form.watch(`questions.${questionIndex}.tagIds`) ?? []) as string[]
  const selectedTags = tags.filter((t) => selectedIds.includes(t.id))

  const toggleTag = (tagId: string) => {
    const next = selectedIds.includes(tagId)
      ? selectedIds.filter((id) => id !== tagId)
      : [...selectedIds, tagId]
    form.setValue(`questions.${questionIndex}.tagIds`, next, { shouldDirty: true })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start text-left font-normal min-h-9">
          {selectedTags.length === 0 ? 'Add tags...' : `${selectedTags.length} tag(s) selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tags..." />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => {
                const isSelected = selectedIds.includes(tag.id)
                return (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.id}-${tag.name}`}
                    onSelect={() => toggleTag(tag.id)}
                    className="flex items-center gap-2 text-foreground data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto"
                  >
                    <Checkbox checked={isSelected} />
                    <span>{tag.name}</span>
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

function QuestionOptionsEditor({
  form,
  questionIndex,
  stemType,
}: {
  form: UseFormReturn<UcatQuestionStemFormValues>
  questionIndex: number
  stemType: 'multiple_choice' | 'syllogism'
}) {
  const optionsArray = useFieldArray({ control: form.control, name: `questions.${questionIndex}.options` })

  const isMultipleChoice = stemType === 'multiple_choice'
  const optionsLabel = isMultipleChoice ? 'Answer options' : 'Statements'

  const correctIndex = optionsArray.fields.findIndex(
    (_, i) => form.watch(`questions.${questionIndex}.options.${i}.isAnswer`)
  )
  const correctValue = correctIndex >= 0 ? String(correctIndex) : ''

  const setCorrectIndex = (index: number) => {
    optionsArray.fields.forEach((_, i) => {
      form.setValue(`questions.${questionIndex}.options.${i}.isAnswer`, i === index, { shouldDirty: true })
    })
  }

  return (
    <div className="rounded border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{optionsLabel}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => optionsArray.append({ answerText: '', answerExplanation: '', isAnswer: false })}
        >
          Add
        </Button>
      </div>

      {isMultipleChoice ? (
        <RadioGroup value={correctValue} onValueChange={(v) => setCorrectIndex(Number(v))}>
          {optionsArray.fields.map((option, optionIndex) => (
            <div key={option.id} className="grid gap-2 md:grid-cols-[1fr,auto,auto] items-center">
              <Input
                placeholder="Option text"
                {...form.register(`questions.${questionIndex}.options.${optionIndex}.answerText`)}
              />
              <label htmlFor={`q-${questionIndex}-opt-${optionIndex}-correct`} className="flex items-center gap-2 shrink-0 cursor-pointer">
                <RadioGroupItem id={`q-${questionIndex}-opt-${optionIndex}-correct`} value={String(optionIndex)} />
                <span className="text-sm">Correct</span>
              </label>
              {optionsArray.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => optionsArray.remove(optionIndex)}
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </RadioGroup>
      ) : (
        optionsArray.fields.map((option, optionIndex) => (
          <div key={option.id} className="grid gap-2 md:grid-cols-[1fr,auto,auto] items-center">
            <Input
              placeholder="Statement"
              {...form.register(`questions.${questionIndex}.options.${optionIndex}.answerText`)}
            />
            <Tabs
              value={form.watch(`questions.${questionIndex}.options.${optionIndex}.isAnswer`) ? 'yes' : 'no'}
              onValueChange={(v) =>
                form.setValue(`questions.${questionIndex}.options.${optionIndex}.isAnswer`, v === 'yes', { shouldDirty: true })
              }
            >
              <TabsList className="h-9">
                <TabsTrigger value="yes" className="px-3 text-xs">Yes</TabsTrigger>
                <TabsTrigger value="no" className="px-3 text-xs">No</TabsTrigger>
              </TabsList>
            </Tabs>
            {optionsArray.fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => optionsArray.remove(optionIndex)}
                className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
