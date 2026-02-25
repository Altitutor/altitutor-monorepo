'use client'

import { useMemo, useState } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@altitutor/ui'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'

export type CategoryOption = { id: string | null; name: string | null; ucat_section_id?: string | null }
export type TagOption = { id: string; name: string }

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
            options: [
              { answerText: '', answerExplanation: '', isAnswer: true },
              { answerText: '', answerExplanation: '', isAnswer: false },
            ],
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
        options: (question.answer_options ?? []).map((option) => ({
          answerText: proseMirrorToPlainText(option.answer_text),
          answerExplanation: proseMirrorToPlainText(option.answer_explanation),
          isAnswer: option.is_answer,
        })),
      })),
    }
  }, [initial, sections])

  const form = useForm<UcatQuestionStemFormValues>({
    resolver: zodResolver(ucatQuestionStemSchema) as Resolver<UcatQuestionStemFormValues>,
    defaultValues,
    values: defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })

  const sectionId = form.watch('sectionId')
  const categoriesFiltered = useMemo(
    () => (sectionId ? categories.filter((c) => (c.ucat_section_id ?? null) === sectionId) : []),
    [categories, sectionId]
  )

  async function handleSave() {
    await form.handleSubmit((values) => {
      const transformed = {
        ...values,
        questions: values.questions.map((q: { timeBurdenSeconds?: string | null }) => ({
          ...q,
          timeBurdenSeconds: parseTimeToSeconds(q.timeBurdenSeconds ?? '') ?? null,
        })),
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
      <div className="p-6 overflow-y-auto h-full">
      <form className="space-y-4" onSubmit={form.handleSubmit((data) => onSubmit(data))}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
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

          <label className="space-y-1 text-sm">
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
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Stem Text</span>
          <Textarea className="min-h-20" {...form.register('stemText')} />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch('isPrivate')}
            onCheckedChange={(checked) => form.setValue('isPrivate', checked === true, { shouldDirty: true })}
          />
          Private question stem
        </label>

        <div className="space-y-4">
          {fields.map((field, questionIndex) => (
            <div key={field.id} className="rounded border p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Question {questionIndex + 1}</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => remove(questionIndex)}>
                  Remove
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm md:col-span-2">
                  <span>Question text</span>
                  <Textarea className="min-h-16" {...form.register(`questions.${questionIndex}.questionText`)} />
                </label>

                <label className="space-y-1 text-sm">
                  <span>Tags</span>
                  <QuestionTagsSelect
                    questionIndex={questionIndex}
                    form={form}
                    tags={tags}
                  />
                </label>
                <div className="space-y-2">
                  <label className="space-y-1 text-sm">
                    <span>Type</span>
                    <Select
                      value={form.watch(`questions.${questionIndex}.questionType`) as 'multiple_choice' | 'syllogism'}
                      onValueChange={(value: 'multiple_choice' | 'syllogism') =>
                        form.setValue(`questions.${questionIndex}.questionType`, value, { shouldDirty: true })
                      }
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
                  <label className="space-y-1 text-sm">
                    <span>Difficulty (0-1)</span>
                    <Input type="number" step="0.01" {...form.register(`questions.${questionIndex}.difficulty`)} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Time burden (mm:ss or seconds)</span>
                    <Input type="text" placeholder="e.g. 1:30 or 90" {...form.register(`questions.${questionIndex}.timeBurdenSeconds`)} />
                  </label>
                </div>
              </div>

              <QuestionOptionsEditor form={form} questionIndex={questionIndex} />
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({
              questionText: '',
              questionType: 'multiple_choice',
              difficulty: null,
              timeBurdenSeconds: '',
              tagIds: [],
              options: [
                { answerText: '', answerExplanation: '', isAnswer: true },
                { answerText: '', answerExplanation: '', isAnswer: false },
              ],
            })
          }
        >
          Add Question
        </Button>
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
                    value={tag.name}
                    onSelect={() => toggleTag(tag.id)}
                    className="flex items-center gap-2"
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
}: {
  form: UseFormReturn<UcatQuestionStemFormValues>
  questionIndex: number
}) {
  const optionsArray = useFieldArray({ control: form.control, name: `questions.${questionIndex}.options` })

  return (
    <div className="mt-3 space-y-2 rounded border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Options / Statements</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => optionsArray.append({ answerText: '', answerExplanation: '', isAnswer: false })}
        >
          Add Option
        </Button>
      </div>

      {optionsArray.fields.map((option, optionIndex) => (
        <div key={option.id} className="grid gap-2 md:grid-cols-[1fr,150px,120px]">
          <Input
            placeholder="Option / statement"
            {...form.register(`questions.${questionIndex}.options.${optionIndex}.answerText`)}
          />
          <label className="inline-flex items-center gap-2 rounded border px-3 text-sm">
            <Checkbox
              checked={form.watch(`questions.${questionIndex}.options.${optionIndex}.isAnswer`) as boolean}
              onCheckedChange={(checked) =>
                form.setValue(`questions.${questionIndex}.options.${optionIndex}.isAnswer`, checked === true, {
                  shouldDirty: true,
                })
              }
            />
            Correct / Yes
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => optionsArray.remove(optionIndex)}>
            Remove
          </Button>
        </div>
      ))}
    </div>
  )
}
