'use client'

import {
  Badge,
  Button,
  useToast,
} from '@altitutor/ui'
import {
  Bot,
  Copy,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react'
import type { BulkImportReviewController } from '@/features/ucat/questions/hooks/useBulkImportReviewController'
import { tutorBtnOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'

type BulkImportReviewActionsProps = {
  controller: BulkImportReviewController
}

type BulkImportQuestionIssuesProps = {
  stemId: string
  questionId: string | null
  questionIndex: number
  controller: BulkImportReviewController
}

function duplicateLabel(kind: 'exact_duplicate' | 'shared_stem' | 'possible_near_copy') {
  if (kind === 'exact_duplicate') return 'Exact duplicate'
  if (kind === 'shared_stem') return 'Shared stem'
  return 'Possible near-copy'
}

export function BulkImportReviewActions({
  controller,
}: BulkImportReviewActionsProps) {
  const failedCount = Object.keys(controller.aiErrorsByStemId).length
  const reviewedCount = Object.values(controller.aiResultsByStemId)
    .filter((result) => !result.error && result.assessment).length

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        AI review is optional. Safe fixes apply automatically; proposed content edits appear in
        each question&apos;s Issues column for one-click approval.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={tutorBtnOutline}
          disabled={controller.aiStatus === 'running'}
          onClick={() => {
            const affectedStemIds = controller.hardFailures.map(({ stemId }) => stemId)
            controller.applyDeterministicFixes()
            if (affectedStemIds.length > 0) {
              void controller.runAiReviewForStemIds(affectedStemIds)
            }
          }}
        >
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Fix all issues
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
              {reviewedCount > 0 ? 'Review changed questions' : 'AI review all'}
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
            Undo automatic fixes
          </Button>
        ) : null}
        {controller.aiStatus === 'running' ? (
          <span className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reviewing in the background
          </span>
        ) : null}
        {controller.duplicateError ? (
          <>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Duplicate check failed.
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void controller.runDuplicateAnalysis()}
            >
              Retry duplicate check
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function BulkImportQuestionIssues({
  stemId,
  questionId,
  questionIndex,
  controller,
}: BulkImportQuestionIssuesProps) {
  const { toast } = useToast()
  const deterministicIssues = controller.hardFailures.filter(({ stemId: issueStemId, issue }) => (
    issueStemId === stemId
    && (
      issue.scope.type === 'stem'
        ? questionIndex === 0
        : issue.scope.questionIndex === questionIndex
    )
  ))
  const appliesToQuestion = (finding: { stemId: string; finding: { questionId?: string | null } }) =>
    finding.stemId === stemId
    && (
      finding.finding.questionId === questionId
      || (!finding.finding.questionId && questionIndex === 0)
    )
  const approvalFindings = controller.approvalRequiredFindings.filter(appliesToQuestion)
  const manualFindings = controller.manualReviewFindings.filter(appliesToQuestion)
  const duplicates = questionIndex === 0
    ? controller.duplicateFindings.filter((finding) => finding.draft.stemId === stemId)
    : []
  const error = questionIndex === 0 ? controller.aiErrorsByStemId[stemId] : null
  const isStale = questionIndex === 0 && controller.staleAiStemIds.has(stemId)
  const issueCount =
    deterministicIssues.length
    + approvalFindings.length
    + manualFindings.length
    + duplicates.length
    + (error ? 1 : 0)
    + (isStale ? 1 : 0)

  async function approve(findingKey: string) {
    try {
      await controller.approveFinding(stemId, findingKey)
      toast({
        title: 'AI edit applied',
        description: 'The proposed question change was applied. Run AI review again to verify it.',
      })
    } catch (approvalError) {
      toast({
        title: 'Could not apply the edit',
        description:
          approvalError instanceof Error ? approvalError.message : 'The draft may have changed.',
        variant: 'destructive',
      })
    }
  }

  if (issueCount === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="space-y-2 py-1">
      {deterministicIssues.map(({ issue }, index) => (
        <div key={`${issue.code}:${index}`} className="space-y-0.5">
          <Badge variant="destructive">Gate</Badge>
          <p className="text-[11px] leading-4">{issue.message}</p>
        </div>
      ))}
      {approvalFindings.map(({ finding }) => (
        <div key={finding.key} className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium">{finding.title}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">{finding.detail}</p>
          {finding.suggestion ? (
            <p className="text-[11px] font-medium">{finding.suggestion.summary}</p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void approve(finding.key)}>
              Approve fix
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => controller.keepFinding(stemId, finding.key)}
            >
              Keep as-is
            </Button>
          </div>
        </div>
      ))}
      {manualFindings.map(({ finding }) => (
        <div key={finding.key} className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium">{finding.title}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">{finding.detail}</p>
          <div className="flex flex-wrap gap-1">
            {finding.recommendedAction === 'exclude' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  if (finding.questionId && questionId) {
                    controller.excludeQuestion(stemId, questionId)
                  } else {
                    controller.excludeStem(stemId)
                  }
                }}
              >
                {finding.questionId ? 'Don\u0027t import' : 'Don\u0027t import stem'}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => controller.keepFinding(stemId, finding.key)}
            >
              Keep as-is
            </Button>
          </div>
        </div>
      ))}
      {duplicates.map((finding) => (
        <div key={finding.id} className="space-y-1">
          <p className="flex items-center gap-1 font-medium">
            <Copy className="h-3.5 w-3.5" />
            {duplicateLabel(finding.kind)}
            <Badge variant="outline">Advisory</Badge>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Matches {finding.match.source === 'catalog'
              ? `${finding.match.status?.replace('_', ' ')} catalogue content`
              : 'another stem in this import'}.
          </p>
          {finding.kind === 'exact_duplicate' ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => controller.keepDuplicateFinding(finding.id)}
            >
              Keep both
            </Button>
          ) : null}
        </div>
      ))}
      {error ? (
        <div className="space-y-0.5">
          <Badge variant="destructive">AI review failed</Badge>
          <p className="text-[11px] leading-4">{error}</p>
        </div>
      ) : null}
      {isStale ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Changed since its last AI review.
        </p>
      ) : null}
    </div>
  )
}
