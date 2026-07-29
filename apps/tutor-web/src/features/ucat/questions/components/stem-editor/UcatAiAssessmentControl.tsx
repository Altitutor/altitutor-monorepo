'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
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
  useRequestUcatAiAssessment,
  useRetryUcatAiAssessment,
  useUcatAiAssessment,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import type {
  UcatAssessmentCategory,
  UcatAssessmentCategoryResultSchema,
  UcatAssessmentFinding,
  UcatAssessmentPatch,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { applyUcatAssessmentPatches } from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
import type { z } from 'zod'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type CategoryResult = z.infer<typeof UcatAssessmentCategoryResultSchema>

const CATEGORY_LABELS: Record<UcatAssessmentCategory, string> = {
  presentation_integrity: 'Presentation integrity',
  ucat_suitability: 'UCAT suitability',
  answer_correctness_fairness: 'Answer correctness & fairness',
  explanation_quality: 'Explanation quality',
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
  not_requested: { label: 'AI review not requested', className: 'border-slate-300 text-slate-600' },
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
  const accepted = new Set(
    data.decisions
      .filter((decision) => decision.decision === 'suggestion_accepted')
      .map((decision) => `${decision.run_id}:${decision.finding_key}`),
  )
  const findings = latestByKey(
    runs.flatMap((run) => (run.assessment_result?.findings ?? []).map((finding) => ({ finding, run })))
      .filter(({ finding, run }) => questionId == null
        ? finding.scopeType === 'shared' && run.sharedCurrent
        : finding.scopeType === 'question' && finding.questionId === questionId && run.currentTargetQuestionIds.includes(questionId)),
    ({ finding, run }) => `${run.id}:${finding.key}`,
  ).filter(({ finding, run }) => !accepted.has(`${run.id}:${finding.key}`))
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

function ReviewAccordionCard({
  value,
  title,
  badge,
  children,
}: {
  value: string
  title: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <AccordionItem value={value} className="border-0">
      <div className={tutorCardCn('overflow-hidden')}>
        <AccordionTrigger className="gap-2 px-3 py-2.5 hover:no-underline [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
            <span className="min-w-0 text-sm font-semibold">{title}</span>
            {badge}
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 border-t border-black/[0.06] px-3 pb-4 pt-3 dark:border-white/10">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  )
}

type PatchPreviewRow = { label: string; before: string; after: string }

function displayPatchValue(value: unknown): string {
  if (value == null) return 'None'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

function patchPreviewRows(
  patch: UcatAssessmentPatch,
  values: UcatQuestionStemFormValues,
): PatchPreviewRow[] {
  const questions = values.questions ?? []
  const question = 'questionId' in patch
    ? questions.find((item) => item.id === patch.questionId)
    : null
  const optionText = (id: string | null | undefined) => {
    if (!id) return 'No keyed option'
    const option = questions.flatMap((item) => item.options).find((item) => item.id === id)
    return option ? proseMirrorToPlainText(option.answerText) : id
  }
  switch (patch.operation) {
    case 'replace_text':
      return [{ label: patch.target.field.replaceAll('_', ' '), before: patch.beforeText, after: patch.afterText }]
    case 'set_text':
      return [{ label: patch.target.field.replaceAll('_', ' '), before: patch.beforeText ?? 'Empty', after: patch.afterText }]
    case 'set_answer_key':
      return [{ label: 'Correct answer', before: optionText(patch.currentCorrectOptionId), after: optionText(patch.correctOptionId) }]
    case 'replace_option_and_key':
      return [
        { label: 'Answer option', before: patch.beforeAnswerText, after: patch.answerText },
        { label: 'Correct answer', before: optionText(question?.options.find((item) => item.isAnswer)?.id), after: patch.answerText },
        ...(patch.answerExplanation !== undefined
          ? [{
              label: 'Option explanation',
              before: proseMirrorToPlainText(question?.options.find((item) => item.id === patch.optionId)?.answerExplanation ?? null),
              after: patch.answerExplanation ?? 'None',
            }]
          : []),
      ]
    case 'replace_question':
      return [{ label: 'Question', before: patch.beforeQuestionText, after: patch.question.questionText }]
    case 'insert_question':
      return [{ label: 'Question', before: 'Not present', after: patch.question.questionText }]
    case 'remove_question':
      return [{ label: 'Question', before: patch.beforeQuestionText, after: 'Removed' }]
    case 'insert_option':
      return [{ label: 'Answer option', before: 'Not present', after: patch.option.answerText }]
    case 'remove_option':
      return [{ label: 'Answer option', before: patch.beforeAnswerText, after: 'Removed' }]
    case 'reorder_options':
      return [{
        label: 'Answer option order',
        before: question?.options.map((option) => optionText(option.id)).join('\n') ?? 'Unknown',
        after: patch.optionIds.map(optionText).join('\n'),
      }]
    case 'set_metadata':
      return [{ label: patch.field.replaceAll('_', ' '), before: displayPatchValue(patch.before), after: displayPatchValue(patch.after) }]
    case 'update_visual_spec':
      return [{ label: `${patch.visualType.replaceAll('_', ' ')} specification`, before: displayPatchValue(patch.beforeSpec), after: displayPatchValue(patch.afterSpec) }]
  }
}

function AssessmentPatchPreview({
  patches,
  values,
}: {
  patches: UcatAssessmentPatch[]
  values: UcatQuestionStemFormValues
}) {
  const rows = patches.flatMap((patch) => patchPreviewRows(patch, values))
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed changes</p>
      {rows.map((row, index) => (
        <div key={`${row.label}:${index}`} className="space-y-2 rounded-md border bg-background p-2.5">
          <p className="text-xs font-medium capitalize">{row.label}</p>
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-red-700 dark:text-red-300">Before</span>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-red-50 p-2 font-sans text-xs text-red-950 dark:bg-red-950/30 dark:text-red-100">{row.before || 'Empty'}</pre>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">After</span>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-emerald-50 p-2 font-sans text-xs text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">{row.after || 'Empty'}</pre>
          </div>
        </div>
      ))}
    </div>
  )
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
      toast({
        title: 'Suggestion applied to the unsaved draft',
        description: 'Save the edit to resolve the current finding. Discarding the form leaves it unresolved.',
      })
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{finding.detail}</p>
      <p className="text-xs text-muted-foreground">{Math.round(finding.confidence * 100)}% confidence</p>
      {finding.evidence.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {finding.evidence.map((evidence, index) => <li key={`${finding.key}:evidence:${index}`}>{evidence}</li>)}
        </ul>
      ) : null}
      {finding.suggestion ? (
        <div className="space-y-3 rounded-md bg-muted/60 p-3 text-sm">
          <p className="font-medium">Suggested edit: {finding.suggestion.summary}</p>
          <p className="text-muted-foreground">{finding.suggestion.rationale}</p>
          <AssessmentPatchPreview patches={finding.suggestion.patches} values={form.getValues()} />
          <p className="text-xs text-muted-foreground">
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleDecision('dismissed')}
              disabled={decisionMutation.isPending}
            >
              Keep as-is
            </Button>
          </div>
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
  const defaultOpen = [
    ...categories
      .filter(({ result }) => result.rating !== 'pass' && result.rating !== 'not_applicable')
      .map(({ result }) => `category:${questionId ?? 'shared'}:${result.category}`),
    ...findings.map(({ finding, run }) => `finding:${run.id}:${finding.key}`),
  ]
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
        {categories.map(({ result }) => (
          <ReviewAccordionCard
            key={`${questionId ?? 'shared'}:${result.category}`}
            value={`category:${questionId ?? 'shared'}:${result.category}`}
            title={CATEGORY_LABELS[result.category]}
            badge={<Badge variant="outline" className={cn('shrink-0 capitalize', ratingClass(result.rating))}>{ratingLabel(result.rating)}</Badge>}
          >
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          </ReviewAccordionCard>
        ))}
        {findings.map(({ finding, run }) => (
          <ReviewAccordionCard
            key={`${run.id}:${finding.key}`}
            value={`finding:${run.id}:${finding.key}`}
            title={finding.title}
            badge={<Badge variant="outline" className={cn('shrink-0 capitalize', ratingClass(finding.rating))}>{ratingLabel(finding.rating)}</Badge>}
          >
            <FindingCard key={`${run.id}:${finding.key}`} stemId={stemId} run={run} finding={finding} data={data} form={form} />
          </ReviewAccordionCard>
        ))}
      </Accordion>
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
  const { toast } = useToast()
  const query = useUcatAiAssessment(stemId)
  const requestMutation = useRequestUcatAiAssessment()
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

  async function requestReview() {
    try {
      const result = await requestMutation.mutateAsync({ stemId })
      toast({
        title: result.kind === 'queued' ? 'AI review queued' : 'AI review already requested',
        description: result.kind === 'queued'
          ? 'It will continue in the background; you can close this dialog.'
          : 'The current content already has a matching review request.',
      })
    } catch (error) {
      toast({
        title: 'Could not request AI review',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overscroll-contain py-3 pr-1">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">AI question review</h2>
      </div>
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading AI review…</div>
          ) : query.isError || !data ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : 'AI review could not be loaded.'}</p>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Try again</Button>
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
                <Badge variant="outline" className={cn('gap-1.5', statusCopy.className)}><StatusIcon status={status} />{statusCopy.label}</Badge>
                {!data.environment.enabled ? (
                  <span className="text-xs text-muted-foreground">AI review is disabled in this environment. Existing results remain visible.</span>
                ) : !data.environment.automaticEnabled ? (
                  <span className="text-xs text-muted-foreground">Automatic review is disabled in settings. Stems sent for review are not queued automatically; request a review manually when needed.</span>
                ) : null}
                {data.status === 'reviewing' ? <span className="text-xs text-muted-foreground">This panel refreshes automatically.</span> : null}
              </div>

              {data.status === 'not_requested' ? (
                <div className="space-y-3 rounded-lg border border-dashed p-4">
                  <div>
                    <p className="text-sm font-medium">Request an AI review</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add this stem to the background queue. Unchanged content is deduplicated, so repeated clicks do not create duplicate reviews.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void requestReview()}
                    disabled={requestMutation.isPending || !data.environment.enabled}
                  >
                    {requestMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-2 h-3.5 w-3.5" />}
                    {requestMutation.isPending ? 'Adding to queue…' : 'Request AI review'}
                  </Button>
                </div>
              ) : null}

              {formatChecks.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">UCAT format checks</h3>
                  <Accordion
                    type="multiple"
                    defaultValue={latestByKey(formatChecks, ({ check }) => `${check.code}:${check.questionId ?? ''}`).map(({ check }) => `format:${check.code}:${check.questionId ?? ''}`)}
                    className="space-y-2"
                  >
                    {latestByKey(formatChecks, ({ check }) => `${check.code}:${check.questionId ?? ''}`).map(({ check }) => (
                      <ReviewAccordionCard
                        key={`${check.code}:${check.questionId ?? ''}`}
                        value={`format:${check.code}:${check.questionId ?? ''}`}
                        title={check.severity === 'error' ? 'Format error' : 'Format warning'}
                        badge={(
                          <Badge variant="outline" className={check.severity === 'error'
                            ? 'shrink-0 border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30'
                            : 'shrink-0 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30'}
                          >
                            {check.severity === 'error' ? 'Error' : 'Warning'}
                          </Badge>
                        )}
                      >
                        <p className="text-sm text-muted-foreground">{check.message}</p>
                        <p className="text-xs text-muted-foreground">{check.code.replaceAll('_', ' ')}</p>
                      </ReviewAccordionCard>
                    ))}
                  </Accordion>
                  {data.status === 'format_blocked' ? (
                    <p className="text-xs text-muted-foreground">
                      The model review was not called because deterministic format errors must be fixed first.
                      Skipping or failing an AI review does not block publishing.
                    </p>
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
                <Accordion type="multiple" defaultValue={['unavailable']}>
                  <ReviewAccordionCard
                    value="unavailable"
                    title="Review unavailable"
                    badge={<Badge variant="outline" className="shrink-0 border-slate-300 text-slate-600">Failed</Badge>}
                  >
                    <p className="text-sm text-muted-foreground">{unavailableRun.error_message ?? 'The provider did not complete this review after three attempts.'}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void retryReview(unavailableRun.id)}
                      disabled={retryMutation.isPending || !data.environment.enabled}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry review
                    </Button>
                  </ReviewAccordionCard>
                </Accordion>
              ) : null}

              {data.cycles.length > 0 ? (
                <section className="space-y-3 border-t pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Review history</h3>
                  <Accordion type="multiple" className="space-y-2">
                    {data.cycles.map((cycle, index) => {
                      const cycleRuns = data.runs.filter((run) => run.cycle_id === cycle.id)
                      return (
                        <ReviewAccordionCard
                          key={cycle.id}
                          value={`cycle:${cycle.id}`}
                          title={cycle.is_current ? 'Current cycle' : `Previous cycle ${index}`}
                          badge={<Badge variant="outline" className="shrink-0">{cycleRuns.length} {cycleRuns.length === 1 ? 'run' : 'runs'}</Badge>}
                        >
                          <p className="text-xs text-muted-foreground">Started {formatDate(cycle.started_at)}</p>
                          <div className="space-y-2">
                            {cycleRuns.map((run) => (
                              <div key={run.id} className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                                <span className="font-medium capitalize text-foreground">{run.status.replace('_', ' ')}</span>
                                {' · '}{run.scope_type === 'full' ? 'Full stem' : `${run.target_question_ids.length} question scope`}
                                {' · '}{formatDate(run.requested_at)}
                                {run.assessment_model ? ` · ${run.assessment_model}` : ''}
                              </div>
                            ))}
                          </div>
                        </ReviewAccordionCard>
                      )
                    })}
                  </Accordion>
                </section>
              ) : null}
            </div>
          )}
    </div>
  )
}
