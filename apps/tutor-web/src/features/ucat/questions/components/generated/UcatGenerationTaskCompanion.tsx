'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, Check, ChevronDown, ChevronUp, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@altitutor/ui'
import {
  useDismissUcatGenerationRun,
  useUcatGenerationRuns,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatGenerationRun } from '@/features/ucat/questions/api/questions'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'

type OptimisticTask = {
  totalStems: number
  error: string | null
  runId: string | null
}

export function UcatGenerationTaskCompanion() {
  const pathname = usePathname()
  const runsQuery = useUcatGenerationRuns()
  const dismissMutation = useDismissUcatGenerationRun()
  const [optimistic, setOptimistic] = useState<OptimisticTask | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [reviewRun, setReviewRun] = useState<UcatGenerationRun | null>(null)
  const [hiddenRunIds, setHiddenRunIds] = useState<string[]>([])
  const [hasCapturedInitialRuns, setHasCapturedInitialRuns] = useState(false)

  useEffect(() => {
    const starting = (event: Event) => {
      const detail = (event as CustomEvent<{ totalStems?: number }>).detail
      setOptimistic({ totalStems: detail?.totalStems ?? 0, error: null, runId: null })
      setExpanded(true)
    }
    const started = (event: Event) => {
      const detail = (event as CustomEvent<{ runId?: string }>).detail
      setOptimistic((current) => current
        ? { ...current, runId: detail?.runId ?? null }
        : null)
    }
    const failed = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setOptimistic((current) => ({
        totalStems: current?.totalStems ?? 0,
        error: detail?.message ?? 'Unable to start generation',
        runId: null,
      }))
    }
    window.addEventListener('ucat-generation-starting', starting)
    window.addEventListener('ucat-generation-started', started)
    window.addEventListener('ucat-generation-start-failed', failed)
    return () => {
      window.removeEventListener('ucat-generation-starting', starting)
      window.removeEventListener('ucat-generation-started', started)
      window.removeEventListener('ucat-generation-start-failed', failed)
    }
  }, [])

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data])
  const visibleRuns = runs.filter((run) => !hiddenRunIds.includes(run.id))
  const eligibleRuns = hasCapturedInitialRuns
    ? visibleRuns
    : visibleRuns.filter((run) => run.status === 'running')
  const activeRun = eligibleRuns.find((run) => run.status === 'running') ?? eligibleRuns[0] ?? null

  useEffect(() => {
    if (!runsQuery.isSuccess || hasCapturedInitialRuns) return
    const completedBeforeMount = runs
      .filter((run) => run.status !== 'running' && run.id !== optimistic?.runId)
      .map((run) => run.id)
    setHiddenRunIds((current) => [...new Set([...current, ...completedBeforeMount])])
    setHasCapturedInitialRuns(true)
  }, [hasCapturedInitialRuns, optimistic?.runId, runs, runsQuery.isSuccess])

  useEffect(() => {
    if (optimistic?.runId && runs.some((run) => run.id === optimistic.runId)) {
      setOptimistic(null)
    }
  }, [optimistic?.runId, runs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const runId = new URLSearchParams(window.location.search).get('generationRun')
    if (!runId) return
    const matching = runs.find((run) => run.id === runId)
    if (matching?.generated_stem_ids.length) setReviewRun(matching)
  }, [pathname, runs])

  const hideRun = (runId: string) => {
    setHiddenRunIds((current) => current.includes(runId) ? current : [...current, runId])
    dismissMutation.mutate(runId)
  }

  const viewRun = (run: UcatGenerationRun) => {
    setReviewRun(run)
    hideRun(run.id)
  }

  const hasCompanion = optimistic != null || activeRun != null
  if (!hasCompanion && !reviewRun) return null

  const run = optimistic ? null : activeRun
  const failed = optimistic?.error != null || run?.status === 'failed'
  const completed = run?.status === 'completed'
  const total = optimistic?.totalStems ?? run?.requested_stem_count ?? 0
  const processed = run?.processed_stem_count ?? 0
  const accepted = run?.accepted_stem_count ?? 0
  const percent = completed
    ? 100
    : total > 0
      ? Math.min(96, Math.round((processed / total) * 100))
      : 5
  const message = optimistic?.error
    ?? run?.progress_message
    ?? (optimistic ? 'Starting generation' : 'Preparing questions')
  const reviewEntries: UcatApprovalQueueEntry[] = (reviewRun?.generated_stem_ids ?? []).map((stemId) => ({
    stemId,
    mode: 'ai_approval',
  }))

  return (
    <>
      {hasCompanion ? <aside
        aria-label="AI generation task companion"
        className="fixed bottom-5 right-5 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            failed ? 'bg-destructive/10 text-destructive' : completed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary',
          )}>
            {failed ? <AlertCircle className="h-5 w-5" /> : completed ? <Check className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              {failed ? 'Generation failed' : completed ? 'Questions ready' : 'AI generation'}
            </p>
            <p className="truncate text-sm font-medium">
              {completed ? `${accepted} stem${accepted === 1 ? '' : 's'} ready for review` : message}
            </p>
          </button>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>

        {!failed ? (
          <div className="h-1 bg-muted">
            <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        ) : null}

        {expanded ? (
          <div className="space-y-3 border-t px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{message}</span>
              {!failed ? <span className="shrink-0 font-medium tabular-nums">{completed ? accepted : processed} / {total}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              {completed && run?.generated_stem_ids.length ? (
                <Button className={cn('flex-1', tutorBtnPrimary)} onClick={() => viewRun(run)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  View questions
                </Button>
              ) : null}
              {(completed || failed) && run ? (
                <Button
                  variant="outline"
                  className={cn(completed ? '' : 'flex-1', tutorBtnOutline)}
                  onClick={() => hideRun(run.id)}
                  disabled={dismissMutation.isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Dismiss
                </Button>
              ) : null}
              {failed && optimistic && !run ? (
                <Button variant="outline" className={cn('flex-1', tutorBtnOutline)} onClick={() => setOptimistic(null)}>
                  Dismiss
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside> : null}

      <UcatQuestionStemApprovalQueueDialog
        open={reviewRun != null}
        title="Review generated questions"
        entries={reviewEntries}
        onClose={() => setReviewRun(null)}
      />
    </>
  )
}
