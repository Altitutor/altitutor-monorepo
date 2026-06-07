'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Json } from '@altitutor/shared'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
} from '@altitutor/ui'
import { ExternalLink, Trash2 } from 'lucide-react'
import { cn } from '@/shared/utils'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import { isSnapshotDirty, snapshotQuestionStemFormValues } from '@/features/ucat/shared/lib/dirty-state'
import { secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'

/** Get the first validation error message from react-hook-form errors (supports nested paths). */
function getFirstValidationMessage(errors: Record<string, unknown>): string {
  for (const key of Object.keys(errors)) {
    const value = errors[key]
    if (value && typeof value === 'object' && 'message' in value && typeof (value as { message: unknown }).message === 'string') {
      return (value as { message: string }).message
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = getFirstValidationMessage(value as Record<string, unknown>)
      if (nested) return nested
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const nested = getFirstValidationMessage(item as Record<string, unknown>)
          if (nested) return nested
        }
      }
    }
  }
  return 'Please fix the errors in the form.'
}

export type CategoryOption = { id: string | null; name: string | null; ucat_section_id?: string | null }
export type TagOption = { id: string; name: string }

/** Section row for the stem form + engine preview layout (two-column vs single column). */
export type UcatSectionOption = { id: string | null; name: string | null; display_columns?: number | null }

export { EMPTY_DOC, DEFAULT_OPTIONS } from '@/features/ucat/questions/constants/stemFormConstants'

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
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  initial?: StemDetailRow | null
  loading?: boolean
  onDelete?: () => void
}) {
  const { toast } = useToast()
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
              }))
            : [...DEFAULT_OPTIONS],
      })),
    }
  }, [initial, sections])

  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues,
  })

  // Baseline for semantic dirty check (avoids ProseMirror JSON structural false positives)
  const [baseline, setBaseline] = useState<string>('')

  // When editing, populate the form once the initial stem detail has loaded.
  // Only reset when opening a different stem—not when a refetch returns for the same stem.
  // A refetch during save would overwrite user edits with stale data before the mutation completes.
  const lastResetStemIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (initial) {
      const stemId = initial.id
      if (lastResetStemIdRef.current !== stemId) {
        lastResetStemIdRef.current = stemId
        form.reset(defaultValues)
        setBaseline(snapshotQuestionStemFormValues(defaultValues))
      }
    } else {
      lastResetStemIdRef.current = null
    }
  }, [initial, defaultValues, form])

  // When dialog closes: reset stem ref
  useEffect(() => {
    if (!open) {
      lastResetStemIdRef.current = null
    }
  }, [open])

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
      setBaseline(snapshotQuestionStemFormValues(emptyDefaults))
    }
  }, [open, initial, sections, form])


  async function handleSave() {
    // @ts-expect-error TS2589 - Form type is deep; runtime behavior is correct.
    form.handleSubmit(
      async (values) => {
        try {
          // Deep copy to avoid form state mutations (e.g. reset) overwriting values before API call
          const valuesCopy = JSON.parse(JSON.stringify(values)) as UcatQuestionStemFormValues
          await onSubmit(valuesCopy)
          setNewImageFileIds(new Set())
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to save question stem'
          const parsed = parseUcatVisibilityError(msg)
          toast({
            title: 'Failed to save',
            description: parsed.link ? (
              <span>
                {parsed.textBeforeLink}{' '}
                <Link href={parsed.link.href} className="underline font-medium">
                  {parsed.link.label}
                </Link>
              </span>
            ) : (
              msg
            ),
            variant: 'destructive',
          })
        }
      },
      (errs: Record<string, unknown>) => {
        const firstMessage = getFirstValidationMessage(errs)
        toast({
          title: 'Validation failed',
          description: firstMessage,
          variant: 'destructive',
        })
      }
    )()
  }

  const watchedValues = form.watch()
  const hasUnsavedChanges =
    baseline !== '' && isSnapshotDirty(snapshotQuestionStemFormValues(watchedValues), baseline)

  const stemId = initial?.id

  const headerActions = (
    <div className="flex items-center gap-2">
      {stemId != null ? (
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
      ) : null}
    </div>
  )

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
      defaultExpanded
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UcatStemEditorShell
          flush
          form={form}
          sections={sections}
          categories={categories}
          tags={tags}
          stemId={stemId ?? null}
          enableImages
          sectionTitleOverride={initial?.section_name ?? undefined}
          displayColumnsFallback={initial?.display_columns ?? undefined}
          onNewImageFileIds={(fileIds) =>
            setNewImageFileIds((prev) => {
              const next = new Set(prev)
              fileIds.forEach((id) => next.add(id))
              return next
            })
          }
        />
      </div>
    </UcatDialogShell>
  )
}

export function QuestionTagsSelect({
  questionIndex,
  form,
  tags,
  compact = false,
}: {
  questionIndex: number
  form: UseFormReturn<UcatQuestionStemFormValues>
  tags: TagOption[]
  compact?: boolean
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
        <Button
          type="button"
          variant="outline"
          className={cn(
            'justify-start text-left font-normal min-h-9',
            compact ? 'w-full truncate px-2 text-xs' : 'w-full'
          )}
        >
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
                    className="flex items-center gap-2 text-brand-darkBlue dark:text-white data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto aria-selected:bg-muted aria-selected:text-brand-darkBlue dark:aria-selected:bg-muted/50 dark:aria-selected:text-white hover:bg-muted dark:hover:bg-muted/50"
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
