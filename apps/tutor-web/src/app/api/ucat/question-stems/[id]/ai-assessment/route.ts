import { NextRequest, NextResponse } from 'next/server'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  UcatAssessmentResponseSchema,
  UcatFormatCheckSchema,
  type UcatAssessmentRating,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  fingerprintUcatAssessmentSnapshot,
  loadUcatAssessmentSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/content'
import {
  requestUcatQuestionAssessment,
  retryUcatQuestionAssessmentRun,
} from '@/features/ucat/questions/server/ai-assessment/dispatcher'
import { automaticReviewEnvironment } from '@/features/ucat/questions/server/ai-assessment/environment'

type SupabaseAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>
}

type RunRow = {
  id: string
  cycle_id: string
  stem_id: string
  trigger_kind: string
  scope_type: 'full' | 'questions'
  target_question_ids: string[]
  content_fingerprint: string
  shared_fingerprint: string
  question_fingerprints: Record<string, string>
  format_checks: unknown
  status: string
  attempt_count: number
  blind_solver_model: string | null
  assessment_model: string | null
  assessment_result: unknown
  error_message: string | null
  requested_at: string
  started_at: string | null
  deferred_until: string | null
  completed_at: string | null
}

type CycleRow = {
  id: string
  stem_id: string
  is_current: boolean
  started_at: string
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as unknown as SupabaseAny
}

function currentQuestionIds(run: RunRow, fingerprints: ReturnType<typeof fingerprintUcatAssessmentSnapshot>) {
  return run.target_question_ids.filter(
    (id) => run.question_fingerprints?.[id] === fingerprints.questions[id],
  )
}

function ratingPriority(rating: UcatAssessmentRating): number {
  switch (rating) {
    case 'critical': return 5
    case 'concern': return 4
    case 'unreviewable': return 3
    case 'pass': return 2
    case 'not_applicable': return 1
  }
}

function effectiveStatus(runs: Array<RunRow & { currentTargetQuestionIds: string[]; sharedCurrent: boolean }>) {
  if (runs.length === 0) return 'not_requested' as const
  let worstRating: UcatAssessmentRating | null = null
  for (const run of runs) {
    const parsed = UcatAssessmentResponseSchema.safeParse(run.assessment_result)
    if (!parsed.success) continue
    for (const result of parsed.data.categories) {
      if (!worstRating || ratingPriority(result.rating) > ratingPriority(worstRating)) {
        worstRating = result.rating
      }
    }
  }
  if (worstRating === 'critical') return 'critical' as const
  if (runs.some((run) => run.status === 'running' || run.status === 'queued')) return 'reviewing' as const
  if (worstRating === 'concern') return 'concerns' as const
  if (runs.some((run) => run.status === 'deferred')) return 'deferred' as const
  if (runs.some((run) => run.status === 'format_blocked')) return 'format_blocked' as const
  if (runs.some((run) => run.status === 'failed')) return 'unavailable' as const
  if (worstRating === 'unreviewable') return 'unreviewable' as const
  if (worstRating === 'pass' || worstRating === 'not_applicable') return 'passed' as const
  return 'not_requested' as const
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const admin = getServiceRoleClient()
  try {
    const snapshot = await loadUcatAssessmentSnapshot(admin, params.id)
    if (!snapshot) return NextResponse.json({ error: 'Question stem not found' }, { status: 404 })
    const fingerprints = fingerprintUcatAssessmentSnapshot(snapshot)
    const [{ data: cycles, error: cyclesError }, { data: runs, error: runsError }, { data: decisions, error: decisionsError }] = await Promise.all([
      asAny(admin)
        .from('ucat_ai_question_assessment_cycles')
        .select('id,stem_id,is_current,started_at')
        .eq('stem_id', params.id)
        .order('started_at', { ascending: false })
        .limit(20),
      asAny(admin)
        .from('ucat_ai_question_assessment_runs')
        .select('id,cycle_id,stem_id,trigger_kind,scope_type,target_question_ids,content_fingerprint,shared_fingerprint,question_fingerprints,format_checks,status,attempt_count,blind_solver_model,assessment_model,assessment_result,error_message,requested_at,started_at,deferred_until,completed_at')
        .eq('stem_id', params.id)
        .order('requested_at', { ascending: false })
        .limit(100),
      asAny(admin)
        .from('ucat_ai_question_assessment_decisions')
        .select('id,run_id,finding_key,decision,reason,reviewed_content_fingerprint,patch,decided_by,decided_at')
        .eq('stem_id', params.id)
        .order('decided_at', { ascending: false })
        .limit(200),
    ])
    if (cyclesError) throw cyclesError
    if (runsError) throw runsError
    if (decisionsError) throw decisionsError

    const cycleRows = (cycles ?? []) as CycleRow[]
    const runRows = (runs ?? []) as RunRow[]
    const currentCycle = cycleRows.find((cycle) => cycle.is_current) ?? null
    const decoratedRuns = runRows.map((run) => ({
      ...run,
      format_checks: UcatFormatCheckSchema.array().catch([]).parse(run.format_checks),
      assessment_result: UcatAssessmentResponseSchema.nullable().catch(null).parse(run.assessment_result),
      sharedCurrent: run.shared_fingerprint === fingerprints.shared,
      currentTargetQuestionIds: currentQuestionIds(run, fingerprints),
      contentCurrent: run.content_fingerprint === fingerprints.content,
    }))
    const currentCycleRuns = currentCycle
      ? decoratedRuns.filter((run) => run.cycle_id === currentCycle.id)
      : []

    // Each shared/question scope uses its newest still-current run. This avoids
    // re-reviewing an entire stem after an isolated question edit while keeping
    // unaffected earlier findings valid.
    const effectiveRunIds = new Set<string>()
    const sharedRun = currentCycleRuns.find((run) => run.scope_type === 'full' && run.sharedCurrent)
    if (sharedRun) effectiveRunIds.add(sharedRun.id)
    for (const question of snapshot.questions) {
      const questionRun = currentCycleRuns.find((run) => run.currentTargetQuestionIds.includes(question.id))
      if (questionRun) effectiveRunIds.add(questionRun.id)
    }
    const effectiveRuns = currentCycleRuns.filter((run) => effectiveRunIds.has(run.id))
    const environment = automaticReviewEnvironment()

    return NextResponse.json({
      environment,
      status: environment.enabled ? effectiveStatus(effectiveRuns) : 'disabled',
      currentContentFingerprint: fingerprints.content,
      currentCycle,
      cycles: cycleRows,
      runs: decoratedRuns,
      effectiveRunIds: [...effectiveRunIds],
      decisions: decisions ?? [],
    })
  } catch (error) {
    console.error('Could not load UCAT AI assessment', error)
    return NextResponse.json({ error: 'Failed to load AI assessment' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const body = await request.json().catch(() => null) as { action?: string; runId?: string } | null
  if (!automaticReviewEnvironment().enabled) {
    return NextResponse.json({ error: 'Automatic review is disabled in this environment' }, { status: 409 })
  }
  if (body?.action === 'request') {
    try {
      const result = await requestUcatQuestionAssessment({
        stemId: params.id,
        triggerKind: 'manual_request',
        userClient: access.userClient as unknown as SupabaseClient<Database>,
      })
      if (result.kind === 'skipped') {
        return NextResponse.json({ error: 'This question stem is not eligible for AI review' }, { status: 409 })
      }
      if (result.kind === 'disabled') {
        return NextResponse.json({ error: 'Automatic review is disabled in this environment' }, { status: 409 })
      }
      return NextResponse.json(result, { status: result.kind === 'queued' ? 202 : 200 })
    } catch (requestError) {
      return NextResponse.json({
        error: requestError instanceof Error ? requestError.message : 'Could not request AI review',
      }, { status: 409 })
    }
  }
  if (body?.action !== 'retry' || !body.runId) {
    return NextResponse.json({ error: 'Invalid AI review request' }, { status: 400 })
  }
  const admin = getServiceRoleClient()
  const { data: run, error } = await asAny(admin)
    .from('ucat_ai_question_assessment_runs')
    .select('id,stem_id,status')
    .eq('id', body.runId)
    .eq('stem_id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!run || run.status !== 'failed') {
    return NextResponse.json({ error: 'Only an unavailable review can be retried' }, { status: 409 })
  }
  try {
    const queued = await retryUcatQuestionAssessmentRun(body.runId)
    return NextResponse.json({ queued })
  } catch (retryError) {
    return NextResponse.json({
      error: retryError instanceof Error ? retryError.message : 'Could not retry AI review',
    }, { status: 409 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const body = await request.json().catch(() => null) as {
    runId?: string
    findingKey?: string
    decision?: 'dismissed' | 'suggestion_accepted' | 'suggestion_rejected'
    reason?: string | null
  } | null
  if (!body?.runId || !body.findingKey || !body.decision) {
    return NextResponse.json({ error: 'Invalid assessment decision' }, { status: 400 })
  }
  const reason = body.reason?.trim() || null
  if (body.decision === 'dismissed' && !reason) {
    return NextResponse.json({ error: 'A reason is required when dismissing a finding' }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  const [{ data: run, error: runError }, snapshot, { data: staffId, error: staffError }] = await Promise.all([
    asAny(admin)
      .from('ucat_ai_question_assessment_runs')
      .select('id,cycle_id,stem_id,status,content_fingerprint,shared_fingerprint,question_fingerprints,assessment_result')
      .eq('id', body.runId)
      .eq('stem_id', params.id)
      .maybeSingle(),
    loadUcatAssessmentSnapshot(admin, params.id),
    asAny(access.userClient as unknown as SupabaseClient<Database>).rpc('current_tutor_id'),
  ])
  if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 })
  if (!run || !snapshot || run.status !== 'completed') {
    return NextResponse.json({ error: 'Assessment finding is unavailable' }, { status: 409 })
  }
  const parsed = UcatAssessmentResponseSchema.safeParse(run.assessment_result)
  const finding = parsed.success
    ? parsed.data.findings.find((candidate) => candidate.key === body.findingKey)
    : null
  if (!finding) return NextResponse.json({ error: 'Assessment finding not found' }, { status: 404 })
  const { data: cycle, error: cycleError } = await asAny(admin)
    .from('ucat_ai_question_assessment_cycles')
    .select('is_current')
    .eq('id', run.cycle_id)
    .maybeSingle()
  if (cycleError) return NextResponse.json({ error: cycleError.message }, { status: 500 })
  const currentFingerprints = fingerprintUcatAssessmentSnapshot(snapshot)
  const questionFingerprints = run.question_fingerprints as Record<string, string>
  const findingIsCurrent = cycle?.is_current === true && (
    finding.scopeType === 'shared'
      ? run.shared_fingerprint === currentFingerprints.shared
      : Boolean(
          finding.questionId
          && questionFingerprints?.[finding.questionId] === currentFingerprints.questions[finding.questionId],
        )
  )
  if (!findingIsCurrent) {
    return NextResponse.json({ error: 'This finding is for an older saved version' }, { status: 409 })
  }
  if (body.decision !== 'dismissed' && !finding.suggestion) {
    return NextResponse.json({ error: 'This finding has no suggestion' }, { status: 409 })
  }

  const { data: inserted, error: insertError } = await asAny(admin)
    .from('ucat_ai_question_assessment_decisions')
    .insert({
      run_id: run.id,
      stem_id: params.id,
      finding_key: finding.key,
      decision: body.decision,
      reason,
      reviewed_content_fingerprint: run.content_fingerprint,
      patch: finding.suggestion ? finding.suggestion.patches as unknown as Json : null,
      decided_by: typeof staffId === 'string' ? staffId : null,
    })
    .select('id,run_id,finding_key,decision,reason,reviewed_content_fingerprint,patch,decided_by,decided_at')
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json({ decision: inserted })
}
