'use client'

import { Copy } from 'lucide-react'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import type { UcatRowAction, UcatRowSubAction } from '@/features/ucat/shared/row-actions'

export type UcatCopyIdEntry = {
  label: string
  id: string
  children?: UcatCopyIdEntry[]
}

function mapCopyIdEntry(
  entry: UcatCopyIdEntry,
  copyId: (id: string) => void | Promise<void>,
): UcatRowSubAction {
  if (entry.children && entry.children.length > 0) {
    return {
      label: entry.label,
      children: entry.children.map((child) => mapCopyIdEntry(child, copyId)),
    }
  }

  return {
    label: entry.label,
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

export function buildStemCopyIdEntries(initial: StemDetailRow): UcatCopyIdEntry[] {
  const entries: UcatCopyIdEntry[] = [{ label: 'Question stem', id: initial.id }]

  for (const question of initial.questions ?? []) {
    const questionIndex = (question.index ?? 0) + 1
    const questionLabel = `Question ${questionIndex}`
    const options = question.answer_options ?? []

    if (options.length > 0) {
      entries.push({
        label: questionLabel,
        id: question.id,
        children: [
          { label: 'Question ID', id: question.id },
          ...options.map((option, optionIndex) => ({
            label: `Option ${(option.index ?? optionIndex) + 1}`,
            id: option.id,
          })),
        ],
      })
      continue
    }

    entries.push({ label: questionLabel, id: question.id })
  }

  return entries
}
