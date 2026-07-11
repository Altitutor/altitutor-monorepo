'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@altitutor/ui'
import { Loader2, X } from 'lucide-react'
import type { QuestionWithNoExplanation } from '../api/reconciliation'
import { ucatQuestionsApi, type StemDetailRow } from '@/features/ucat/questions/api/questions'
import { useUcatCategories, useUcatSections, useUcatTags } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { Step3SetAnswers } from '@/features/ucat/questions/components/bulk-import/Step3SetAnswers'
import { UcatRichTextToolbar } from '@/features/ucat/shared/components/UcatRichTextToolbar'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  formValuesToStemBundlePayload,
  stemDetailToFormValues,
} from '@/features/ucat/questions/lib/stem-editor-form'
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { cn } from '@/shared/utils'
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from '@/shared/lib/tutor-visual'

type QuestionsWithNoExplanationReconciliationDialogProps = {
  open: boolean
  questions: QuestionWithNoExplanation[]
  onOpenChange: (open: boolean) => void
}

const COUNT_OPTIONS = [5, 10, 25, 50] as const

export function QuestionsWithNoExplanationReconciliationDialog({
  open,
  questions,
  onOpenChange,
}: QuestionsWithNoExplanationReconciliationDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const [countValue, setCountValue] = useState('10')
  const [drafts, setDrafts] = useState<BulkImportStemDraft[]>([])
  const [loadedDraftKey, setLoadedDraftKey] = useState('')
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)

  const targetQuestions = useMemo(() => {
    const limit = countValue === 'all' ? questions.length : Number(countValue)
    return questions.slice(0, Number.isFinite(limit) ? limit : questions.length)
  }, [countValue, questions])

  const targetStemIds = useMemo(
    () => Array.from(new Set(targetQuestions.map((question) => question.stemId))),
    [targetQuestions],
  )
  const targetStemKey = targetStemIds.join('|')

  const detailQueries = useQueries({
    queries: targetStemIds.map((stemId) => ({
      queryKey: ucatKeys.question(stemId),
      queryFn: () => ucatQuestionsApi.getDetail(stemId),
      enabled: open,
    })),
  })

  const isLoading =
    sectionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    tagsQuery.isLoading ||
    detailQueries.some((query) => query.isLoading)

  const details = useMemo(
    () => detailQueries.map((query) => query.data).filter((detail): detail is StemDetailRow => !!detail),
    [detailQueries],
  )

  useEffect(() => {
    if (!open) return
    if (questions.length <= 10) setCountValue('all')
  }, [open, questions.length])

  useEffect(() => {
    if (!open || isLoading) return
    if (loadedDraftKey === targetStemKey) return
    const nextDrafts = details.map((detail) => ({
      id: detail.id,
      values: stemDetailToFormValues(detail, detail.section_id),
    }))
    setDrafts(nextDrafts)
    setLoadedDraftKey(targetStemKey)
  }, [details, isLoading, loadedDraftKey, open, targetStemKey])

  useEffect(() => {
    if (!open) {
      setDrafts([])
      setLoadedDraftKey('')
      setActiveTextEditor(null)
    }
  }, [open])

  const saveMutation = useMutation({
    mutationFn: async (items: BulkImportStemDraft[]) => {
      await Promise.all(
        items.map((draft) =>
          ucatQuestionsApi.update(
            draft.id,
            formValuesToStemBundlePayload(
              JSON.parse(JSON.stringify(draft.values)) as UcatQuestionStemFormValues,
              draft.id,
            ),
          ),
        ),
      )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.questions() }),
        queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() }),
      ])
      toast({
        title: 'Explanations saved',
        description: `${drafts.length} stem${drafts.length === 1 ? '' : 's'} updated.`,
      })
      onOpenChange(false)
    },
    onError: (error) => {
      toast({
        title: 'Failed to save explanations',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const updateDraft = (stemId: string, values: UcatQuestionStemFormValues) => {
    setDrafts((current) => current.map((draft) => (draft.id === stemId ? { ...draft, values } : draft)))
  }

  const sections = sectionsQuery.data ?? []
  const categories = useMemo(() => mapCategoriesToOptions(categoriesQuery.data ?? []), [categoriesQuery.data])
  const tags = useMemo(() => mapTagsToOptions(tagsQuery.data ?? []), [tagsQuery.data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex h-[92vh] w-full flex-col gap-0 p-0 md:max-w-7xl [&>button]:hidden',
          tutorDialogContentClass,
        )}
      >
        <DialogHeader className={cn('flex-shrink-0 px-6 py-4', tutorDialogHeaderStrip)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={tutorBtnIconOutline}
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle>Reconcile missing explanations</DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {targetQuestions.length} question{targetQuestions.length === 1 ? '' : 's'} across {targetStemIds.length} stem{targetStemIds.length === 1 ? '' : 's'}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Questions</span>
              <Select value={countValue} onValueChange={setCountValue}>
                <SelectTrigger className={cn('h-9 w-[140px]', tutorBtnOutline)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNT_OPTIONS.filter((count) => count < questions.length).map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      First {count}
                    </SelectItem>
                  ))}
                  <SelectItem value="all">All {questions.length}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-full min-h-[24rem] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading questions...
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex h-full min-h-[24rem] items-center justify-center text-muted-foreground">
              No questions to reconcile.
            </div>
          ) : (
            <Step3SetAnswers
              stems={drafts}
              sections={sections}
              categories={categories}
              tags={tags}
              onUpdateStem={updateDraft}
              onActiveTextEditorChange={setActiveTextEditor}
            />
          )}
        </div>

        <DialogFooter className={cn('flex-shrink-0 flex-row items-center gap-3 px-6 py-4 sm:justify-start', tutorDialogFooterStrip)}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {activeTextEditor ? (
              <div className="min-w-0 flex-1 overflow-x-auto" data-rich-text-toolbar>
                <UcatRichTextToolbar editor={activeTextEditor} />
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => onOpenChange(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={tutorBtnPrimary}
                onClick={() => saveMutation.mutate(drafts)}
                disabled={isLoading || drafts.length === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
