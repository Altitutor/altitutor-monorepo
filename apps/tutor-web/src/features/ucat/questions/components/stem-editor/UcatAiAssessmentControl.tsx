'use client'

import { useState, type ReactNode } from 'react'
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
import {
  deriveUcatAiScopeReviewStatus,
  isStaleUcatAiReviewRun,
  shouldShowRerunAiReviewAction,
  UCAT_AI_REVIEW_STATUS_COPY,
} from '@/features/ucat/questions/lib/ai-assessment/review-status'
import type {
  UcatAssessmentCategory,
  UcatAssessmentCategoryResultSchema,
  UcatAssessmentFinding,
  UcatFormatCheck,
  UcatAssessmentPatch,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  applyUcatAssessmentPatches,
  assessmentPatchCurrentPlainText,
  ucatAssessmentPatchesAlreadyApplied,
  ucatAssessmentSetTextIsStale,
} from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
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

function scopeResults(
  data: UcatAiAssessment,
  questionId: string | null,
  values: UcatQuestionStemFormValues,
) {
  const effective = new Set(data.effectiveRunIds)
  const runs = data.runs.filter((run) => effective.has(run.id))
  const accepted = new Set(
    data.decisions
      .filter((decision) => decision.decision === 'suggestion_accepted')
      .map((decision) => `${decision.run_id}:${decision.finding_key}`),
  )
  const allFindings = latestByKey(
    runs.flatMap((run) => (run.assessment_result?.findings ?? []).map((finding) => ({ finding, run })))
      .filter(({ finding, run }) => questionId == null
        ? finding.scopeType === 'shared' && run.sharedCurrent
        : finding.scopeType === 'question' && finding.questionId === questionId && run.currentTargetQuestionIds.includes(questionId)),
    ({ finding, run }) => `${run.id}:${finding.key}`,
  )
  const resolved = ({ finding, run }: typeof allFindings[number]) => (
    accepted.has(`${run.id}:${finding.key}`)
    || Boolean(
      finding.suggestion
      && ucatAssessmentPatchesAlreadyApplied(values, finding.suggestion.patches)
    )
  )
  const findings = allFindings.filter((item) => !resolved(item))
  const categories = latestByKey(
    runs.flatMap((run) => (run.assessment_result?.categories ?? []).map((result) => ({ result, run })))
      .filter(({ result, run }) => questionId == null
        ? result.scopeType === 'shared' && run.sharedCurrent
        : result.scopeType === 'question' && result.questionId === questionId && run.currentTargetQuestionIds.includes(questionId)),
    ({ result }) => result.category,
  ).map((item) => {
    const relatedFindings = allFindings.filter(({ finding }) => finding.category === item.result.category)
    if (relatedFindings.length === 0 || relatedFindings.some((finding) => !resolved(finding))) {
      return item
    }
    return {
      ...item,
      result: {
        ...item.result,
        rating: 'pass' as const,
        summary: 'Resolved in the current question content.',
        evidence: [],
      },
    }
  })
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

function ReviewStatusBadge({ status }: { status: UcatAiAssessment['status'] }) {
  const copy = UCAT_AI_REVIEW_STATUS_COPY[status]
  return (
    <Badge variant="outline" className={cn('shrink-0 gap-1.5', copy.className)}>
      <StatusIcon status={status} />
      {copy.shortLabel}
    </Badge>
  )
}

function scopeReviewStatus(params: {
  data: UcatAiAssessment
  questionId: string | null
  values: UcatQuestionStemFormValues
  formatChecks: Array<{ check: UcatFormatCheck; run: UcatAiAssessmentRun }>
}): UcatAiAssessment['status'] {
  const { categories, findings } = scopeResults(params.data, params.questionId, params.values)
  return deriveUcatAiScopeReviewStatus({
    overallStatus: params.data.status,
    ratings: [
      ...categories.map(({ result }) => result.rating),
      ...findings.map(({ finding }) => finding.rating),
    ],
    formatSeverities: params.formatChecks.map(({ check }) => check.severity),
  })
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
    const option = questions.flatMap((item) => item.options ?? []).find((item) => item.id === id)
    return option ? proseMirrorToPlainText(option.answerText) : id
  }
  switch (patch.operation) {
    case 'replace_text':
      return [{ label: patch.target.field.replaceAll('_', ' '), before: patch.beforeText, after: patch.afterText }]
    case 'set_text':
      return [{ label: patch.target.field.replaceAll('_', ' '), before: patch.beforeText ?? 'Empty', after: patch.afterText }]
    case 'set_rich_content':
      return [{
        label: patch.target.field.replaceAll('_', ' '),
        before: proseMirrorToPlainText(patch.before),
        after: proseMirrorToPlainText(patch.after),
      }]
    case 'set_answer_key':
      return [{ label: 'Correct answer', before: optionText(patch.currentCorrectOptionId), after: optionText(patch.correctOptionId) }]
    case 'replace_option_and_key':
      return [
        { label: 'Answer option', before: patch.beforeAnswerText, after: patch.answerText },
        { label: 'Correct answer', before: optionText((question?.options ?? []).find((item) => item.answerKeyValue === 'correct')?.id), after: patch.answerText },
        ...(patch.answerExplanation !== undefined
          ? [{
              label: 'Option explanation',
              before: proseMirrorToPlainText((question?.options ?? []).find((item) => item.id === patch.optionId)?.answerExplanation ?? null),
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
        before: (question?.options ?? []).map((option) => optionText(option.id)).join('\n') || 'Unknown',
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
  const rows = patches.flatMap((patch) => {
    const preview = patchPreviewRows(patch, values)
    if (patch.operation !== 'set_text') {
      return preview.map((row) => ({ ...row, current: null as string | null }))
    }
    let current = ''
    try {
      current = assessmentPatchCurrentPlainText(values, patch)
    } catch {
      current = ''
    }
    const before = (patch.beforeText ?? '').trim()
    return preview.map((row) => ({
      ...row,
      current: current === before ? null : (current || 'Empty'),
    }))
  })
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
          {row.current ? (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Current draft</span>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-amber-50 p-2 font-sans text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{row.current}</pre>
            </div>
          ) : null}
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
  const values = form.watch()
  const staleSetText = Boolean(
    finding.suggestion && ucatAssessmentSetTextIsStale(values, finding.suggestion.patches),
  )

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
      const next = await applyUcatAssessmentPatches(form.getValues(), finding.suggestion.patches, {
        overwriteMismatchedSetText: staleSetText,
      })
      form.setValue('sectionId', next.sectionId, { shouldDirty: true })
      form.setValue('categoryId', next.categoryId, { shouldDirty: true })
      form.setValue('stemText', next.stemText, { shouldDirty: true })
      form.setValue('questions', next.questions, { shouldDirty: true })
      toast({
        title: staleSetText ? 'Current text replaced in the unsaved draft' : 'Suggestion applied to the unsaved draft',
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
          <AssessmentPatchPreview patches={finding.suggestion.patches} values={values} />
          {staleSetText ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              This suggestion was based on a different field value. Replacing overwrites the current draft text with the suggestion.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {finding.suggestion.patches.length} bounded {finding.suggestion.patches.length === 1 ? 'change' : 'changes'}; applied to the form only.
            </p>
          )}
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
                  {staleSetText ? 'Replace current text' : 'Accept edit'}
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
  formatChecks = [],
  showLabel = true,
}: {
  label: string
  questionId: string | null
  data: UcatAiAssessment
  stemId: string
  form: UseFormReturn<UcatQuestionStemFormValues>
  formatChecks?: Array<{ check: UcatFormatCheck; run: UcatAiAssessmentRun }>
  showLabel?: boolean
}) {
  const { categories, findings } = scopeResults(data, questionId, form.getValues())
  const latestFormatChecks = latestByKey(
    formatChecks,
    ({ check }) => `${check.code}:${check.questionId ?? ''}`,
  )
  if (categories.length === 0 && findings.length === 0 && latestFormatChecks.length === 0) return null
  const defaultOpen = [
    ...latestFormatChecks.map(({ check }) => `format:${check.code}:${check.questionId ?? ''}`),
    ...categories
      .filter(({ result }) => result.rating !== 'pass' && result.rating !== 'not_applicable')
      .map(({ result }) => `category:${questionId ?? 'shared'}:${result.category}`),
    ...findings.map(({ finding, run }) => `finding:${run.id}:${finding.key}`),
  ]
  return (
    <section className="space-y-3">
      {showLabel ? (
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      ) : null}
      <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
        {latestFormatChecks.map(({ check }) => (
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
  onActiveQuestionIndexChange,
}: {
  stemId: string
  form: UseFormReturn<UcatQuestionStemFormValues>
  activeQuestionIndex?: number
  onActiveQuestionIndexChange: (index: number) => void
}) {
  const { toast } = useToast()
  const query = useUcatAiAssessment(stemId)
  const requestMutation = useRequestUcatAiAssessment()
  const retryMutation = useRetryUcatAiAssessment()
  const data = query.data
  const status = data?.status ?? (query.isLoading ? 'reviewing' : 'unavailable')
  const currentValues = form.watch()
  const questions = currentValues.questions
  const effective = new Set(data?.effectiveRunIds ?? [])
  const formatChecks = data?.runs
    .filter((run) => effective.has(run.id))
    .flatMap((run) => run.format_checks.map((check) => ({ check, run }))) ?? []
  const unavailableRun = data?.runs.find((run) => (
    effective.has(run.id) && (run.status === 'failed' || isStaleUcatAiReviewRun(run))
  ))
  const activeQuestionId = questions[activeQuestionIndex]?.id ?? null
  const scopeStatuses = data ? [
    scopeReviewStatus({
      data,
      questionId: null,
      values: currentValues,
      formatChecks: formatChecks.filter(({ check }) => check.scopeType === 'shared'),
    }),
    ...questions.flatMap((question) => question.id ? [scopeReviewStatus({
      data,
      questionId: question.id,
      values: currentValues,
      formatChecks: formatChecks.filter(({ check }) => check.questionId === question.id),
    })] : []),
  ] : []
  const currentOverallStatus = data
    ? deriveUcatAiScopeReviewStatus({
        overallStatus: data.status,
        ratings: scopeStatuses.flatMap((scopeStatus) => {
          if (scopeStatus === 'critical') return ['critical' as const]
          if (scopeStatus === 'unreviewable') return ['unreviewable' as const]
          if (scopeStatus === 'concerns') return ['concern' as const]
          return ['pass' as const]
        }),
        formatSeverities: scopeStatuses.includes('format_blocked') ? ['error'] : [],
      })
    : status

  function selectQuestion(questionId: string) {
    const index = questions.findIndex((question) => question.id === questionId)
    if (index >= 0) onActiveQuestionIndexChange(index)
  }

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

  async function requestReview(force = false) {
    try {
      const result = await requestMutation.mutateAsync({ stemId, force })
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

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shared stem</h3>
                <ReviewStatusBadge status={currentOverallStatus} />
              </div>
              <ScopeSection
                label="Shared stem"
                questionId={null}
                data={data}
                stemId={stemId}
                form={form}
                formatChecks={formatChecks.filter(({ check }) => check.scopeType === 'shared')}
                showLabel={false}
              />
              <Accordion
                type="single"
                value={activeQuestionId ?? undefined}
                onValueChange={selectQuestion}
                className="space-y-1"
              >
                {questions.map((question, index) => question.id ? (
                  <AccordionItem
                    key={question.id}
                    value={question.id}
                    className="border-0"
                  >
                    <AccordionTrigger className="py-2 hover:no-underline [&>svg]:text-muted-foreground">
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 pr-2">
                        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Question {index + 1}
                        </span>
                        <ReviewStatusBadge status={scopeReviewStatus({
                          data,
                          questionId: question.id,
                          values: currentValues,
                          formatChecks: formatChecks.filter(({ check }) => check.questionId === question.id),
                        })} />
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 pt-1">
                      <ScopeSection
                        label={`Question ${index + 1}`}
                        questionId={question.id}
                        data={data}
                        stemId={stemId}
                        form={form}
                        formatChecks={formatChecks.filter(({ check }) => check.questionId === question.id)}
                        showLabel={false}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ) : null)}
              </Accordion>

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

              {shouldShowRerunAiReviewAction(data.status) && !unavailableRun ? (
                <div className="space-y-2 rounded-lg border border-dashed p-4">
                  <div>
                    <p className="text-sm font-medium">Request a new review</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Re-runs AI review of the saved stem, even if the content has not changed.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void requestReview(true)}
                    disabled={requestMutation.isPending || !data.environment.enabled}
                  >
                    {requestMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-2 h-3.5 w-3.5" />}
                    {requestMutation.isPending ? 'Adding to queue…' : 'Request new review'}
                  </Button>
                </div>
              ) : null}

            </div>
          )}
    </div>
  )
}
