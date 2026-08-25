'use client'

import {
  Badge,
  Button,
  useToast,
} from '@altitutor/ui'
import {
  Bot,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Loader2,
  RotateCcw,
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

export function BulkImportReviewActions({
  controller,
}: BulkImportReviewActionsProps) {
  const failedCount = Object.keys(controller.aiErrorsByStemId).length
  const reviewedCount = Object.values(controller.aiResultsByStemId)
    .filter((result) => !result.error && result.assessment).length
  const pendingCount = controller.pendingAiStemIds.size

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        AI review is optional. One click checks every included question, applies confident fixes,
        and leaves only genuinely uncertain items for manual review.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className={tutorBtnPrimary}
          disabled={pendingCount === 0}
          onClick={() => {
            controller.applyDeterministicFixes()
            void controller.runAiReview()
          }}
        >
          <Bot className="mr-2 h-3.5 w-3.5" />
          {reviewedCount > 0
            ? `Fix & review ${pendingCount} remaining`
            : 'Fix & review all'}
        </Button>
        {controller.aiStatus === 'running' ? (
          <Button
            type="button"
            size="sm"
            className={tutorBtnOutline}
            onClick={controller.cancelAiReview}
          >
            <Square className="mr-2 h-3.5 w-3.5 fill-current" />
            Stop running reviews
          </Button>
        ) : null}
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
  const stemHasDeterministicIssues = controller.hardFailures.some(
    ({ stemId: issueStemId }) => issueStemId === stemId
  )
  const appliesToQuestion = (finding: { stemId: string; finding: { questionId?: string | null } }) =>
    finding.stemId === stemId
    && (
      finding.finding.questionId === questionId
      || (!finding.finding.questionId && questionIndex === 0)
    )
  const approvalFindings = controller.approvalRequiredFindings.filter(appliesToQuestion)
  const manualFindings = controller.manualReviewFindings.filter(appliesToQuestion)
  const aiPhase = controller.aiPhaseByStemId[stemId] ?? 'idle'
  const error = questionIndex === 0 && aiPhase === 'failed'
    ? controller.aiErrorsByStemId[stemId]
    : null
  const stemHasContinuingFindings = controller.approvalRequiredFindings.some(
    (item) => item.stemId === stemId
  ) || controller.manualReviewFindings.some((item) => item.stemId === stemId)
  const isStale =
    questionIndex === 0
    && aiPhase !== 'failed'
    && controller.staleAiStemIds.has(stemId)
    && !stemHasContinuingFindings
  const issueCount =
    deterministicIssues.length
    + approvalFindings.length
    + manualFindings.length
    + (error ? 1 : 0)
    + (isStale ? 1 : 0)
    + (aiPhase !== 'idle' ? 1 : 0)

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
      {aiPhase === 'queued' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Queued for AI review
        </p>
      ) : null}
      {aiPhase === 'analyzing' ? (
          <p className="flex items-center gap-1.5 text-[11px] text-blue-700 dark:text-blue-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Auditing and applying safe fixes
          </p>
      ) : null}
      {aiPhase === 'ready' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {stemHasDeterministicIssues ? 'AI complete · gate remains' : 'AI checked · publish ready'}
        </p>
      ) : null}
      {aiPhase === 'manual_review' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          AI complete · input needed
        </p>
      ) : null}
      {aiPhase === 'failed' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          AI review failed
        </p>
      ) : null}
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
      {error ? (
        <div className="space-y-0.5">
          <Badge variant="destructive">AI review failed</Badge>
          <p className="text-[11px] leading-4">{error}</p>
        </div>
      ) : null}
      {isStale ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Applied edits need a final AI verification.
        </p>
      ) : null}
    </div>
  )
}
