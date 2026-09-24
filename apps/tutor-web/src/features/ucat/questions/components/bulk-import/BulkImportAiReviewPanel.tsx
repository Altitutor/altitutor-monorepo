'use client'

import React from 'react'
import type { BulkImportAiReviewResult } from '@/features/ucat/questions/lib/bulk-import-ai-review'
import type {
  UcatAssessmentCategory,
  UcatAssessmentResponse,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import type { BulkImportAiStemPhase } from '@/features/ucat/questions/hooks/useBulkImportReviewController'

const CATEGORY_LABELS: Record<UcatAssessmentCategory, string> = {
  presentation_integrity: 'Presentation integrity',
  ucat_suitability: 'UCAT suitability',
  difficulty_timing: 'Difficulty & timing',
  answer_correctness_fairness: 'Answer correctness & fairness',
  explanation_quality: 'Explanation quality',
  answer_validity: 'Answer validity',
  explanation_teaching_quality: 'Teaching explanation',
  question_clarity_fairness: 'Clarity & fairness',
  ucat_authenticity_task_quality: 'UCAT authenticity',
  content_appropriateness: 'Appropriateness',
  visual_integrity: 'Visual integrity',
}

function ratingClass(rating: UcatAssessmentResponse['categories'][number]['rating']) {
  if (rating === 'pass') return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
  if (rating === 'critical') return 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30'
  if (rating === 'concern') return 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30'
  if (rating === 'unreviewable') return 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30'
  return 'border-slate-300 text-slate-600'
}

function ratingLabel(rating: UcatAssessmentResponse['categories'][number]['rating']) {
  return rating === 'not_applicable' ? 'N/A' : rating.replaceAll('_', ' ')
}

function formatDuration(milliseconds: number | null | undefined): string {
  if (milliseconds == null) return '—'
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`
  return `${(milliseconds / 1_000).toFixed(1)} s`
}

export type BulkImportAiReviewPanelProps = {
  activeQuestionId: string | null
  activeQuestionIndex: number
  phase: BulkImportAiStemPhase
  stale: boolean
  result: BulkImportAiReviewResult | null
  onApproveFinding?: (findingKey: string) => void
  onKeepFinding?: (findingKey: string) => void
}

export function BulkImportAiReviewPanel({
  activeQuestionId,
  activeQuestionIndex,
  phase,
  stale,
  result,
  onApproveFinding,
  onKeepFinding,
}: BulkImportAiReviewPanelProps) {
  if (phase === 'queued' || phase === 'analyzing') {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        {phase === 'queued' ? 'Queued for AI review…' : 'Auditing and applying safe fixes…'}
      </div>
    )
  }
  if (result?.error || phase === 'failed') {
    return (
      <div className="space-y-2 py-4 text-sm text-destructive">
        <p className="font-medium">AI review failed</p>
        <p>{result?.error ?? 'The AI review did not complete.'}</p>
        {result?.timings ? (
          <p className="text-xs text-muted-foreground">Elapsed: {formatDuration(result.timings.totalMs)}</p>
        ) : null}
      </div>
    )
  }
  if (!result?.assessment && !result?.audit) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        Run AI review to see category-by-category comments.
      </div>
    )
  }

  const audit = result.audit ?? result.assessment
  const current = result.assessment ?? audit
  const appliesToActiveQuestion = (item: { scopeType: string; questionId?: string | null }) => (
    item.scopeType === 'shared' || (
      item.scopeType === 'question'
      && Boolean(activeQuestionId)
      && item.questionId === activeQuestionId
    )
  )
  const categories = current?.categories.filter(appliesToActiveQuestion) ?? []
  const findings = current?.findings.filter(appliesToActiveQuestion) ?? []
  const auditCategoryByKey = new Map((audit?.categories ?? []).map((category) => [
    `${category.scopeType}:${category.questionId ?? 'shared'}:${category.category}`,
    category,
  ]))

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain py-3 pr-1">
      <div className="space-y-4 pb-4">
        <div>
          <h2 className="text-sm font-semibold">AI review · Question {activeQuestionIndex + 1}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{current?.overallSummary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={stale
            ? 'inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30'
            : 'inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30'}
          >
            {stale ? 'Review is stale' : 'Review complete'}
          </span>
        </div>

        {result.timings ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timing</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border bg-card p-3 text-xs">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-right font-medium">{formatDuration(result.timings.totalMs)}</dd>
              <dt className="text-muted-foreground">Audit & repairs</dt>
              <dd className="text-right font-medium">{formatDuration(result.timings.auditRepairMs)}</dd>
              <dt className="text-muted-foreground">Prepare verification</dt>
              <dd className="text-right font-medium">{formatDuration(result.timings.verificationPreparationMs)}</dd>
              <dt className="text-muted-foreground">Blind verification</dt>
              <dd className="text-right font-medium">{formatDuration(result.timings.blindVerificationMs)}</dd>
              <dt className="text-muted-foreground">Reconcile</dt>
              <dd className="text-right font-medium">{formatDuration(result.timings.reconciliationMs)}</dd>
            </dl>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment outcomes</h3>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No current category comments for this question.</p>
          ) : categories.map((category) => {
            const key = `${category.scopeType}:${category.questionId ?? 'shared'}:${category.category}`
            const original = auditCategoryByKey.get(key)
            const fixedAutomatically = category.rating === 'pass'
              && original != null
              && original.rating !== 'pass'
            return (
            <div key={key} className="space-y-2 rounded-md border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{CATEGORY_LABELS[category.category]}</p>
                  {fixedAutomatically ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30">
                      Fixed automatically
                    </span>
                  ) : null}
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${ratingClass(category.rating)}`}>{ratingLabel(category.rating)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{category.summary}</p>
              {category.evidence.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {category.evidence.map((evidence, index) => <li key={`${category.category}:${index}`}>{evidence}</li>)}
                </ul>
              ) : null}
            </div>
          )})}
        </section>

        {findings.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Still needs input</h3>
            {findings.map((finding) => (
              <div key={finding.key} className="space-y-2 rounded-md border border-amber-200 bg-card p-3 shadow-sm dark:border-amber-900">
                <p className="text-sm font-semibold">{finding.title}</p>
                <p className="text-sm text-muted-foreground">{finding.detail}</p>
                {finding.suggestion ? (
                  <p className="text-xs font-medium">{finding.suggestion.summary}</p>
                ) : null}
                {onApproveFinding || onKeepFinding ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {finding.suggestion && onApproveFinding ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        onClick={() => onApproveFinding(finding.key)}
                      >
                        Approve fix
                      </button>
                    ) : null}
                    {onKeepFinding ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium hover:bg-muted"
                        onClick={() => onKeepFinding(finding.key)}
                      >
                        Keep as-is
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  )
}
