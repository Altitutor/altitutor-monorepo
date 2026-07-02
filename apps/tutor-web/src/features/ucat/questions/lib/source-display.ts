import type { Json } from '@altitutor/shared'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'

export function formatSourceChannel(channel?: UcatQuestionSourceChannel | null): string {
  if (channel === 'bulk_import') return 'Bulk import'
  if (channel === 'ai_generation') return 'AI generation'
  return 'Individual add'
}

export function metadataString(metadata: Json | null | undefined, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export type StemSourceDisplay = {
  sourceChannel: UcatQuestionSourceChannel | null
  channelLabel: string
  aiModel: string | null
  generatedAt: string | null
  tutorSourceNote: string | null
}

export function buildStemSourceDisplay(input: {
  sourceChannel?: UcatQuestionSourceChannel | null
  aiGenerationMetadata?: Json | null
  tutorSourceNote?: string | null
}): StemSourceDisplay {
  const sourceChannel = input.sourceChannel ?? 'individual'
  return {
    sourceChannel,
    channelLabel: formatSourceChannel(sourceChannel),
    aiModel: metadataString(input.aiGenerationMetadata ?? null, 'model'),
    generatedAt: metadataString(input.aiGenerationMetadata ?? null, 'generatedAt'),
    tutorSourceNote:
      typeof input.tutorSourceNote === 'string' && input.tutorSourceNote.trim()
        ? input.tutorSourceNote.trim()
        : null,
  }
}

export function stemSourceTooltip(source: StemSourceDisplay): string {
  const lines = [source.channelLabel]
  if (source.sourceChannel === 'ai_generation') {
    lines.push(`Model: ${source.aiModel ?? 'Unknown'}`)
    lines.push(`Generated: ${source.generatedAt ?? 'Unknown'}`)
  }
  if (source.tutorSourceNote) {
    lines.push(`Note: ${source.tutorSourceNote}`)
  }
  return lines.join('\n')
}
