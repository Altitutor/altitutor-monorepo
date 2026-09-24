import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  executeGeneration,
  type GenerateBody,
  type GenerationActor,
  type PreparedGenerationContext,
} from '@/features/ucat/questions/server/generate-question-stems'
import { upsertUcatGenerationNotification } from '@/features/ucat/questions/server/ucat-generation-notification'
import { enqueueUcatQuestionAssessmentPreparation } from '@/features/ucat/questions/server/ai-assessment/dispatcher'
import { toPersistencePayload } from '@/features/ucat/questions/server/generation-persistence-payload'

export type UcatQuestionGenerationQueueMessage = {
  runId: string
  staffId: string
  body: GenerateBody
  actor: GenerationActor
  prepared: PreparedGenerationContext
}

export async function runBackgroundUcatGeneration(
  input: UcatQuestionGenerationQueueMessage,
): Promise<{ runId: string; stemIds: string[] }> {
  const admin = getServiceRoleClient()
  const existing = await admin
    .from('ucat_ai_generation_runs')
    .select('status, generated_stem_ids')
    .eq('id', input.runId)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data?.status === 'completed') {
    return { runId: input.runId, stemIds: existing.data.generated_stem_ids ?? [] }
  }
  if (!existing.data || existing.data.status === 'failed') {
    return { runId: input.runId, stemIds: existing.data?.generated_stem_ids ?? [] }
  }

  const result = await executeGeneration(
    admin,
    input.body,
    async (event) => {
      const { error } = await admin
        .from('ucat_ai_generation_runs')
        .update({
          progress_step: event.step,
          progress_message: event.message,
          processed_stem_count: event.completedStems ?? 0,
          updated_by: input.staffId,
        })
        .eq('id', input.runId)
      if (error) throw error
    },
    input.actor,
    {
      runId: input.runId,
      prepared: input.prepared,
      deferCompletion: true,
    },
  )

  if (result.status >= 400) {
    const message = typeof result.payload.error === 'string'
      ? result.payload.error
      : 'UCAT question generation failed'
    await finishFailedRun(admin, input, message, result.payload.debug ?? null)
    await upsertUcatGenerationNotification(admin, {
      staffId: input.staffId,
      runId: input.runId,
      status: 'failed',
      requestedStemCount: input.body.stemCount,
      message,
    })
    return { runId: input.runId, stemIds: [] }
  }

  const stems = Array.isArray(result.payload.stems)
    ? result.payload.stems as Array<Record<string, unknown>>
    : []
  const stemIds: string[] = []

  for (const [outputIndex, stem] of stems.entries()) {
    const { data, error } = await admin.rpc('service_ucat_persist_generated_stem', {
      p_run_id: input.runId,
      p_output_index: outputIndex,
      p_stem: toPersistencePayload(stem) as Json,
    })
    if (error) throw error
    if (typeof data === 'string') stemIds.push(data)
  }

  const discardedCount = typeof result.payload.discardedCount === 'number'
    ? result.payload.discardedCount
    : 0
  const { error: completionError } = await admin
    .from('ucat_ai_generation_runs')
    .update({
      status: 'completed',
      progress_step: 'drafts',
      progress_message: 'Questions are ready for review',
      processed_stem_count: input.body.stemCount,
      discarded_stem_count: discardedCount,
      debug_payload: (result.payload.debug ?? null) as Json | null,
      completed_at: new Date().toISOString(),
      updated_by: input.staffId,
    })
    .eq('id', input.runId)
  if (completionError) throw completionError

  await enqueueUcatQuestionAssessmentPreparation({
    stemIds,
    triggerKind: 'review_submission',
    requestedBy: input.staffId,
  }).catch((assessmentError) => {
    console.error('Could not queue automatic UCAT AI assessment preparation after generation', assessmentError)
  })

  await upsertUcatGenerationNotification(admin, {
    staffId: input.staffId,
    runId: input.runId,
    status: 'completed',
    requestedStemCount: input.body.stemCount,
    stemCount: stemIds.length,
    generatedStemIds: stemIds,
  })
  return { runId: input.runId, stemIds }
}

async function finishFailedRun(
  admin: SupabaseClient<Database>,
  input: UcatQuestionGenerationQueueMessage,
  message: string,
  debug: unknown,
) {
  await admin
    .from('ucat_ai_generation_runs')
    .update({
      status: 'failed',
      progress_message: message,
      error_message: message,
      debug_payload: debug as Json | null,
      completed_at: new Date().toISOString(),
      updated_by: input.staffId,
    })
    .eq('id', input.runId)
}
