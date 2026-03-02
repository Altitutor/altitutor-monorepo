'use client'

import { useMemo, useState } from 'react'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatMockDraft } from '@/features/ucat/mocks/hooks/useUcatMockDraft'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { Trash2 } from 'lucide-react'
import { UcatMockEditorContent } from '@/features/ucat/mocks/components/UcatMockEditorContent'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type SetOption = {
  id: string
  name: string
  sectionDisplay: string
  question_count: number | null
  time_limit_seconds: number | null
  is_private?: boolean | null
  stem_count?: number | null
}

function formatSectionsDisplay(sections: unknown): string {
  if (!Array.isArray(sections)) return ''
  return sections
    .map((s: { section_number?: number; name?: string }) => {
      if (s?.section_number != null && s?.name != null) return `Section ${s.section_number}: ${s.name}`
      if (s?.name) return String(s.name)
      return ''
    })
    .filter(Boolean)
    .join(' · ')
}

export function UcatMockEditorDialog({
  open,
  mockId,
  onClose,
  onEditSet,
  onDelete,
}: {
  open: boolean
  mockId: string | null
  onClose: () => void
  onEditSet?: (setId: string) => void
  onDelete?: () => void
}) {
  const sets = useUcatSets()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})

  const setFilterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
      {
        key: 'time_limit',
        label: 'Time limit (s)',
        type: 'number-range',
        minKey: 'time_limit_min',
        maxKey: 'time_limit_max',
      },
      {
        key: 'stem_count',
        label: 'Question stems',
        type: 'number-range',
        minKey: 'stem_count_min',
        maxKey: 'stem_count_max',
      },
      {
        key: 'question_count',
        label: 'Questions',
        type: 'number-range',
        minKey: 'question_count_min',
        maxKey: 'question_count_max',
      },
    ],
    []
  )

  const {
    name,
    isPrivate,
    instructionsText,
    setInstructionsText,
    draftSetIds,
    setName,
    setIsPrivate,
    setDraftSetIds,
    isDirty,
    save,
    isSaving,
  } = useUcatMockDraft({ open, mockId })

  const setCatalog = useMemo<SetOption[]>(() => {
    return (sets.data ?? [])
      .filter(
        (set) =>
          (set as { deleted_at?: string | null }).deleted_at == null &&
          !(set as { is_student_generated?: boolean }).is_student_generated
      )
      .map((set) => ({
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: formatSectionsDisplay(set.sections ?? null),
        question_count: set.question_count ?? null,
        time_limit_seconds: set.time_limit_seconds ?? null,
        is_private: (set as { is_private?: boolean | null }).is_private ?? null,
        stem_count: (set as { stem_count?: number | null }).stem_count ?? null,
      }))
  }, [sets.data])

  function handleRequestClose() {
    if (!isDirty || window.confirm('Changes made will be lost. Close without saving?')) {
      onClose()
    }
  }

  const headerActions =
    mockId != null
      ? (
          <UcatRowActions
            actions={[
              {
                label: 'Open in page',
                href: `/ucat/mocks/${mockId}`,
              },
              ...(onDelete
                ? [
                    {
                      label: 'Delete',
                      icon: <Trash2 className="h-4 w-4" />,
                      onClick: onDelete,
                      destructive: true,
                    },
                  ]
                : []),
            ]}
          />
        )
      : null

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title="Edit Mock"
      subtitle="Reorder sets and update mock properties"
      onSave={async () => {
        await save()
        if (isDirty) onClose()
      }}
      saveDisabled={!isDirty || isSaving}
      isSaving={isSaving}
      headerActions={headerActions}
      hideCancel
    >
      <UcatMockEditorContent
        name={name}
        isPrivate={isPrivate}
        instructionsText={instructionsText}
        setInstructionsText={setInstructionsText}
        setName={setName}
        setIsPrivate={(value) => setIsPrivate(value)}
        draftSetIds={draftSetIds}
        setDraftSetIds={setDraftSetIds}
        search={search}
        setSearch={setSearch}
        filters={filters}
        setFilters={setFilters}
        filterDefinitions={setFilterDefinitions}
        setCatalog={setCatalog}
        onEditSet={onEditSet}
      />
    </UcatDialogShell>
  )
}
