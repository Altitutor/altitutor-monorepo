import type { Json } from '@altitutor/shared'
import type { UcatQuestionSourceChannel } from '@/features/ucat/questions/api/questions'
import { formatDateTime } from '@/shared/utils'
import { formatRelativeDate } from '@/shared/utils/datetime'

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

export function formatStaffDisplayName(
  firstName?: string | null,
  lastName?: string | null
): string | null {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim()
  return name || null
}

export function formatGeneratedTimestamp(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso.trim()
  const absolute = formatDateTime(parsed)
  const relative = formatRelativeDate(iso)
  if (!absolute) return relative === 'unknown' ? iso.trim() : relative
  return relative === 'unknown' ? absolute : `${absolute} (${relative})`
}

export type StemSourceDisplay = {
  sourceChannel: UcatQuestionSourceChannel | null
  channelLabel: string
  aiModel: string | null
  generatedAt: string | null
  generatedAtLabel: string | null
  generatedByName: string | null
  approvedByName: string | null
  approvedAt: string | null
  approvedAtLabel: string | null
  tutorSourceNote: string | null
}

export function buildStemSourceDisplay(input: {
  sourceChannel?: UcatQuestionSourceChannel | null
  aiGenerationMetadata?: Json | null
  tutorSourceNote?: string | null
  createdByFirstName?: string | null
  createdByLastName?: string | null
  approvedByFirstName?: string | null
  approvedByLastName?: string | null
  approvedAt?: string | null
}): StemSourceDisplay {
  const sourceChannel = input.sourceChannel ?? 'individual'
  const generatedAt = metadataString(input.aiGenerationMetadata ?? null, 'generatedAt')
  const approvedAt = input.approvedAt?.trim() ? input.approvedAt.trim() : null
  return {
    sourceChannel,
    channelLabel: formatSourceChannel(sourceChannel),
    aiModel: metadataString(input.aiGenerationMetadata ?? null, 'model'),
    generatedAt,
    generatedAtLabel: formatGeneratedTimestamp(generatedAt),
    generatedByName: formatStaffDisplayName(input.createdByFirstName, input.createdByLastName),
    approvedByName: formatStaffDisplayName(input.approvedByFirstName, input.approvedByLastName),
    approvedAt,
    approvedAtLabel: formatGeneratedTimestamp(approvedAt),
    tutorSourceNote:
      typeof input.tutorSourceNote === 'string' && input.tutorSourceNote.trim()
        ? input.tutorSourceNote.trim()
        : null,
  }
}

export function stemSourceTooltip(source: StemSourceDisplay): string {
  const lines = [source.channelLabel]
  if (source.generatedByName) {
    lines.push(`Created by: ${source.generatedByName}`)
  }
  if (source.sourceChannel === 'ai_generation') {
    lines.push(`Model: ${source.aiModel ?? 'Unknown'}`)
    lines.push(`Generated: ${source.generatedAtLabel ?? source.generatedAt ?? 'Unknown'}`)
  }
  if (source.approvedByName) {
    lines.push(`Approved by: ${source.approvedByName}`)
  }
  if (source.approvedAtLabel) {
    lines.push(`Approved at: ${source.approvedAtLabel}`)
  }
  if (source.tutorSourceNote) {
    lines.push(`Note: ${source.tutorSourceNote}`)
  }
  return lines.join('\n')
}
