import type { DraftBlock } from '@/features/ucat/learning-modules/lib/learning-module-editor-types'

export type PendingGenerationStatus = 'running' | 'failed' | 'linked'

export type PendingGeneratedAssessmentContent = {
  pendingGeneratedStem: true
  generationRunId: string
  generationStatus: PendingGenerationStatus
  generationBlockIntent: 'question_stem' | 'question'
  generationError?: string
}

export function isPendingGeneratedAssessment(
  content: Record<string, unknown>,
): content is PendingGeneratedAssessmentContent & Record<string, unknown> {
  return (
    content.pendingGeneratedStem === true &&
    typeof content.generationRunId === 'string' &&
    content.generationRunId.length > 0
  )
}

export function isRunBackedPlaceholderWithoutIds(block: DraftBlock): boolean {
  if (!isPendingGeneratedAssessment(block.content)) return false
  if (block.block_type === 'question_stem') return !block.question_stem_id
  if (block.block_type === 'question') return !block.question_id
  return false
}

export function buildPendingGeneratedAssessmentContent(input: {
  generationRunId: string
  generationBlockIntent: 'question_stem' | 'question'
  generationStatus?: PendingGenerationStatus
  generationError?: string
}): PendingGeneratedAssessmentContent {
  return {
    pendingGeneratedStem: true,
    generationRunId: input.generationRunId,
    generationStatus: input.generationStatus ?? 'running',
    generationBlockIntent: input.generationBlockIntent,
    ...(input.generationError ? { generationError: input.generationError } : {}),
  }
}

export function patchPendingGeneratedAssessmentContent(
  content: Record<string, unknown>,
  patch: Partial<Omit<PendingGeneratedAssessmentContent, 'pendingGeneratedStem'>> & {
    pendingGeneratedStem?: boolean
  },
): Record<string, unknown> {
  const next = { ...content, ...patch }
  if (patch.pendingGeneratedStem === false) {
    delete next.pendingGeneratedStem
    delete next.generationRunId
    delete next.generationStatus
    delete next.generationBlockIntent
    delete next.generationError
  }
  if (patch.generationError === undefined && 'generationError' in patch) {
    delete next.generationError
  }
  return next
}
