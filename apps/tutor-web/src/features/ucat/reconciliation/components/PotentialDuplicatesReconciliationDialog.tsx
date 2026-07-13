'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@altitutor/ui'
import type { Json } from '@altitutor/shared'
import { Loader2, X } from 'lucide-react'
import type { PotentialDuplicatePair, PotentialDuplicateStemSide } from '../api/reconciliation'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatVisibilityBadge } from '@/features/ucat/shared/components/UcatVisibilityBadge'
import { useDeleteUcatQuestionStem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
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

type PotentialDuplicatesReconciliationDialogProps = {
  open: boolean
  pairs: PotentialDuplicatePair[]
  initialPairId?: string | null
  onOpenChange: (open: boolean) => void
}

function asRichJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function StemComparePanel({
  sideLabel,
  stem,
}: {
  sideLabel: string
  stem: PotentialDuplicateStemSide
}) {
  const stemPlain = proseMirrorToPlainText(stem.stemText as Json) ?? ''
  const questions = [...(stem.questions ?? [])].sort((a, b) => a.index - b.index)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="shrink-0 space-y-2 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{sideLabel}</p>
          <UcatVisibilityBadge isPrivate={stem.isPrivate} />
        </div>
        <p className="text-xs text-muted-foreground">
          {stem.sectionName || 'Unknown section'}
          {stem.categoryName ? ` · ${stem.categoryName}` : ''}
        </p>
        {stem.setNames.length > 0 ? (
          <p className="text-xs text-muted-foreground">Sets: {stem.setNames.join(', ')}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Not in any set</p>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stem</p>
          <UcatRichContentBlock
            json={asRichJson(stem.stemText)}
            plainText={stemPlain}
            textTone="theme"
            className="text-sm"
          />
        </div>
        {questions.map((question, index) => {
          const questionPlain = proseMirrorToPlainText(question.question_text as Json) ?? ''
          return (
            <div key={question.id} className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {index + 1}
              </p>
              <UcatRichContentBlock
                json={asRichJson(question.question_text)}
                plainText={questionPlain}
                textTone="theme"
                className="text-sm"
              />
              {(question.answer_options ?? []).length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {(question.answer_options ?? []).map((option, optionIndex) => {
                    const optionPlain = proseMirrorToPlainText(option.answer_text as Json) ?? ''
                    return (
                      <li
                        key={`${question.id}-opt-${optionIndex}`}
                        className={cn(
                          'rounded-md border px-2 py-1.5',
                          option.is_answer && 'border-green-500/40 bg-green-500/5',
                        )}
                      >
                        <span className="text-muted-foreground">{String.fromCharCode(65 + optionIndex)}. </span>
                        {optionPlain || '—'}
                        {option.is_answer ? (
                          <span className="ml-2 text-xs font-medium text-green-700 dark:text-green-300">
                            Correct
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PotentialDuplicatesReconciliationDialog({
  open,
  pairs,
  initialPairId = null,
  onOpenChange,
}: PotentialDuplicatesReconciliationDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const deleteMutation = useDeleteUcatQuestionStem()
  const [queue, setQueue] = useState<PotentialDuplicatePair[]>([])
  const [index, setIndex] = useState(0)
  const [pendingDeleteSide, setPendingDeleteSide] = useState<'A' | 'B' | null>(null)

  useEffect(() => {
    if (!open) return
    setQueue(pairs)
    const startIndex = initialPairId ? Math.max(0, pairs.findIndex((pair) => pair.id === initialPairId)) : 0
    setIndex(startIndex === -1 ? 0 : startIndex)
    setPendingDeleteSide(null)
  }, [open, pairs, initialPairId])

  const current = queue[index] ?? null
  const remaining = queue.length

  const similarityLabel = useMemo(() => {
    if (!current) return ''
    const pct = Math.round(Math.max(current.tokenRatio, current.trigramRatio) * 100)
    return `${pct}% similar`
  }, [current])

  function advanceAfterResolve(deletedStemId?: string) {
    const nextQueue = deletedStemId
      ? queue.filter((pair) => pair.stemA.id !== deletedStemId && pair.stemB.id !== deletedStemId)
      : queue.filter((_, pairIndex) => pairIndex !== index)

    if (nextQueue.length === 0) {
      setQueue([])
      setIndex(0)
      onOpenChange(false)
      return
    }

    setQueue(nextQueue)
    setIndex((prevIndex) => Math.min(prevIndex, nextQueue.length - 1))
  }

  async function confirmDelete() {
    if (!current || !pendingDeleteSide) return
    const stem = pendingDeleteSide === 'A' ? current.stemA : current.stemB
    try {
      await deleteMutation.mutateAsync(stem.id)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() })
      toast({
        title: 'Question stem deleted',
        description: 'The selected duplicate was soft-deleted and removed from any sets.',
      })
      setPendingDeleteSide(null)
      advanceAfterResolve(stem.id)
    } catch (err) {
      toast({
        title: 'Cannot delete',
        description: err instanceof Error ? err.message : 'Failed to delete question stem.',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            // Match other reconciliation dialogs: force height (DialogContent base uses sm:h-auto).
            'flex !h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:!h-[92vh] md:max-w-7xl [&>button]:hidden',
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
                  <DialogTitle>Compare potential duplicates</DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pair {Math.min(index + 1, Math.max(remaining, 1))} of {remaining}
                    {current ? ` · ${current.sectionName}` : ''}
                  </p>
                </div>
              </div>
              {current ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{similarityLabel}</Badge>
                  <Badge variant="outline">Token {Math.round(current.tokenRatio * 100)}%</Badge>
                  <Badge variant="outline">Phrase {Math.round(current.trigramRatio * 100)}%</Badge>
                  {current.sharedTokenPreview.slice(0, 6).map((token) => (
                    <Badge key={token} variant="secondary" className="font-normal">
                      {token}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 px-6 py-4">
            {!current ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No more potential duplicates in this queue.
              </div>
            ) : (
              <div className="flex h-full min-h-0 gap-4">
                <StemComparePanel sideLabel="Stem A" stem={current.stemA} />
                <StemComparePanel sideLabel="Stem B" stem={current.stemB} />
              </div>
            )}
          </div>

          <DialogFooter
            className={cn(
              'flex-shrink-0 flex-row flex-wrap items-center gap-3 px-6 py-4 sm:justify-between',
              tutorDialogFooterStrip,
            )}
          >
            <Button
              type="button"
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => advanceAfterResolve()}
              disabled={!current || deleteMutation.isPending}
            >
              Keep both
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setPendingDeleteSide('A')}
                disabled={!current || deleteMutation.isPending}
              >
                {deleteMutation.isPending && pendingDeleteSide === 'A' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete stem A
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setPendingDeleteSide('B')}
                disabled={!current || deleteMutation.isPending}
              >
                {deleteMutation.isPending && pendingDeleteSide === 'B' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete stem B
              </Button>
              <Button
                type="button"
                className={tutorBtnPrimary}
                onClick={() => onOpenChange(false)}
                disabled={deleteMutation.isPending}
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UcatDeleteConfirmDialog
        open={pendingDeleteSide != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDeleteSide(null)
        }}
        title="Delete this question stem?"
        description={
          pendingDeleteSide && current
            ? (() => {
                const stem = pendingDeleteSide === 'A' ? current.stemA : current.stemB
                const setCount = stem.setNames.length
                return setCount > 0
                  ? `This stem is in ${setCount} set(s). It will be removed from those sets, then soft-deleted with its questions. You can restore it later from the deleted list.`
                  : 'This stem and its questions will be soft-deleted. You can restore them later from the deleted list.'
              })()
            : 'This stem and its questions will be soft-deleted.'
        }
        onConfirm={confirmDelete}
        isPending={deleteMutation.isPending}
      />
    </>
  )
}
