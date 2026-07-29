'use client'

import { useMemo } from 'react'
import {
  Badge,
  Button,
  useToast,
} from '@altitutor/ui'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  Square,
  Sparkles,
  X,
} from 'lucide-react'
import type { BulkImportReviewController } from '@/features/ucat/questions/hooks/useBulkImportReviewController'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { tutorBtnOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'

type BulkImportReviewActionsProps = {
  stems: BulkImportStemDraft[]
  controller: BulkImportReviewController
}

function stemNumber(stems: BulkImportStemDraft[], stemId: string): number | null {
  const index = stems.findIndex((stem) => stem.id === stemId)
  return index < 0 ? null : index + 1
}

function scopeLabel(
  stems: BulkImportStemDraft[],
  stemId: string,
  questionId: string | null | undefined,
): string {
  const stemIndex = stemNumber(stems, stemId)
  const stem = stems.find((item) => item.id === stemId)
  const questionIndex = questionId
    ? stem?.values.questions.findIndex((question) => question.id === questionId) ?? -1
    : -1
  return [
    `Stem ${stemIndex ?? '?'}`,
    questionIndex >= 0 ? `question ${questionIndex + 1}` : null,
  ].filter(Boolean).join(' · ')
}

function duplicateLabel(kind: 'exact_duplicate' | 'shared_stem' | 'possible_near_copy') {
  if (kind === 'exact_duplicate') return 'Exact duplicate'
  if (kind === 'shared_stem') return 'Shared stem'
  return 'Possible near-copy'
}

export function BulkImportReviewActions({
  stems,
  controller,
}: BulkImportReviewActionsProps) {
  const { toast } = useToast()
  const failedCount = Object.keys(controller.aiErrorsByStemId).length
  const reviewedCount = Object.values(controller.aiResultsByStemId)
    .filter((result) => !result.error && result.assessment).length
  const excludedCount = stems.length - controller.includedStems.length
  const actionableCount =
    controller.hardFailures.length
    + controller.approvalRequiredFindings.length
    + controller.manualReviewFindings.length
  const duplicateStemIds = useMemo(
    () => new Set(controller.duplicateFindings.map((finding) => finding.draft.stemId)),
    [controller.duplicateFindings],
  )

  async function approve(stemId: string, findingKey: string) {
    try {
      await controller.approveFinding(stemId, findingKey)
      toast({
        title: 'AI edit applied',
        description: 'The complete proposed change was applied to the draft.',
      })
    } catch (error) {
      toast({
        title: 'Could not apply the edit',
        description: error instanceof Error ? error.message : 'The draft may have changed.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Import readiness</h2>
            {controller.hasHardFailures ? (
              <Badge variant="destructive">
                {controller.hardFailures.length} gate {controller.hardFailures.length === 1 ? 'failure' : 'failures'}
              </Badge>
            ) : (
              <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                Deterministic gates passed
              </Badge>
            )}
            {controller.duplicateFindings.length > 0 ? (
              <Badge variant="outline">{controller.duplicateFindings.length} duplicate {controller.duplicateFindings.length === 1 ? 'flag' : 'flags'}</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            AI review is optional. Safe fixes are applied automatically; meaning-changing edits need one approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={tutorBtnOutline}
            onClick={() => {
              controller.applyDeterministicFixes()
              if (controller.hasHardFailures) void controller.runAiReview()
            }}
          >
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Fix all gate failures
          </Button>
          <Button
            type="button"
            size="sm"
            className={controller.aiStatus === 'running' ? tutorBtnOutline : tutorBtnPrimary}
            onClick={
              controller.aiStatus === 'running'
                ? controller.cancelAiReview
                : () => void controller.runAiReview()
            }
          >
            {controller.aiStatus === 'running' ? (
              <>
                <Square className="mr-2 h-3.5 w-3.5 fill-current" />
                Stop AI review
              </>
            ) : (
              <>
                <Bot className="mr-2 h-3.5 w-3.5" />
                {reviewedCount > 0 ? 'Review changed questions' : 'AI review'}
              </>
            )}
          </Button>
          {failedCount > 0 && controller.aiStatus !== 'running' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void controller.retryFailedAiReview()}
            >
              Retry {failedCount} failed
            </Button>
          ) : null}
          {controller.automaticChanges.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={controller.undoAllAutomaticChanges}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Undo all
            </Button>
          ) : null}
        </div>
      </div>

      {controller.aiStatus === 'running' ? (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reviewing in the background. You can continue to the next step.
        </div>
      ) : null}

      {controller.hardFailures.length > 0 ? (
        <div className="space-y-2">
          {controller.hardFailures.map(({ stemId, issue }, index) => (
            <div
              key={`${stemId}:${issue.code}:${index}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/30"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {scopeLabel(
                    stems,
                    stemId,
                    issue.scope.type === 'question' || issue.scope.type === 'option'
                      ? stems.find((stem) => stem.id === stemId)?.values.questions[issue.scope.questionIndex]?.id
                      : null,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{issue.message}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void controller.runAiReviewForStem(stemId)}
                disabled={controller.aiStatus === 'running'}
              >
                Fix
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {controller.approvalRequiredFindings.map(({ stemId, finding }) => (
        <div
          key={`${stemId}:${finding.key}`}
          className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{scopeLabel(stems, stemId, finding.questionId)} · {finding.title}</p>
            <p className="text-xs text-muted-foreground">{finding.detail}</p>
            {finding.suggestion ? (
              <p className="text-xs font-medium">{finding.suggestion.summary}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void approve(stemId, finding.key)}
            >
              Approve edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => controller.keepFinding(stemId, finding.key)}
            >
              Keep as-is
            </Button>
          </div>
        </div>
      ))}

      {controller.manualReviewFindings.map(({ stemId, finding }) => (
        <div
          key={`${stemId}:${finding.key}`}
          className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{scopeLabel(stems, stemId, finding.questionId)} · {finding.title}</p>
            <p className="text-xs text-muted-foreground">{finding.detail}</p>
          </div>
          <div className="flex gap-2">
            {finding.recommendedAction === 'exclude' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => controller.excludeStem(stemId)}
              >
                Exclude stem
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => controller.keepFinding(stemId, finding.key)}
            >
              Keep as-is
            </Button>
          </div>
        </div>
      ))}

      {controller.duplicateStatus === 'running' ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking the current batch and catalog for duplicates…
        </div>
      ) : null}
      {controller.duplicateError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 px-3 py-2 text-xs">
          <span>{controller.duplicateError}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void controller.runDuplicateAnalysis()}>
            Retry duplicate check
          </Button>
        </div>
      ) : null}
      {controller.duplicateFindings.map((finding) => {
        const number = stemNumber(stems, finding.draft.stemId)
        const matchText = proseMirrorToPlainText(finding.match.stemText as never).trim()
        return (
          <div
            key={finding.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <Copy className="h-3.5 w-3.5" />
                Stem {number ?? '?'} · {duplicateLabel(finding.kind)}
                <Badge variant="outline">Advisory</Badge>
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Matches {finding.match.source === 'catalog'
                  ? `${finding.match.status?.replace('_', ' ')} catalog content`
                  : `stem ${stemNumber(stems, finding.match.stemId) ?? '?'}`}
                {matchText ? ` — ${matchText}` : ''}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => controller.excludeStem(finding.draft.stemId)}
            >
              Exclude from import
            </Button>
          </div>
        )
      })}

      {excludedCount > 0 ? (
        <div className="space-y-2 rounded-md border border-dashed px-3 py-2 text-sm">
          <p className="font-medium">
            {excludedCount} stem{excludedCount === 1 ? '' : 's'} excluded from this import
          </p>
          <div className="flex flex-wrap gap-2">
            {[...controller.excludedStemIds].map((stemId) => (
              <Button
                key={stemId}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => controller.includeStem(stemId)}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Restore stem {stemNumber(stems, stemId) ?? '?'}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <details className="rounded-md border bg-background px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">
          Passed and fixed details
          {controller.automaticChanges.length > 0
            ? ` · ${controller.automaticChanges.length} automatic ${controller.automaticChanges.length === 1 ? 'change' : 'changes'}`
            : ''}
        </summary>
        <div className="mt-2 space-y-2 text-muted-foreground">
          {controller.automaticChanges.map((change) => (
            <div key={change.id} className="flex items-center justify-between gap-2">
              <span>
                Stem {stemNumber(stems, change.stemId) ?? '?'} · {change.summary}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!change.canUndo}
                onClick={() => controller.undoAutomaticChange(change.id)}
              >
                Undo
              </Button>
            </div>
          ))}
          {controller.automaticChanges.length === 0 ? (
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              No automatic changes were needed.
            </p>
          ) : null}
          <p>
            {reviewedCount} of {stems.length} stems have a fresh AI review.
            {controller.staleAiStemIds.size > 0 ? ` ${controller.staleAiStemIds.size} changed since review.` : ''}
          </p>
          {duplicateStemIds.size === 0 && controller.hasDuplicateAnalysisRun ? (
            <p>No duplicate candidates were found.</p>
          ) : null}
        </div>
      </details>

      {actionableCount === 0 && reviewedCount > 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          AI review found no remaining action for the reviewed content.
        </div>
      ) : null}
      {controller.hasHardFailures ? (
        <p className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Resolve or exclude deterministic gate failures before importing. You can still continue through the wizard.
        </p>
      ) : null}
    </div>
  )
}
