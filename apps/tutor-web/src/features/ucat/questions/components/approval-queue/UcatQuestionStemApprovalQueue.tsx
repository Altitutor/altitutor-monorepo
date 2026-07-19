'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@altitutor/ui'
import { Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  useSetUcatQuestionStemStatus,
  useDeleteUcatQuestionStem,
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useManualStemMetadataDetection } from '@/features/ucat/questions/hooks/useManualStemMetadataDetection'
import { UcatStemEditorLoadingSkeleton } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorLoadingSkeleton'
import { UcatDetectedStemMetadataControl } from '@/features/ucat/questions/components/stem-editor/UcatDetectedStemMetadataControl'
import { UcatAiAssessmentControl } from '@/features/ucat/questions/components/stem-editor/UcatAiAssessmentControl'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import type { StemEditorFocusTarget } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatRichTextToolbar } from '@/features/ucat/shared/components/UcatRichTextToolbar'
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'
import { snapshotQuestionStemFormValues, isSnapshotDirty } from '@/features/ucat/shared/lib/dirty-state'
import { findMissingExplanations } from '@/features/ucat/questions/lib/ai-tools'
import {
  getFirstStemValidationMessage,
  persistStemFormValues,
  stemDetailToFormValues,
} from '@/features/ucat/questions/lib/stem-editor-form'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { fetchReconciliationData } from '@/features/ucat/reconciliation/api/reconciliation'
import { lifecycleStatusSuccessToast } from '@/features/ucat/shared/lifecycle-errors'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import { cn } from '@/shared/utils'
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from '@/shared/lib/tutor-visual'
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, buildStemCopyIdEntries } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'

export type UcatApprovalQueueEntry =
  | {
      stemId: string
      mode: 'ai_approval'
    }
  | {
      stemId: string
      mode: 'reconciliation'
      issueType: 'missing_category' | 'missing_explanation' | 'missing_tags' | 'missing_set'
      questionIndex?: number
      questionId?: string
    }

type SkipChoice = 'save' | 'discard' | null

export function UcatQuestionStemApprovalQueueDialog({
  open,
  title,
  entries,
  onClose,
}: {
  open: boolean
  title: string
  entries: UcatApprovalQueueEntry[]
  onClose: () => void
}) {
  const [snapshotEntries, setSnapshotEntries] = useState<UcatApprovalQueueEntry[]>([])
  const [expanded, setExpanded] = useState(true)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSnapshotEntries(entries)
      setExpanded(true)
    }
    if (!open) {
      setSnapshotEntries([])
    }
    wasOpenRef.current = open
  }, [open, entries])

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        className={cn(
          // Force height: DialogContent base uses sm:h-auto, which collapses during load.
          'flex !h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:!h-[92vh] md:max-w-6xl [&>button]:hidden',
          tutorDialogContentClass,
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
        )}
      >
        <UcatQuestionStemApprovalQueue
          title={title}
          entries={snapshotEntries}
          onExit={onClose}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((current) => !current)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function UcatQuestionStemApprovalQueuePage({
  title,
  entries,
  onExit,
}: {
  title: string
  entries: UcatApprovalQueueEntry[]
  onExit: () => void
}) {
  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[760px] flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
      <UcatQuestionStemApprovalQueue title={title} entries={entries} onExit={onExit} />
    </div>
  )
}

function UcatQuestionStemApprovalQueue({
  title,
  entries,
  onExit,
  expanded,
  onToggleExpanded,
}: {
  title: string
  entries: UcatApprovalQueueEntry[]
  onExit: () => void
  expanded?: boolean
  onToggleExpanded?: () => void
}) {
  const { toast } = useToast()
  const { copyId } = useUcatCopyId()
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)

  const currentEntry = entries[index] ?? null
  const initialActiveQuestionIndex =
    currentEntry?.mode === 'reconciliation' ? currentEntry.questionIndex ?? 0 : 0
  const detailQuery = useUcatQuestionDetail(currentEntry?.stemId ?? null)
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const updateMutation = useUpdateUcatQuestionStem()
  const statusMutation = useSetUcatQuestionStemStatus()
  const deleteMutation = useDeleteUcatQuestionStem()

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = useMemo(() => mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[], [categoriesQuery.data])
  const tags = useMemo(() => mapTagsToOptions(tagsQuery.data ?? []) as TagOption[], [tagsQuery.data])
  const defaultValues = useMemo(
    () => stemDetailToFormValues(detailQuery.data, sections.find((section) => section.id)?.id ?? ''),
    [detailQuery.data, sections],
  )

  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues,
  })
  const baselineRef = useRef('')

  useEffect(() => {
    if (!detailQuery.data) return
    form.reset(defaultValues)
    baselineRef.current = snapshotQuestionStemFormValues(defaultValues)
    setActiveTextEditor(null)
    setActiveQuestionIndex(initialActiveQuestionIndex)
  }, [detailQuery.data, defaultValues, form, initialActiveQuestionIndex])

  const watchedValues = form.watch()
  const isLoading =
    detailQuery.isLoading || sectionsQuery.isLoading || categoriesQuery.isLoading || tagsQuery.isLoading
  const isMutating = updateMutation.isPending || statusMutation.isPending || deleteMutation.isPending
  const isAiMode = currentEntry?.mode === 'ai_approval'
  const metadataDetection = useManualStemMetadataDetection({
    enabled: isAiMode && !isLoading && detailQuery.data != null,
    resetKey: currentEntry?.stemId ?? null,
    form,
    values: watchedValues,
    sections,
    categories,
    tags,
  })
  const hasUnsavedChanges =
    baselineRef.current !== '' && isSnapshotDirty(snapshotQuestionStemFormValues(watchedValues), baselineRef.current)
  const currentNumber = entries.length === 0 ? 0 : index + 1
  const progressLabel = `${currentNumber} of ${entries.length}`
  const queueComplete = entries.length > 0 && index >= entries.length
  const questionCount = watchedValues.questions?.length ?? 0
  const isLastAiQuestion = !isAiMode || questionCount <= 1 || activeQuestionIndex >= questionCount - 1
  const hasPreviousAiQuestion = isAiMode && activeQuestionIndex > 0
  const aiPrimaryLabel = isLastAiQuestion ? 'Publish' : 'Next question'

  const focus = getEntryFocus(currentEntry)
  const copyIdAction = detailQuery.data
    ? buildCopyIdRowAction(buildStemCopyIdEntries(detailQuery.data), copyId)
    : null

  function goNext() {
    setActiveTextEditor(null)
    setIndex((prev) => Math.min(prev + 1, entries.length))
  }

  async function invalidateQueueData(stemId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ucatKeys.question(stemId) }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTagIds() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.questionStemTypes() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() }),
    ])
  }

  async function saveCurrent(): Promise<boolean> {
    if (!currentEntry) return false
    let ok = false
    const submit = form.handleSubmit as unknown as (
      onValid: (values: UcatQuestionStemFormValues) => Promise<void>,
      onInvalid: (errors: Record<string, unknown>) => void,
    ) => () => Promise<void>
    await submit(
      async (values) => {
        baselineRef.current = await persistStemFormValues(currentEntry.stemId, values, {
          baselineSnapshot: baselineRef.current,
          updateStem: (payload) =>
            updateMutation.mutateAsync({ stemId: currentEntry.stemId, payload }),
          setStatus: (status) =>
            statusMutation.mutateAsync({ stemId: currentEntry.stemId, status }),
        })
        ok = true
      },
      (errors: Record<string, unknown>) => {
        toast({
          title: 'Validation failed',
          description: getFirstStemValidationMessage(errors),
          variant: 'destructive',
        })
      },
    )()
    return ok
  }

  async function validateReconciliationIssue(): Promise<boolean> {
    if (!currentEntry || currentEntry.mode !== 'reconciliation') return true
    const values = form.getValues()
    if (currentEntry.issueType === 'missing_category') {
      if (values.categoryId) return true
      toast({ title: 'Category still missing', description: 'Set a question stem category before moving to the next item.', variant: 'destructive' })
      return false
    }
    if (currentEntry.issueType === 'missing_tags') {
      const question = values.questions[currentEntry.questionIndex ?? 0]
      if ((question?.tagIds ?? []).length > 0) return true
      toast({ title: 'Tags still missing', description: 'Add at least one tag to the highlighted question before moving to the next item.', variant: 'destructive' })
      return false
    }
    if (currentEntry.issueType === 'missing_explanation') {
      const targetIndex = currentEntry.questionIndex ?? 0
      const stillMissing = findMissingExplanations(values).some((target) => target.questionIndex === targetIndex)
      if (!stillMissing) return true
      toast({ title: 'Explanation still missing', description: 'Add the highlighted question explanation before moving to the next item.', variant: 'destructive' })
      return false
    }
    if (currentEntry.issueType === 'missing_set') {
      const latest = await queryClient.fetchQuery({
        queryKey: ucatKeys.reconciliation(),
        queryFn: fetchReconciliationData,
      })
      const stillMissing = latest.privateStemsNotInSet.some((stem) => stem.id === currentEntry.stemId)
      if (!stillMissing) return true
      toast({ title: 'Set membership still missing', description: 'Add this private stem to a staff-authored set before moving to the next item.', variant: 'destructive' })
      return false
    }
    return true
  }

  async function handleApprove() {
    if (!currentEntry) return
    form.setValue('status', 'published', { shouldDirty: true })
    const saved = await saveCurrent()
    if (!saved) return
    const approvedStemId = currentEntry.stemId
    toast(lifecycleStatusSuccessToast({
      contentLabel: 'Question',
      count: 1,
      status: 'published',
      onUndo: () => {
        void ucatQuestionsApi.bulkRestoreStatus([approvedStemId], 'published', 'in_review')
          .then(async () => {
            await invalidateQueueData(approvedStemId)
            toast({ title: 'Question status restored' })
          })
          .catch((error) => toast({
            title: 'Could not undo status change',
            description: error instanceof Error ? error.message : 'The question could not be returned to review.',
            variant: 'destructive',
          }))
      },
    }))
    if (currentEntry.mode === 'ai_approval' && entries.length === 1) {
      await invalidateQueueData(currentEntry.stemId)
      onExit()
      return
    }
    goNext()
    void invalidateQueueData(currentEntry.stemId)
  }

  function handleAiPrimaryAction() {
    if (!isLastAiQuestion) {
      setActiveQuestionIndex((current) => Math.min(current + 1, Math.max(questionCount - 1, 0)))
      return
    }
    void handleApprove()
  }

  function handleAiPreviousQuestion() {
    setActiveQuestionIndex((current) => Math.max(current - 1, 0))
  }

  async function handleReject() {
    if (!currentEntry) return
    form.setValue('status', 'draft', { shouldDirty: true })
    const saved = await saveCurrent()
    if (!saved) return
    const rejectedStemId = currentEntry.stemId
    toast(lifecycleStatusSuccessToast({
      contentLabel: 'Question',
      count: 1,
      status: 'draft',
      onUndo: () => {
        void ucatQuestionsApi.bulkRestoreStatus([rejectedStemId], 'draft', 'in_review')
          .then(async () => {
            await invalidateQueueData(rejectedStemId)
            toast({ title: 'Question status restored' })
          })
          .catch((error) => toast({
            title: 'Could not undo status change',
            description: error instanceof Error ? error.message : 'The question could not be returned to review.',
            variant: 'destructive',
          }))
      },
    }))
    goNext()
    void invalidateQueueData(currentEntry.stemId)
  }

  async function handleSaveAndNext() {
    if (!currentEntry) return
    const saved = await saveCurrent()
    if (!saved) return
    if (!(await validateReconciliationIssue())) return
    goNext()
    void invalidateQueueData(currentEntry.stemId)
  }

  function handleSkip() {
    if (hasUnsavedChanges) {
      setSkipDialogOpen(true)
      return
    }
    goNext()
  }

  async function applySkip(choice: SkipChoice) {
    if (!currentEntry || choice == null) return
    setSkipDialogOpen(false)
    if (choice === 'save') {
      const saved = await saveCurrent()
      if (!saved) return
      void invalidateQueueData(currentEntry.stemId)
    }
    goNext()
  }

  function requestExit() {
    if (hasUnsavedChanges) setCloseDialogOpen(true)
    else onExit()
  }

  async function handleDeleteStem() {
    if (!currentEntry) return
    const stemId = currentEntry.stemId
    await deleteMutation.mutateAsync(stemId)
    setDeleteDialogOpen(false)
    toast({ title: 'Question stem deleted' })
    goNext()
    void invalidateQueueData(stemId)
  }

  return (
    <>
      <DialogHeader className={cn('flex-shrink-0 px-6 py-4', tutorDialogHeaderStrip)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="outline" size="icon" onClick={requestExit} className={tutorBtnIconOutline}>
              <X className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {entries.length === 0 ? 'No stems in this queue.' : queueComplete ? 'Queue complete.' : progressLabel}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {currentEntry ? (
              <UcatAiAssessmentControl
                stemId={currentEntry.stemId}
                form={form}
                activeQuestionIndex={activeQuestionIndex}
              />
            ) : null}
            {isAiMode ? (
              <UcatDetectedStemMetadataControl
                pendingDiff={metadataDetection.pendingDiff}
                sections={sections}
                categories={categories}
                tags={tags}
                onAccept={metadataDetection.accept}
                onDismiss={metadataDetection.dismiss}
              />
            ) : null}
            {onToggleExpanded && expanded != null ? (
              <ExpandButton expanded={expanded} onToggle={onToggleExpanded} />
            ) : null}
            {currentEntry ? (
              <UcatRowActions
                actions={[
                  ...(copyIdAction ? [copyIdAction] : []),
                  {
                    label: 'Open in page',
                    href: `/ucat/questions/${currentEntry.stemId}`,
                  },
                  {
                    label: 'Delete',
                    icon: <Trash2 className="h-4 w-4" />,
                    onClick: () => setDeleteDialogOpen(true),
                    destructive: true,
                  },
                ]}
              />
            ) : null}
          </div>
        </div>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {entries.length === 0 || queueComplete || !currentEntry ? (
          <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
            <div>
              <p className="text-lg">{entries.length === 0 ? 'No matching stems found' : 'Queue complete'}</p>
            </div>
          </div>
        ) : isLoading ? (
          <UcatStemEditorLoadingSkeleton />
        ) : (
          <UcatStemEditorShell
            flush
            form={form}
            sections={sections.map((section) => ({
              id: section.id,
              name: section.name,
              display_columns: section.display_columns,
            }))}
            categories={categories}
            tags={tags}
            stemId={currentEntry.stemId}
            initialQuestionIndex={currentEntry.mode === 'reconciliation' ? currentEntry.questionIndex : activeQuestionIndex}
            initialEditorMode="edit"
            enableImages
            sectionTitleOverride={detailQuery.data?.section_name ?? undefined}
            displayColumnsFallback={detailQuery.data?.display_columns ?? undefined}
            onActiveTextEditorChange={setActiveTextEditor}
            onCurrentQuestionIndexChange={setActiveQuestionIndex}
            focusTarget={focus.target}
            focusMessage={focus.message}
            sourceChannel={detailQuery.data?.source_channel ?? null}
            aiGenerationMetadata={detailQuery.data?.ai_generation_metadata ?? null}
            createdByFirstName={detailQuery.data?.created_by_first_name ?? null}
            createdByLastName={detailQuery.data?.created_by_last_name ?? null}
            statusChangedByFirstName={detailQuery.data?.status_changed_by_first_name ?? null}
            statusChangedByLastName={detailQuery.data?.status_changed_by_last_name ?? null}
            statusChangedAt={detailQuery.data?.status_changed_at ?? null}
          />
        )}
      </div>

      <DialogFooter className={cn('flex-shrink-0 flex-row items-center gap-3 px-6 py-4 sm:justify-start', tutorDialogFooterStrip)}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!queueComplete && currentEntry && isAiMode ? (
            <Button type="button" variant="destructive" onClick={() => void handleReject()} disabled={isMutating}>
              Reject
            </Button>
          ) : null}
          {entries.length > 0 && !queueComplete && currentEntry ? (
            <Button type="button" variant="outline" className={tutorBtnOutline} onClick={handleSkip} disabled={isMutating}>
              Skip
            </Button>
          ) : null}
          {activeTextEditor ? (
            <div className="min-w-0 flex-1 overflow-x-auto">
              <UcatRichTextToolbar editor={activeTextEditor} />
            </div>
          ) : <div className="flex-1" />}
          {entries.length === 0 || queueComplete || !currentEntry ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" className={tutorBtnPrimary} onClick={onExit}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {isAiMode ? (
                <>
                  {hasPreviousAiQuestion ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={tutorBtnOutline}
                      onClick={handleAiPreviousQuestion}
                      disabled={isMutating}
                    >
                      Previous question
                    </Button>
                  ) : null}
                  <Button type="button" className={tutorBtnPrimary} onClick={handleAiPrimaryAction} disabled={isMutating}>
                    {aiPrimaryLabel}
                  </Button>
                </>
              ) : (
                <Button type="button" className={tutorBtnPrimary} onClick={() => void handleSaveAndNext()} disabled={isMutating}>
                  Save and next
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogFooter>

      <AlertDialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip with unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Save this stem before skipping, or discard the edits and move to the next item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => void applySkip('discard')}>Discard and skip</Button>
            <AlertDialogAction onClick={() => void applySkip('save')}>Save and skip</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>Changes on the current stem will be lost if you leave now.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={onExit}>Discard and leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question stem?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the current generated stem from the review queue. You can restore it later from deleted questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteStem()
              }}
            >
              Delete stem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function getEntryFocus(entry: UcatApprovalQueueEntry | null): { target: StemEditorFocusTarget | null; message: string | null } {
  if (!entry || entry.mode !== 'reconciliation') return { target: null, message: null }
  if (entry.issueType === 'missing_category') {
    return { target: 'category', message: 'Set a question stem category to resolve this reconciliation issue.' }
  }
  if (entry.issueType === 'missing_explanation') {
    return { target: 'explanation', message: `Add the missing explanation for question ${(entry.questionIndex ?? 0) + 1}.` }
  }
  if (entry.issueType === 'missing_tags') {
    return { target: 'tags', message: `Add at least one tag to question ${(entry.questionIndex ?? 0) + 1}.` }
  }
  return { target: 'sets', message: 'Add this private stem to a staff-authored set.' }
}
