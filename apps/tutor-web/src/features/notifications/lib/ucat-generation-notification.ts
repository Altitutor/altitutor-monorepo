import type { Json } from '@altitutor/shared'
import type { UcatGenerationRun } from '@/features/ucat/questions/api/questions'

export const UCAT_AI_GENERATION_NOTIFICATION_PREFIX = 'ucat.ai_generation.'

export type UcatGenerationNotificationMetadata = {
  generationRunId: string
  status: 'running' | 'completed' | 'failed'
  requestedStemCount?: number
  processedStemCount?: number
  stemCount?: number
  generatedStemIds?: string[]
  progressMessage?: string
  message?: string
}

export function isUcatGenerationNotificationType(notificationType: string | null | undefined): boolean {
  return typeof notificationType === 'string'
    && notificationType.startsWith(UCAT_AI_GENERATION_NOTIFICATION_PREFIX)
}

export function parseUcatGenerationNotificationMetadata(
  metadata: Json | null | undefined,
): UcatGenerationNotificationMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const record = metadata as Record<string, unknown>
  const generationRunId = typeof record.generationRunId === 'string' ? record.generationRunId : null
  const status = record.status
  if (!generationRunId) return null
  if (status !== 'running' && status !== 'completed' && status !== 'failed') {
    // Legacy completed notifications only stored generationRunId + stemCount.
    if (typeof record.stemCount === 'number') {
      return {
        generationRunId,
        status: 'completed',
        stemCount: record.stemCount,
      }
    }
    return {
      generationRunId,
      status: 'completed',
    }
  }
  return {
    generationRunId,
    status,
    requestedStemCount: typeof record.requestedStemCount === 'number' ? record.requestedStemCount : undefined,
    processedStemCount: typeof record.processedStemCount === 'number' ? record.processedStemCount : undefined,
    stemCount: typeof record.stemCount === 'number' ? record.stemCount : undefined,
    generatedStemIds: Array.isArray(record.generatedStemIds)
      ? record.generatedStemIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    progressMessage: typeof record.progressMessage === 'string' ? record.progressMessage : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  }
}

export type GenerationNotificationProgress = {
  status: 'running' | 'completed' | 'failed'
  message: string
  processed: number
  total: number
  percent: number
  runId: string | null
}

export function resolveGenerationNotificationProgress(input: {
  notificationType: string | null | undefined
  metadata: Json | null | undefined
  body: string | null | undefined
  run: UcatGenerationRun | null
}): GenerationNotificationProgress | null {
  if (!isUcatGenerationNotificationType(input.notificationType)) return null

  const metadata = parseUcatGenerationNotificationMetadata(input.metadata)
  const run = input.run

  if (run?.status === 'running' || (run == null && metadata?.status === 'running')) {
    const total = run?.requested_stem_count ?? metadata?.requestedStemCount ?? 0
    const processed = run?.processed_stem_count ?? metadata?.processedStemCount ?? 0
    const message = run?.progress_message
      ?? metadata?.progressMessage
      ?? input.body
      ?? 'Generating questions…'
    return {
      status: 'running',
      message,
      processed,
      total,
      percent: total > 0 ? Math.min(96, Math.round((processed / total) * 100)) : 5,
      runId: run?.id ?? metadata?.generationRunId ?? null,
    }
  }

  if (run?.status === 'failed' || metadata?.status === 'failed' || input.notificationType === 'ucat.ai_generation.failed') {
    return {
      status: 'failed',
      message: run?.error_message
        ?? run?.progress_message
        ?? metadata?.message
        ?? input.body
        ?? 'Unable to generate question stems.',
      processed: run?.processed_stem_count ?? metadata?.processedStemCount ?? 0,
      total: run?.requested_stem_count ?? metadata?.requestedStemCount ?? 0,
      percent: 0,
      runId: run?.id ?? metadata?.generationRunId ?? null,
    }
  }

  const accepted = run?.accepted_stem_count ?? metadata?.stemCount ?? 0
  const total = run?.requested_stem_count ?? metadata?.requestedStemCount ?? accepted
  return {
    status: 'completed',
    message: input.body ?? `${accepted} question stem${accepted === 1 ? '' : 's'} ready.`,
    processed: accepted,
    total,
    percent: 100,
    runId: run?.id ?? metadata?.generationRunId ?? null,
  }
}
