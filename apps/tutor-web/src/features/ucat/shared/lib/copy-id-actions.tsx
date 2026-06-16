'use client'

import { Copy } from 'lucide-react'
import type { Json } from '@altitutor/shared'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { BLOCK_TYPE_LABELS } from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import type { DraftBlock } from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import type { UcatRowAction, UcatRowSubAction } from '@/features/ucat/shared/row-actions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type UcatCopyIdEntry = {
  label: string
  id: string
  description?: string
  children?: UcatCopyIdEntry[]
}

const COPY_ID_DESCRIPTION_MAX_LENGTH = 56

export function truncateCopyIdDescription(text: string, maxLength = COPY_ID_DESCRIPTION_MAX_LENGTH): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

export function withCopyIdDescription(text: string | null | undefined): string | undefined {
  const truncated = truncateCopyIdDescription(text ?? '')
  return truncated || undefined
}

function mapCopyIdEntry(
  entry: UcatCopyIdEntry,
  copyId: (id: string) => void | Promise<void>,
): UcatRowSubAction {
  if (entry.children && entry.children.length > 0) {
    return {
      label: entry.label,
      description: entry.description,
      children: entry.children.map((child) => mapCopyIdEntry(child, copyId)),
    }
  }

  return {
    label: entry.label,
    description: entry.description,
    onClick: () => {
      void copyId(entry.id)
    },
  }
}

export function buildCopyIdRowAction(
  entries: UcatCopyIdEntry[],
  copyId: (id: string) => void | Promise<void>,
): UcatRowAction | null {
  const validEntries = entries.filter((entry) => entry.id)
  if (validEntries.length === 0) return null

  if (validEntries.length === 1 && !validEntries[0].children?.length) {
    return {
      label: 'Copy ID',
      icon: <Copy className="h-4 w-4" />,
      description: validEntries[0].description,
      onClick: () => {
        void copyId(validEntries[0].id)
      },
    }
  }

  return {
    label: 'Copy ID',
    icon: <Copy className="h-4 w-4" />,
    children: validEntries.map((entry) => mapCopyIdEntry(entry, copyId)),
  }
}

function displayIndex(storedIndex: number | null | undefined, fallback: number): number {
  return storedIndex ?? fallback
}

export function buildStemCopyIdEntries(initial: StemDetailRow): UcatCopyIdEntry[] {
  const stemDescription = withCopyIdDescription(proseMirrorToPlainText(initial.stem_text))
  const entries: UcatCopyIdEntry[] = [
    { label: 'Question stem', id: initial.id, description: stemDescription },
  ]

  for (const [arrayIndex, question] of (initial.questions ?? []).entries()) {
    const questionNumber = displayIndex(question.index, arrayIndex + 1)
    const questionLabel = `Question ${questionNumber}`
    const questionDescription = withCopyIdDescription(proseMirrorToPlainText(question.question_text))
    const options = question.answer_options ?? []

    if (options.length > 0) {
      entries.push({
        label: questionLabel,
        id: question.id,
        description: questionDescription,
        children: [
          { label: 'Question ID', id: question.id, description: questionDescription },
          ...options.map((option, optionIndex) => ({
            label: `Option ${displayIndex(option.index, optionIndex + 1)}`,
            id: option.id,
            description: withCopyIdDescription(proseMirrorToPlainText(option.answer_text)),
          })),
        ],
      })
      continue
    }

    entries.push({ label: questionLabel, id: question.id, description: questionDescription })
  }

  return entries
}

export function summarizeLearningModuleBlock(block: DraftBlock): string | undefined {
  switch (block.block_type) {
    case 'text':
      return withCopyIdDescription(
        proseMirrorToPlainText((block.content.body ?? null) as Json | null),
      )
    case 'video':
      return withCopyIdDescription(String(block.content.url ?? ''))
    case 'file':
      return withCopyIdDescription(String(block.content.label ?? '')) ?? BLOCK_TYPE_LABELS.file
    case 'question_stem':
      return block.question_stem_id ? `Stem ${block.question_stem_id}` : BLOCK_TYPE_LABELS.question_stem
    case 'question':
      return block.question_id ? `Question ${block.question_id}` : BLOCK_TYPE_LABELS.question
    case 'skill_trainer_set':
      return block.skill_trainer_set_id
        ? `Set ${block.skill_trainer_set_id}`
        : BLOCK_TYPE_LABELS.skill_trainer_set
    default:
      return BLOCK_TYPE_LABELS[block.block_type]
  }
}
