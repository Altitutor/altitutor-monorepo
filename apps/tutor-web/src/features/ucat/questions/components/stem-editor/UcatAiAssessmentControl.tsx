'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { UseFormReturn } from 'react-hook-form'
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
  useToast,
} from '@altitutor/ui'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type {
  UcatAiAssessment,
  UcatAiAssessmentRun,
} from '@/features/ucat/questions/api/questions'
import {
  useRecordUcatAiAssessmentDecision,
  useRetryUcatAiAssessment,
  useUcatAiAssessment,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import type {
  UcatAssessmentCategory,
  UcatAssessmentCategoryResultSchema,
  UcatAssessmentFinding,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { applyUcatAssessmentPatches } from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
import type { z } from 'zod'
import { cn } from '@/shared/utils'

type CategoryResult = z.infer<typeof UcatAssessmentCategoryResultSchema>

const CATEGORY_LABELS: Record<UcatAssessmentCategory, string> = {
  answer_validity: 'Answer validity',
  explanation_teaching_quality: 'Teaching explanation',
  question_clarity_fairness: 'Clarity & fairness',
  difficulty_timing: 'Difficulty & timing',
  ucat_authenticity_task_quality: 'UCAT authenticity',
  content_appropriateness: 'Appropriateness',
  visual_integrity: 'Visual integrity',
}

const STATUS_COPY: Record<UcatAiAssessment['status'], { label: string; className: string }> = {
  disabled: { label: 'AI review disabled', className: 'border-slate-300 text-slate-600' },
  not_requested: { label: 'No AI review', className: 'border-slate-300 text-slate-600' },
  reviewing: { label: 'AI reviewing', className: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30' },
  deferred: { label: 'AI review deferred', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30' },
  format_blocked: { label: 'Format checks', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30' },
  unavailable: { label: 'AI unavailable', className: 'border-slate-300 text-slate-600' },
  unreviewable: { label: 'Needs human review', className: 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30' },
  passed: { label: 'AI review passed', className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' },
  concerns: { label: 'AI concerns', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30' },
  critical: { label: 'AI critical', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30' },
}

function ratingClass(rating: CategoryResult['rating'] | UcatAssessmentFinding['rating']) {
  switch (rating) {
    case 'pass': return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
    case 'critical': return 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30'
    case 'concern': return 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30'
    case 'unreviewable': return 'border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30'
    case 'not_applicable': return 'border-slate-300 text-slate-600'
  }
}

function ratingLabel(rating: CategoryResult['rating'] | UcatAssessmentFinding['rating']) {
  return rating === 'not_applicable' ? 'N/A' : rating.replace('_', ' ')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function latestByKey<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T>()
  for (const item of items) {
    const itemKey = key(item)
    if (!map.has(itemKey)) map.set(itemKey, item)
  }
  return [...map.values()]
}

function scopeResults(data: UcatAiAssessment, questionId: string | null) {
  const effective = new Set(data.effectiveRunIds)
  const runs = data.runs.filter((run) => effective.has(run.id))
  const categories = latestByKey(
    runs.flatMap((run) => (run.assessment_result?.categories ?? []).map((result) => ({ result, run })))
      .filter(({ result, run }) => questionId == null
        ? result.scopeType === 'shared' && run.sharedCurrent
        : result.scopeType === 'question' && result.questionId === questionId && run.currentTargetQuestionIds.includes(questionId)),
    ({ result }) => result.category,
  )
  const findings = latestByKey(
    runs.flatMap((run) => (run.assessment_result?.findings ?? []).map((finding) => ({ finding, run })))
      .filter(({ finding, run }) => questionId == null
        ? finding.scopeType === 'shared' && run.sharedCurrent
        : finding.scopeType === 'question' && finding.questionId === questionId && run.currentTargetQuestionIds.includes(questionId)),
    ({ finding, run }) => `${run.id}:${finding.key}`,
  )
  return { categories, findings }
}

function StatusIcon({ status }: { status: UcatAiAssessment['status'] }) {
  if (status === 'reviewing') return <Loader2 className="h-3.5 w-3.5 animate-spin" />
  if (status === 'passed') return <CheckCircle2 className="h-3.5 w-3.5" />
  if (status === 'critical') return <ShieldAlert className="h-3.5 w-3.5" />
  if (status === 'concerns' || status === 'format_blocked') return <AlertTriangle className="h-3.5 w-3.5" />
  if (status === 'deferred') return <Clock3 className="h-3.5 w-3.5" />
  if (status === 'unavailable') return <XCircle className="h-3.5 w-3.5" />
  return <Bot className="h-3.5 w-3.5" />
}

function FindingCard({
  stemId,
  run,
  finding,
  data,
  form,
}: {
  stemId: string
  run: UcatAiAssessmentRun
  finding: UcatAssessmentFinding
  data: UcatAiAssessment
  form: UseFormReturn<UcatQuestionStemFormValues>
}) {
  const { toast } = useToast()
  const decisionMutation = useRecordUcatAiAssessmentDecision()
  const [dismissReason, setDismissReason] = useState('')
  const [showDismiss, setShowDismiss] = useState(false)
  const [applying, setApplying] = useState(false)
  const decision = data.decisions.find((item) => item.run_id === run.id && item.finding_key === finding.key)

  async function decide(nextDecision: 'dismissed' | 'suggestion_accepted' | 'suggestion_rejected', reason?: string) {
    await decisionMutation.mutateAsync({
      stemId,
      runId: run.id,
      findingKey: finding.key,
      decision: nextDecision,
      reason,
    })
  }

  async function handleDecision(nextDecision: 'dismissed' | 'suggestion_rejected', reason?: string) {
    try {
      await decide(nextDecision, reason)
      toast({ title: nextDecision === 'dismissed' ? 'Finding dismissed' : 'Suggestion rejected' })
    } catch (error) {
      toast({
        title: 'Could not record tutor decision',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  async function acceptSuggestion() {
    if (!finding.suggestion) return
    setApplying(true)
    try {
      const next = await applyUcatAssessmentPatches(form.getValues(), finding.suggestion.patches)
      form.setValue('sectionId', next.sectionId, { shouldDirty: true })
      form.setValue('categoryId', next.categoryId, { shouldDirty: true })
      form.setValue('stemText', next.stemText, { shouldDirty: true })
      form.setValue('questions', next.questions, { shouldDirty: true })
      await decide('suggestion_accepted')
      toast({ title: 'Suggestion applied to the unsaved draft', description: 'Review the edit, then save or publish when ready.' })
    } catch (error) {
      toast({
        title: 'Could not apply suggestion',
        description: error instanceof Error ? error.message : 'The draft no longer matches this suggestion.',
        variant: 'destructive',
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{finding.title}</h4>
            <Badge variant="outline" className={cn('capitalize', ratingClass(finding.rating))}>{ratingLabel(finding.rating)}</Badge>
            <span className="text-xs text-muted-foreground">{Math.round(finding.confidence * 100)}% confidence</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{finding.detail}</p>
        </div>
      </div>
      {finding.evidence.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {finding.evidence.map((evidence, index) => <li key={`${finding.key}:evidence:${index}`}>{evidence}</li>)}
        </ul>
      ) : null}
      {finding.suggestion ? (
        <div className="rounded-md bg-muted/60 p-3 text-sm">
          <p className="font-medium">Suggested edit: {finding.suggestion.summary}</p>
          <p className="mt-1 text-muted-foreground">{finding.suggestion.rationale}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {finding.suggestion.patches.length} bounded {finding.suggestion.patches.length === 1 ? 'change' : 'changes'}; applied to the form only.
          </p>
        </div>
      ) : null}
      {decision ? (
        <p className="text-xs text-muted-foreground">
          Tutor decision: {decision.decision.replaceAll('_', ' ')} · {formatDate(decision.decided_at)}
          {decision.reason ? ` — ${decision.reason}` : ''}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {finding.suggestion ? (
              <>
                <Button size="sm" onClick={acceptSuggestion} disabled={applying || decisionMutation.isPending}>
                  {applying ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Accept edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleDecision('suggestion_rejected')} disabled={decisionMutation.isPending}>
                  Reject edit
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setShowDismiss((value) => !value)} disabled={decisionMutation.isPending}>
              Dismiss finding
            </Button>
          </div>
          {showDismiss ? (
            <div className="space-y-2 rounded-md border p-3">
              <Textarea
                value={dismissReason}
                onChange={(event) => setDismissReason(event.target.value)}
                placeholder="Why is this finding not applicable?"
                className="min-h-20"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!dismissReason.trim() || decisionMutation.isPending}
                onClick={() => void handleDecision('dismissed', dismissReason.trim())}
              >
                Confirm dismissal
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ScopeSection({
  label,
  questionId,
  data,
  stemId,
  form,
}: {
  label: string
  questionId: string | null
  data: UcatAiAssessment
  stemId: string
  form: UseFormReturn<UcatQuestionStemFormValues>
}) {
  const { categories, findings } = scopeResults(data, questionId)
  if (categories.length === 0 && findings.length === 0) return null
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map(({ result }) => (
          <div key={`${questionId ?? 'shared'}:${result.category}`} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{CATEGORY_LABELS[result.category]}</p>
              <Badge variant="outline" className={cn('shrink-0 capitalize', ratingClass(result.rating))}>{ratingLabel(result.rating)}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{result.summary}</p>
          </div>
        ))}
      </div>
      {findings.length > 0 ? (
        <div className="space-y-3">
          {findings.map(({ finding, run }) => (
            <FindingCard key={`${run.id}:${finding.key}`} stemId={stemId} run={run} finding={finding} data={data} form={form} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function UcatAiAssessmentControl({
  stemId,
  form,
  activeQuestionIndex = 0,
}: {
  stemId: string
  form: UseFormReturn<UcatQuestionStemFormValues>
  activeQuestionIndex?: number
}) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const autoOpenedRef = useRef(false)
  const query = useUcatAiAssessment(stemId)
  const retryMutation = useRetryUcatAiAssessment()
  const data = query.data
  const status = data?.status ?? (query.isLoading ? 'reviewing' : 'unavailable')
  const statusCopy = STATUS_COPY[status]
  const questions = form.watch('questions')
  const orderedQuestions = useMemo(() => {
    const indexed = questions.map((question, index) => ({ question, index }))
    return indexed.sort((a, b) => {
      if (a.index === activeQuestionIndex) return -1
      if (b.index === activeQuestionIndex) return 1
      return a.index - b.index
    })
  }, [activeQuestionIndex, questions])
  const effective = new Set(data?.effectiveRunIds ?? [])
  const formatChecks = data?.runs
    .filter((run) => effective.has(run.id))
    .flatMap((run) => run.format_checks.map((check) => ({ check, run }))) ?? []
  const unavailableRun = data?.runs.find((run) => effective.has(run.id) && run.status === 'failed')

  async function retryReview(runId: string) {
    try {
      await retryMutation.mutateAsync({ stemId, runId })
    } catch (error) {
      toast({
        title: 'Could not retry AI review',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    if (autoOpenedRef.current || searchParams.get('aiReview') !== '1') return
    autoOpenedRef.current = true
    setOpen(true)
  }, [searchParams])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn('h-8 rounded-full gap-1.5', statusCopy.className)}
      >
        <StatusIcon status={status} />
        {statusCopy.label}
      </Button>
      <SheetContent className="flex w-[min(94vw,760px)] flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>AI question review</SheetTitle>
          <SheetDescription>
            Supplementary advice only. Publishing remains a tutor decision, and accepted edits stay unsaved until you save or publish.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading AI review…</div>
          ) : query.isError || !data ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : 'AI review could not be loaded.'}</p>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Try again</Button>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
                <Badge variant="outline" className={cn('gap-1.5', statusCopy.className)}><StatusIcon status={status} />{statusCopy.label}</Badge>
                {!data.environment.enabled ? (
                  <span className="text-xs text-muted-foreground">Automatic review is disabled in this environment. Existing results remain visible.</span>
                ) : null}
                {data.status === 'reviewing' ? <span className="text-xs text-muted-foreground">This panel refreshes automatically.</span> : null}
              </div>

              {formatChecks.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">UCAT format checks</h3>
                  <div className="space-y-2">
                    {latestByKey(formatChecks, ({ check }) => `${check.code}:${check.questionId ?? ''}`).map(({ check }) => (
                      <div key={`${check.code}:${check.questionId ?? ''}`} className={cn(
                        'rounded-lg border p-3 text-sm',
                        check.severity === 'error' ? 'border-red-200 bg-red-50/70 dark:bg-red-950/20' : 'border-amber-200 bg-amber-50/70 dark:bg-amber-950/20',
                      )}>
                        <p className="font-medium">{check.severity === 'error' ? 'Format error' : 'Format warning'}</p>
                        <p className="mt-1 text-muted-foreground">{check.message}</p>
                      </div>
                    ))}
                  </div>
                  {data.status === 'format_blocked' ? (
                    <p className="text-xs text-muted-foreground">The model review was not called because deterministic format errors must be fixed first. Publishing is not blocked by this tool.</p>
                  ) : null}
                </section>
              ) : null}

              <ScopeSection label="Shared stem" questionId={null} data={data} stemId={stemId} form={form} />
              {orderedQuestions.map(({ question, index }) => question.id ? (
                <ScopeSection
                  key={question.id}
                  label={`Question ${index + 1}${index === activeQuestionIndex ? ' · active' : ''}`}
                  questionId={question.id}
                  data={data}
                  stemId={stemId}
                  form={form}
                />
              ) : null)}

              {unavailableRun ? (
                <section className="space-y-3 rounded-lg border p-4">
                  <div>
                    <h3 className="font-medium">Review unavailable</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{unavailableRun.error_message ?? 'The provider did not complete this review after three attempts.'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void retryReview(unavailableRun.id)}
                    disabled={retryMutation.isPending || !data.environment.enabled}
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry review
                  </Button>
                </section>
              ) : null}

              {data.currentCycle == null ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  This stem has not entered a new review cycle since automatic review was enabled. No historical backfill is performed.
                </p>
              ) : null}

              {data.cycles.length > 0 ? (
                <section className="space-y-3 border-t pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Review history</h3>
                  <div className="space-y-2">
                    {data.cycles.map((cycle, index) => {
                      const cycleRuns = data.runs.filter((run) => run.cycle_id === cycle.id)
                      return (
                        <details key={cycle.id} open={index === 0} className="rounded-lg border p-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            {cycle.is_current ? 'Current cycle' : 'Previous cycle'} · {formatDate(cycle.started_at)} · {cycleRuns.length} {cycleRuns.length === 1 ? 'run' : 'runs'}
                          </summary>
                          <div className="mt-3 space-y-2">
                            {cycleRuns.map((run) => (
                              <div key={run.id} className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                                <span className="font-medium capitalize text-foreground">{run.status.replace('_', ' ')}</span>
                                {' · '}{run.scope_type === 'full' ? 'Full stem' : `${run.target_question_ids.length} question scope`}
                                {' · '}{formatDate(run.requested_at)}
                                {run.assessment_model ? ` · ${run.assessment_model}` : ''}
                              </div>
                            ))}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
