import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

export const UCAT_AI_GENERATION_DEDUPE_PREFIX = 'ucat-ai-generation:'

export type UcatGenerationNotificationStatus = 'running' | 'completed' | 'failed'

export type UcatGenerationNotificationMetadata = {
  generationRunId: string
  status: UcatGenerationNotificationStatus
  requestedStemCount?: number
  processedStemCount?: number
  stemCount?: number
  generatedStemIds?: string[]
  progressMessage?: string
  message?: string
}

type AdminClient = SupabaseClient<Database>

function dedupeKey(runId: string): string {
  return `${UCAT_AI_GENERATION_DEDUPE_PREFIX}${runId}`
}

function actionUrl(runId: string): string {
  return `/ucat/questions?tab=in_review&generationRun=${runId}`
}

export async function upsertUcatGenerationNotification(
  admin: AdminClient,
  input: {
    staffId: string
    runId: string
    status: UcatGenerationNotificationStatus
    requestedStemCount?: number
    processedStemCount?: number
    stemCount?: number
    generatedStemIds?: string[]
    progressMessage?: string
    message?: string
  },
): Promise<void> {
  const metadata: UcatGenerationNotificationMetadata = {
    generationRunId: input.runId,
    status: input.status,
    requestedStemCount: input.requestedStemCount,
    processedStemCount: input.processedStemCount,
    stemCount: input.stemCount,
    generatedStemIds: input.generatedStemIds,
    progressMessage: input.progressMessage,
    message: input.message,
  }

  const copy = buildCopy(input)
  const { error } = await admin.from('notifications').upsert(
    {
      staff_id: input.staffId,
      notification_type: `ucat.ai_generation.${input.status}`,
      app_scope: 'staff_web',
      title: copy.title,
      body: copy.body,
      action_url: input.status === 'completed' ? actionUrl(input.runId) : null,
      dedupe_key: dedupeKey(input.runId),
      metadata: metadata as Json,
      read_at: null,
      dismissed_at: null,
    },
    { onConflict: 'dedupe_key' },
  )
  if (error) throw error
}

function buildCopy(input: {
  status: UcatGenerationNotificationStatus
  requestedStemCount?: number
  processedStemCount?: number
  stemCount?: number
  progressMessage?: string
  message?: string
}): { title: string; body: string } {
  switch (input.status) {
    case 'running': {
      const total = input.requestedStemCount ?? 0
      const processed = input.processedStemCount ?? 0
      const progressLabel = total > 0 ? `${processed} / ${total}` : null
      return {
        title: 'AI generation in progress',
        body: input.progressMessage
          ?? (progressLabel ? `Generating questions (${progressLabel})` : 'Generating questions…'),
      }
    }
    case 'completed': {
      const stemCount = input.stemCount ?? 0
      const noun = stemCount === 1 ? 'question stem is' : 'question stems are'
      return {
        title: 'AI questions ready for review',
        body: `${stemCount} ${noun} ready.`,
      }
    }
    case 'failed':
      return {
        title: 'AI generation failed',
        body: input.message ?? 'Unable to generate question stems.',
      }
    default: {
      const _exhaustive: never = input.status
      return _exhaustive
    }
  }
}
