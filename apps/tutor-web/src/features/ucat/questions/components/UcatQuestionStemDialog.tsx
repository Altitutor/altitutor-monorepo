'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
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
  useToast,
} from '@altitutor/ui'
import { ExternalLink, Trash2 } from 'lucide-react'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'

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

export const EMPTY_DOC: Json = plainTextToProseMirror('')

export const DEFAULT_OPTIONS = [
  { answerText: EMPTY_DOC, answerExplanation: null, isAnswer: true },
  { answerText: EMPTY_DOC, answerExplanation: null, isAnswer: false },
  { answerText: EMPTY_DOC, answerExplanation: null, isAnswer: false },
  { answerText: EMPTY_DOC, answerExplanation: null, isAnswer: false },
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
  onDelete,
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
  onDelete?: () => void
}) {
  useToast()
  const [newImageFileIds, setNewImageFileIds] = useState<Set<string>>(new Set())
  const defaultValues = useMemo<UcatQuestionStemFormValues>(() => {
    if (!initial) {
      return {
        sectionId: sections.find((section) => section.id)?.id ?? '',
        categoryId: null,
        stemText: EMPTY_DOC,
        isPrivate: false,
        questions: [
          {
            questionText: EMPTY_DOC,
            questionType: 'multiple_choice',
            answerExplanation: null,
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
      stemText: (initial.stem_text ?? EMPTY_DOC) as Json,
      isPrivate: initial.is_private,
      questions: (initial.questions ?? []).map((question) => ({
        questionText: (question.question_text ?? EMPTY_DOC) as Json,
        answerExplanation: (question.answer_explanation ?? null) as Json | null,
        questionType: question.question_type,
        difficulty: question.difficulty,
        timeBurdenSeconds: question.time_burden_seconds != null ? secondsToTimeString(question.time_burden_seconds) : '',
        tagIds: (question.tags ?? []).map((tag) => tag.id),
        options:
          (question.answer_options ?? []).length > 0
            ? (question.answer_options ?? []).map((option) => ({
                answerText: (option.answer_text ?? EMPTY_DOC) as Json,
                answerExplanation: (option.answer_explanation ?? null) as Json | null,
                isAnswer: option.is_answer,
                imageFileId: option.image_file_id ?? null,
              }))
            : [...DEFAULT_OPTIONS],
      })),
    }
  }, [initial, sections])

  // Type instantiation for this large nested form can be deep; the schema
  // already validates the shape at runtime.
  // @ts-expect-error Type instantiation is deep but safe for this validated form.
  const form = useForm<UcatQuestionStemFormValues>({
    resolver: zodResolver(ucatQuestionStemSchema) as Resolver<UcatQuestionStemFormValues>,
    defaultValues,
  })

  // When editing, populate the form once the initial stem detail has loaded.
  useEffect(() => {
    if (initial) {
      form.reset(defaultValues)
    }
  }, [initial, defaultValues, form])

  // When opening for create (no initial), reset form so previous content is cleared
  useEffect(() => {
    if (open && !initial) {
      const emptyDefaults: UcatQuestionStemFormValues = {
        sectionId: sections.find((section) => section.id)?.id ?? '',
        categoryId: null,
        stemText: EMPTY_DOC,
        isPrivate: false,
        questions: [
          {
            questionText: EMPTY_DOC,
            questionType: 'multiple_choice',
            answerExplanation: null,
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


  async function handleSave() {
    await form.handleSubmit(async (values) => {
      await onSubmit(values)
      setNewImageFileIds(new Set())
    })()
  }

  const hasUnsavedChanges = form.formState.isDirty

  const stemId = initial?.id

  const headerActions =
    stemId != null
      ? (
          <UcatRowActions
            actions={[
              {
                label: 'Open in page',
                icon: <ExternalLink className="h-4 w-4" />,
                href: `/ucat/questions/${stemId}`,
              },
              ...(onDelete
                ? [
                    {
                      label: 'Delete',
                      icon: <Trash2 className="h-4 w-4" />,
                      onClick: onDelete,
                      destructive: true,
                    },
                  ]
                : []),
            ]}
          />
        )
      : null

  function handleRequestClose() {
    if (!hasUnsavedChanges || window.confirm('Changes made will be lost. Close without saving?')) {
      if (newImageFileIds.size > 0 && typeof window !== 'undefined') {
        const fileIds = Array.from(newImageFileIds)
        setNewImageFileIds(new Set())
        void fetch('/api/ucat/images/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds }),
        }).catch((error) => {
          console.error('Failed to schedule UCAT image cleanup on cancel:', error)
        })
      }
      onClose()
    }
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title={title}
      subtitle="Create or update nested UCAT question stems"
      onSave={handleSave}
      saveLabel={submitLabel}
      saveDisabled={loading}
      isSaving={loading}
      headerActions={headerActions}
      hideCancel
    >
      <UcatQuestionStemFormContent
        form={form}
        sections={sections}
        categories={categories}
        tags={tags}
        stemId={stemId ?? null}
        enableImages
        onNewImageFileIds={(fileIds) =>
          setNewImageFileIds((prev) => {
            const next = new Set(prev)
            fileIds.forEach((id) => next.add(id))
            return next
          })
        }
      />
    </UcatDialogShell>
  )
}

export function QuestionTagsSelect({
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

export function QuestionOptionsEditor({
  form,
  questionIndex,
  stemType,
  stemId,
  onNewImageFileIds,
}: {
  form: UseFormReturn<UcatQuestionStemFormValues>
  questionIndex: number
  stemType: 'multiple_choice' | 'syllogism'
  stemId?: string | null
  onNewImageFileIds: (fileIds: string[]) => void
}) {
  const optionsArray = useFieldArray({ control: form.control, name: `questions.${questionIndex}.options` })

  const isMultipleChoice = stemType === 'multiple_choice'
  const isSyllogism = stemType === 'syllogism'
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
        {!isSyllogism && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => optionsArray.append({ answerText: '', answerExplanation: '', isAnswer: false })}
          >
            Add
          </Button>
        )}
      </div>

      {isMultipleChoice ? (
        <RadioGroup value={correctValue} onValueChange={(v) => setCorrectIndex(Number(v))}>
          {optionsArray.fields.map((option, optionIndex) => (
            <div
              key={option.id}
              className="grid gap-2 md:grid-cols-[minmax(0,2fr),auto,minmax(0,2fr),auto] items-start"
            >
              <UcatRichTextEditor
                value={form.watch(
                  `questions.${questionIndex}.options.${optionIndex}.answerText`
                ) as Json}
                onChange={(val) =>
                  form.setValue(
                    `questions.${questionIndex}.options.${optionIndex}.answerText`,
                    val,
                    { shouldDirty: true }
                  )
                }
                minHeight="3rem"
                stemId={stemId ?? null}
                maxImagesPerDocument={1}
                onImageFileIdsChange={(fileIds) => {
                  form.setValue(
                    `questions.${questionIndex}.options.${optionIndex}.imageFileId`,
                    fileIds[0] ?? null,
                    { shouldDirty: true }
                  )
                  onNewImageFileIds(fileIds)
                }}
              />
              <label
                htmlFor={`q-${questionIndex}-opt-${optionIndex}-correct`}
                className="flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <RadioGroupItem id={`q-${questionIndex}-opt-${optionIndex}-correct`} value={String(optionIndex)} />
                <span className="text-sm">Correct</span>
              </label>
              <UcatRichTextEditor
                value={form.watch(
                  `questions.${questionIndex}.options.${optionIndex}.answerExplanation`
                ) as Json | null | undefined}
                onChange={(val) =>
                  form.setValue(
                    `questions.${questionIndex}.options.${optionIndex}.answerExplanation`,
                    val,
                    { shouldDirty: true }
                  )
                }
                minHeight="3rem"
                stemId={stemId ?? null}
                enableImages={false}
              />
              {optionsArray.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const option = form.getValues(
                      `questions.${questionIndex}.options.${optionIndex}`
                    )
                    const hasContent =
                      option &&
                      (trimTextParagraphs(proseMirrorToPlainText(option.answerText as Json) ?? '') !== '' ||
                        (option.answerExplanation &&
                          trimTextParagraphs(
                            proseMirrorToPlainText(option.answerExplanation as Json) ?? ''
                          ) !== ''))

                    if (
                      !hasContent ||
                      window.confirm(
                        'This will delete an answer option with content. Changes will be lost. Do you want to continue?'
                      )
                    ) {
                      optionsArray.remove(optionIndex)
                    }
                  }}
                  className="shrink-0 !text-destructive hover:!text-destructive hover:bg-destructive/10 self-center"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </RadioGroup>
      ) : (
        optionsArray.fields.map((option, optionIndex) => (
          <div
            key={option.id}
            className="grid gap-2 md:grid-cols-[minmax(0,2fr),auto,minmax(0,2fr),auto] items-start"
          >
            <UcatRichTextEditor
              value={form.watch(
                `questions.${questionIndex}.options.${optionIndex}.answerText`
              ) as Json}
              onChange={(val) =>
                form.setValue(
                  `questions.${questionIndex}.options.${optionIndex}.answerText`,
                  val,
                  { shouldDirty: true }
                )
              }
              minHeight="3rem"
              stemId={stemId ?? null}
              maxImagesPerDocument={1}
              onImageFileIdsChange={(fileIds) => {
                form.setValue(
                  `questions.${questionIndex}.options.${optionIndex}.imageFileId`,
                  fileIds[0] ?? null,
                  { shouldDirty: true }
                )
                onNewImageFileIds(fileIds)
              }}
            />
            <Tabs
              value={form.watch(`questions.${questionIndex}.options.${optionIndex}.isAnswer`) ? 'yes' : 'no'}
              onValueChange={(v) =>
                form.setValue(`questions.${questionIndex}.options.${optionIndex}.isAnswer`, v === 'yes', {
                  shouldDirty: true,
                })
              }
            >
              <TabsList className="h-9">
                <TabsTrigger value="yes" className="px-3 text-xs">
                  Yes
                </TabsTrigger>
                <TabsTrigger value="no" className="px-3 text-xs">
                  No
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <UcatRichTextEditor
              value={form.watch(
                `questions.${questionIndex}.options.${optionIndex}.answerExplanation`
              ) as Json | null | undefined}
              onChange={(val) =>
                form.setValue(
                  `questions.${questionIndex}.options.${optionIndex}.answerExplanation`,
                  val,
                  { shouldDirty: true }
                )
              }
              minHeight="3rem"
              stemId={stemId ?? null}
              enableImages={false}
            />
            {!isSyllogism && optionsArray.fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const option = form.getValues(
                    `questions.${questionIndex}.options.${optionIndex}`
                  )
                  const hasContent =
                    option &&
                    (trimTextParagraphs(proseMirrorToPlainText(option.answerText as Json) ?? '') !== '' ||
                      (option.answerExplanation &&
                        trimTextParagraphs(
                          proseMirrorToPlainText(option.answerExplanation as Json) ?? ''
                        ) !== ''))

                  if (
                    !hasContent ||
                    window.confirm(
                      'This will delete an answer option with content. Changes will be lost. Do you want to continue?'
                    )
                  ) {
                    optionsArray.remove(optionIndex)
                  }
                }}
                className="shrink-0 !text-destructive hover:!text-destructive hover:bg-destructive/10 self-center"
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

export type UcatQuestionStemFormContentProps = {
  form: UseFormReturn<UcatQuestionStemFormValues>
  sections: Array<{ id: string | null; name: string | null }>
  categories: CategoryOption[]
  tags: TagOption[]
  stemId?: string | null
  enableImages?: boolean
  onNewImageFileIds?: (fileIds: string[]) => void
}

export function UcatQuestionStemFormContent({
  form,
  sections,
  categories,
  tags,
  stemId,
  enableImages = true,
  onNewImageFileIds,
}: UcatQuestionStemFormContentProps) {
  const { toast } = useToast()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'questions' })

  const sectionId = form.watch('sectionId')
  const categoriesFiltered = useMemo(
    () => (sectionId ? categories.filter((c) => (c.ucat_section_id ?? null) === sectionId) : []),
    [categories, sectionId]
  )

  const stemType = form.watch('questions.0.questionType') as 'multiple_choice' | 'syllogism' | undefined

  useEffect(() => {
    if (stemType !== 'syllogism') return

    const decisionMakingSection = sections.find((section) => section.name === 'Decision Making')
    if (decisionMakingSection?.id && form.watch('sectionId') !== decisionMakingSection.id) {
      form.setValue('sectionId', decisionMakingSection.id, { shouldDirty: true })
    }

    const sectionIdForCategory = decisionMakingSection?.id ?? form.watch('sectionId')
    if (!sectionIdForCategory) return

    const syllogismsCategory = categories.find((category) => {
      const rawName = (category.name ?? '').toLowerCase().trim()
      const normalizedName = rawName.replace(/\\+$/g, '')
      return normalizedName.startsWith('syllogism') && (category.ucat_section_id ?? null) === sectionIdForCategory
    })

    if (syllogismsCategory?.id && form.watch('categoryId') !== syllogismsCategory.id) {
      form.setValue('categoryId', syllogismsCategory.id, { shouldDirty: true })
    }
  }, [stemType, sections, categories, form])

  function setStemType(value: 'multiple_choice' | 'syllogism') {
    const currentStemType = stemType ?? 'multiple_choice'
    if (currentStemType === value) return

    if (value === 'syllogism') {
      const currentQuestions = form.getValues('questions') ?? []
      const firstQuestion =
        currentQuestions[0] ?? {
          questionText: EMPTY_DOC,
          questionType: 'multiple_choice' as const,
          difficulty: null,
          timeBurdenSeconds: '',
          tagIds: [],
          options: [...DEFAULT_OPTIONS],
        }

      const hasQuestionText =
        trimTextParagraphs(proseMirrorToPlainText(firstQuestion.questionText as Json) ?? '') !== ''
      const hasOptionContent = (firstQuestion.options ?? []).some(
        (opt) =>
          trimTextParagraphs(proseMirrorToPlainText(opt.answerText as Json) ?? '') !== '' ||
          trimTextParagraphs(
            opt.answerExplanation ? proseMirrorToPlainText(opt.answerExplanation as Json) ?? '' : ''
          ) !== ''
      )

      const otherQuestionsHaveData = currentQuestions.slice(1).some((question) => {
        const hasOtherQuestionText =
          trimTextParagraphs(proseMirrorToPlainText(question.questionText as Json) ?? '') !== ''
        const hasOtherOptionContent = (question.options ?? []).some(
          (opt) =>
            trimTextParagraphs(proseMirrorToPlainText(opt.answerText as Json) ?? '') !== '' ||
            trimTextParagraphs(
              opt.answerExplanation ? proseMirrorToPlainText(opt.answerExplanation as Json) ?? '' : ''
            ) !== ''
        )
        return hasOtherQuestionText || hasOtherOptionContent
      })

      const willRemoveData = hasQuestionText || hasOptionContent || otherQuestionsHaveData

      if (willRemoveData) {
        const confirmed =
          typeof window !== 'undefined'
            ? window.confirm(
                'Switching the type to "Syllogism" will reset questions and statements and remove existing question text and options. Do you want to continue?'
              )
            : false

        if (!confirmed) {
          return
        }
      }

      const syllogismTemplateQuestion = {
        ...firstQuestion,
        questionType: 'syllogism' as const,
        questionText: plainTextToProseMirror(
          'Place ‘Yes’ if the conclusion does follow. Place ‘No’ if the conclusion does not follow.'
        ) as Json,
        options: Array.from({ length: 5 }, () => ({
          answerText: EMPTY_DOC,
          answerExplanation: null,
          isAnswer: false,
        })),
      }

      form.setValue('questions', [syllogismTemplateQuestion], { shouldDirty: true })
      return
    }

    const currentQuestions = form.getValues('questions') ?? []
    currentQuestions.forEach((_, i) => {
      form.setValue(`questions.${i}.questionType`, value, { shouldDirty: true })
    })
  }

  const handleNewImageFileIds = (fileIds: string[]) => {
    if (!onNewImageFileIds || !enableImages || fileIds.length === 0) return
    onNewImageFileIds(fileIds)
  }

  return (
    <div className="h-full overflow-y-auto">
      <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
        {/* Row 1: Stem text (left) | Properties (right) */}
        <div className="flex border-b">
          <section className="flex-1 min-w-0 p-6">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Stem text</span>
              <UcatRichTextEditor
                value={form.watch('stemText') as Json}
                onChange={(val) => form.setValue('stemText', val, { shouldDirty: true })}
                minHeight="12rem"
                stemId={enableImages ? stemId ?? null : null}
                enableImages={enableImages}
                onImageFileIdsChange={handleNewImageFileIds}
              />
            </label>
          </section>
          <aside className="w-80 flex-shrink-0 border-l p-6 space-y-4">
            <h2 className="font-semibold">Properties</h2>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Section</span>
              <Select
                value={form.watch('sectionId')}
                onValueChange={(value) => {
                  if (stemType === 'syllogism') {
                    toast({
                      description: 'Section is locked for syllogism stems.',
                      variant: 'destructive',
                    })
                    return
                  }
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
                onValueChange={(value) => {
                  if (stemType === 'syllogism') {
                    toast({
                      description: 'Category is locked for syllogism stems.',
                      variant: 'destructive',
                    })
                    return
                  }
                  form.setValue('categoryId', value === 'none' ? null : value, { shouldDirty: true })
                }}
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
                <UcatRichTextEditor
                  value={form.watch(`questions.${questionIndex}.questionText`) as Json}
                  onChange={(val) =>
                    form.setValue(`questions.${questionIndex}.questionText`, val, { shouldDirty: true })
                  }
                  minHeight="4rem"
                  stemId={enableImages ? stemId ?? null : null}
                  enableImages={enableImages}
                  onImageFileIdsChange={handleNewImageFileIds}
                />
              </label>
              <QuestionOptionsEditor
                form={form}
                questionIndex={questionIndex}
                stemType={stemType ?? 'multiple_choice'}
                stemId={enableImages ? stemId : null}
                onNewImageFileIds={handleNewImageFileIds}
              />
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
                <Input
                  type="text"
                  placeholder="e.g. 1:30 or 90"
                  {...form.register(`questions.${questionIndex}.timeBurdenSeconds`)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Answer explanation</span>
                <UcatRichTextEditor
                  value={form.watch(`questions.${questionIndex}.answerExplanation`) as Json | null | undefined}
                  onChange={(val) =>
                    form.setValue(`questions.${questionIndex}.answerExplanation`, val, { shouldDirty: true })
                  }
                  minHeight="3rem"
                  stemId={enableImages ? stemId ?? null : null}
                  enableImages={false}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const questions = form.getValues('questions') ?? []
                  const question = questions[questionIndex]

                  const hasQuestionText =
                    question &&
                    trimTextParagraphs(
                      proseMirrorToPlainText((question.questionText as Json) ?? EMPTY_DOC) ?? ''
                    ) !== ''
                  const hasOptionContent =
                    question &&
                    (question.options ?? []).some((opt) => {
                      const answerText = trimTextParagraphs(
                        proseMirrorToPlainText((opt.answerText as Json) ?? EMPTY_DOC) ?? ''
                      )
                      const answerExplanation = opt.answerExplanation
                        ? trimTextParagraphs(
                            proseMirrorToPlainText((opt.answerExplanation as Json) ?? EMPTY_DOC) ?? ''
                          )
                        : ''
                      return answerText !== '' || answerExplanation !== ''
                    })

                  if (!hasQuestionText && !hasOptionContent) {
                    remove(questionIndex)
                    return
                  }

                  if (
                    window.confirm(
                      'This will delete a question with content. Changes will be lost. Do you want to continue?'
                    )
                  ) {
                    remove(questionIndex)
                  }
                }}
                className="w-full justify-center border-destructive !text-destructive hover:!text-destructive hover:bg-destructive/10"
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
                questionText: EMPTY_DOC,
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
  )
}
