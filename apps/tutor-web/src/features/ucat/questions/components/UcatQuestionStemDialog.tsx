'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import Link from 'next/link'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  useToast,
} from '@altitutor/ui'
import { ExternalLink, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/shared/utils'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { ucatQuestionsApi, type StemDetailRow } from '@/features/ucat/questions/api/questions'
import type { UcatContentStatus } from '@/features/ucat/shared/types'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import { buildEmptyStemFormValues, parseContentStatusFromSnapshot, stemDetailToFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import { useSetUcatQuestionStemStatus } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { isSnapshotDirty, snapshotQuestionStemFormValues } from '@/features/ucat/shared/lib/dirty-state'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, buildStemCopyIdEntries } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import type { StemEditorMode } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import { taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { filterTagsForImportSection } from '@/features/ucat/shared/lib/taxonomy-reparent'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  inferManualStemMetadataRecommendation,
  type ManualStemMetadataRecommendation,
} from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import { lifecycleStatusSuccessToast } from '@/features/ucat/shared/lifecycle-errors'

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

export type CategoryOption = {
  id: string | null
  name: string | null
  ucat_section_id?: string | null
  label?: string | null
}
export type TagOption = {
  id: string
  name: string
  label?: string | null
  parent_question_tag_id?: string | null
  ucat_section_id?: string | null
}

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
  initialQuestionIndex,
  initialEditorMode = 'edit',
  readOnly = false,
  warningPills,
}: {
  open: boolean
  title: string
  submitLabel: string
  onClose: () => void
  onSubmit: (values: UcatQuestionStemFormValues, options?: { createMore?: boolean }) => Promise<void>
  sections: UcatSectionOption[]
  categories: CategoryOption[]
  tags: TagOption[]
  initial?: StemDetailRow | null
  loading?: boolean
  onDelete?: () => void
  initialQuestionIndex?: number
  initialEditorMode?: StemEditorMode
  readOnly?: boolean
  warningPills?: string[]
}) {
  const { toast } = useToast()
  const { copyId } = useUcatCopyId()
  const statusMutation = useSetUcatQuestionStemStatus()
  const [newImageFileIds, setNewImageFileIds] = useState<Set<string>>(new Set())
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [createMore, setCreateMore] = useState(false)
  const [metadataRecommendation, setMetadataRecommendation] =
    useState<ManualStemMetadataRecommendation | null>(null)
  const lastAutoAppliedMetadataSignatureRef = useRef<string | null>(null)
  const lastMetadataRecommendationSnapshotRef = useRef<string | null>(null)
  const defaultValues = useMemo<UcatQuestionStemFormValues>(() => {
    const fallbackSectionId = sections.find((section) => section.id)?.id ?? ''
    if (!initial) return buildEmptyStemFormValues(fallbackSectionId)
    return stemDetailToFormValues(initial, fallbackSectionId)
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
  const createResetOpenRef = useRef(false)
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
      setActiveTextEditor(null)
      setCreateMore(false)
      setMetadataRecommendation(null)
      lastAutoAppliedMetadataSignatureRef.current = null
      lastMetadataRecommendationSnapshotRef.current = null
      createResetOpenRef.current = false
    }
  }, [open])

  // When opening for create (no initial), reset form so previous content is cleared
  useEffect(() => {
    if (open && !initial && !createResetOpenRef.current) {
      createResetOpenRef.current = true
      const emptyDefaults: UcatQuestionStemFormValues = {
        sectionId: sections.find((section) => section.id)?.id ?? '',
        categoryId: null,
        stemText: EMPTY_DOC,
        accessScope: 'public',
        tutorSourceNote: '',
        questions: [
          {
            questionText: EMPTY_DOC,
            questionType: 'multiple_choice',
            answerExplanation: null,
            difficulty: null,
            timeBurdenSeconds: '',
            tagIds: [],
            sourceChannel: 'individual',
            aiGenerationMetadata: null,
            options: [...DEFAULT_OPTIONS],
          },
        ],
      }
      form.reset(emptyDefaults)
      setBaseline(snapshotQuestionStemFormValues(emptyDefaults))
    }
  }, [open, initial, sections, form])

  function buildNextCreateValues(values: UcatQuestionStemFormValues): UcatQuestionStemFormValues {
    const nextValues = buildEmptyStemFormValues(values.sectionId)
    const previousQuestions = values.questions?.length ? values.questions : nextValues.questions
    const nextQuestions = previousQuestions.map((question) => {
      const questionType = question.questionType ?? 'multiple_choice'
      return {
        ...nextValues.questions[0]!,
        questionType,
        questionText:
          questionType === 'syllogism'
            ? question.questionText
            : EMPTY_DOC,
        answerExplanation: null,
        difficulty: question.difficulty ?? null,
        timeBurdenSeconds: question.timeBurdenSeconds ?? '',
        tagIds: [...(question.tagIds ?? [])],
        sourceChannel: 'individual' as const,
        aiGenerationMetadata: null,
        options:
          questionType === 'syllogism'
            ? Array.from({ length: 5 }, () => ({
                answerText: EMPTY_DOC,
                answerExplanation: null,
                isAnswer: false,
              }))
            : [...DEFAULT_OPTIONS],
      }
    })
    return {
      ...nextValues,
      categoryId: values.categoryId ?? null,
      accessScope: values.accessScope,
      tutorSourceNote: values.tutorSourceNote ?? '',
      questions: nextQuestions,
    }
  }

  function buildMetadataDetectionSignature(values: UcatQuestionStemFormValues): string {
    return JSON.stringify({
      stemText: proseMirrorToPlainText(values.stemText) ?? '',
      questions: (values.questions ?? []).map((question) => ({
        questionText: proseMirrorToPlainText(question.questionText) ?? '',
        options: (question.options ?? []).map((option) => proseMirrorToPlainText(option.answerText) ?? ''),
      })),
    })
  }

  const sameIds = useCallback((left: string[], right: string[]): boolean => {
    if (left.length !== right.length) return false
    const leftSorted = [...left].sort()
    const rightSorted = [...right].sort()
    return leftSorted.every((id, index) => id === rightSorted[index])
  }, [])

  const applyMetadataRecommendation = useCallback(
    (
      recommendation: ManualStemMetadataRecommendation,
      values: UcatQuestionStemFormValues
    ): boolean => {
      const previous = {
        sectionId: values.sectionId,
        categoryId: values.categoryId ?? null,
        questionTypes: (values.questions ?? []).map((question) => question.questionType),
        tagIdsByQuestionIndex: Object.fromEntries(
          (values.questions ?? []).map((question, index) => [index, [...(question.tagIds ?? [])]])
        ) as Record<number, string[]>,
      }
      let changed = false

      if (recommendation.sectionId && recommendation.sectionId !== values.sectionId) {
        form.setValue('sectionId', recommendation.sectionId, { shouldDirty: true })
        changed = true
      }
      if (recommendation.categoryId && recommendation.categoryId !== (values.categoryId ?? null)) {
        form.setValue('categoryId', recommendation.categoryId, { shouldDirty: true })
        changed = true
      }
      if (recommendation.questionType) {
        const questionType = recommendation.questionType
        ;(values.questions ?? []).forEach((question, index) => {
          if (question.questionType !== questionType) {
            form.setValue(`questions.${index}.questionType`, questionType, { shouldDirty: true })
            changed = true
          }
        })
      }
      Object.entries(recommendation.tagIdsByQuestionIndex).forEach(([indexText, tagIds]) => {
        const index = Number(indexText)
        const current = values.questions?.[index]?.tagIds ?? []
        if (!sameIds(current, tagIds)) {
          form.setValue(`questions.${index}.tagIds`, tagIds, { shouldDirty: true })
          changed = true
        }
      })

      if (!changed) return false

      toast({
        title: 'Detected UCAT metadata',
        description: 'Section, category, question type, or question tags were updated from the parser suggestion.',
        duration: 10_000,
        action: {
          label: 'Undo',
          onClick: () => {
            form.setValue('sectionId', previous.sectionId, { shouldDirty: true })
            form.setValue('categoryId', previous.categoryId, { shouldDirty: true })
            previous.questionTypes.forEach((questionType, index) => {
              form.setValue(`questions.${index}.questionType`, questionType, { shouldDirty: true })
            })
            Object.entries(previous.tagIdsByQuestionIndex).forEach(([indexText, tagIds]) => {
              const index = Number(indexText)
              form.setValue(`questions.${index}.tagIds`, tagIds, { shouldDirty: true })
            })
          },
        },
      })
      return true
    },
    [form, sameIds, toast]
  )

  async function handleSave() {
    const submit = form.handleSubmit as unknown as (
      onValid: (values: UcatQuestionStemFormValues) => Promise<void>,
      onInvalid: (errors: Record<string, unknown>) => void,
    ) => () => Promise<void>
    submit(
      async (values) => {
        try {
          // Deep copy to avoid form state mutations (e.g. reset) overwriting values before API call
          const valuesCopy = JSON.parse(JSON.stringify(values)) as UcatQuestionStemFormValues
          await onSubmit(valuesCopy, { createMore: !initial && createMore })
          if (stemId && valuesCopy.status) {
            const baselineStatus = parseContentStatusFromSnapshot(baseline)
            if (valuesCopy.status !== baselineStatus) {
              const nextStatus = valuesCopy.status as UcatContentStatus
              const previousStatus = baselineStatus ?? 'draft'
              await statusMutation.mutateAsync({
                stemId,
                status: nextStatus,
              })
              toast(lifecycleStatusSuccessToast({
                contentLabel: 'Question',
                count: 1,
                status: nextStatus,
                onUndo: () => {
                  void ucatQuestionsApi.bulkRestoreStatus([stemId], nextStatus, previousStatus)
                    .then(() => toast({ title: 'Question status restored' }))
                    .catch((error) => toast({
                      title: 'Could not undo status change',
                      description: error instanceof Error ? error.message : 'The previous status could not be restored.',
                      variant: 'destructive',
                    }))
                },
              }))
            }
          }
          setNewImageFileIds(new Set())
          if (!initial && createMore) {
            const nextValues = buildNextCreateValues(valuesCopy)
            form.reset(nextValues)
            setBaseline(snapshotQuestionStemFormValues(nextValues))
          }
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
  useEffect(() => {
    if (!open || initial) return
    const signature = buildMetadataDetectionSignature(watchedValues)
    const recommendation = inferManualStemMetadataRecommendation({
      values: watchedValues,
      sections,
      categories,
      tags,
    })
    const recommendationSnapshot = JSON.stringify(recommendation)
    if (lastMetadataRecommendationSnapshotRef.current !== recommendationSnapshot) {
      lastMetadataRecommendationSnapshotRef.current = recommendationSnapshot
      setMetadataRecommendation(recommendation)
    }
    if (!recommendation) return
    if (lastAutoAppliedMetadataSignatureRef.current === signature) return
    lastAutoAppliedMetadataSignatureRef.current = signature
    applyMetadataRecommendation(recommendation, watchedValues)
  }, [open, initial, watchedValues, sections, categories, tags, applyMetadataRecommendation])

  const hasUnsavedChanges =
    baseline !== '' && isSnapshotDirty(snapshotQuestionStemFormValues(watchedValues), baseline)

  const stemId = initial?.id
  const showCreateMore = !initial && !readOnly

  const copyIdAction =
    initial != null ? buildCopyIdRowAction(buildStemCopyIdEntries(initial), copyId) : null

  const headerActions = (
    <div className="flex items-center gap-2">
      {stemId != null ? (
        <UcatRowActions
          actions={[
            ...(copyIdAction ? [copyIdAction] : []),
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
      onSave={readOnly ? undefined : handleSave}
      saveLabel={submitLabel}
      saveDisabled={loading}
      isSaving={loading}
      footerActions={
        showCreateMore ? (
          <label htmlFor="create-more-stems" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch id="create-more-stems" checked={createMore} onCheckedChange={setCreateMore} />
            <span>Create more</span>
          </label>
        ) : undefined
      }
      headerActions={headerActions}
      warningPills={warningPills}
      hideCancel
      defaultExpanded
      mobileFullscreen
      richTextToolbarEditor={activeTextEditor}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UcatStemEditorShell
          flush
          form={form}
          sections={sections}
          categories={categories}
          tags={tags}
          stemId={stemId ?? null}
          initialQuestionIndex={initialQuestionIndex}
          initialEditorMode={initialEditorMode}
          enableImages
          sectionTitleOverride={initial?.section_name ?? undefined}
          displayColumnsFallback={initial?.display_columns ?? undefined}
          onActiveTextEditorChange={setActiveTextEditor}
          sourceChannel={initial?.source_channel ?? (initial ? null : 'individual')}
          aiGenerationMetadata={initial?.ai_generation_metadata ?? null}
          createdByFirstName={initial?.created_by_first_name ?? null}
          createdByLastName={initial?.created_by_last_name ?? null}
          statusChangedByFirstName={initial?.status_changed_by_first_name ?? null}
          statusChangedByLastName={initial?.status_changed_by_last_name ?? null}
          statusChangedAt={initial?.status_changed_at ?? null}
          onNewImageFileIds={(fileIds) =>
            setNewImageFileIds((prev) => {
              const next = new Set(prev)
              fileIds.forEach((id) => next.add(id))
              return next
            })
          }
          metadataRecommendation={showCreateMore ? metadataRecommendation : null}
          onDeleteStem={!readOnly ? onDelete : undefined}
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
  const sectionId = form.watch('sectionId')
  const watchedTagIds = form.watch(`questions.${questionIndex}.tagIds`)
  const selectedIds = useMemo(
    () => (watchedTagIds ?? []) as string[],
    [watchedTagIds]
  )
  const selectedTags = tags.filter((t) => selectedIds.includes(t.id))
  const selectableTags = useMemo(
    () => filterTagsForImportSection(tags, sectionId),
    [tags, sectionId]
  )
  const availableTags = useMemo(
    () => selectableTags.filter((tag) => !selectedIds.includes(tag.id)),
    [selectableTags, selectedIds]
  )

  const addTag = (tagId: string) => {
    if (selectedIds.includes(tagId)) return
    form.setValue(`questions.${questionIndex}.tagIds`, [...selectedIds, tagId], { shouldDirty: true })
    setOpen(false)
  }

  const removeTag = (tagId: string) => {
    const next = selectedIds.filter((id) => id !== tagId)
    form.setValue(`questions.${questionIndex}.tagIds`, next, { shouldDirty: true })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'text-xs' : 'text-sm')}>
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs font-medium text-foreground"
        >
          <span className="min-w-0 truncate">{taxonomyDisplayLabel(tag)}</span>
          <button
            type="button"
            aria-label={`Remove ${taxonomyDisplayLabel(tag)}`}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => removeTag(tag.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={selectedTags.length === 0 ? 'outline' : 'ghost'}
            size="sm"
            className={cn(
              'h-8 gap-1 rounded-full px-2.5 text-xs',
              selectedTags.length === 0 && 'w-full justify-start'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] flex max-h-[min(400px,80vh)] w-[340px] flex-col overflow-hidden p-0" align="start">
          <Command className="flex min-h-0 flex-1 flex-col rounded-lg border-0">
            <CommandInput placeholder="Search tags..." />
            <CommandList
              className="max-h-[min(300px,50vh)] overflow-y-auto overscroll-contain"
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {availableTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.id}-${taxonomyDisplayLabel(tag)}`}
                    onSelect={() => addTag(tag.id)}
                    className="flex items-center gap-2 text-brand-darkBlue dark:text-white aria-selected:bg-muted aria-selected:text-brand-darkBlue dark:aria-selected:bg-muted/50 dark:aria-selected:text-white hover:bg-muted dark:hover:bg-muted/50"
                  >
                    <span className="min-w-0 flex-1 truncate">{taxonomyDisplayLabel(tag)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
