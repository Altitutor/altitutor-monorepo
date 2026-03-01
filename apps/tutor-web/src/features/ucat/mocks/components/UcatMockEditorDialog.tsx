'use client'

import { useMemo, useState } from 'react'
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
  onEditSet: _onEditSet,
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

  const {
    name,
    isPrivate,
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
      .filter((set) => (set as { deleted_at?: string | null }).deleted_at == null)
      .map((set) => ({
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: formatSectionsDisplay(set.sections ?? null),
        question_count: set.question_count ?? null,
        time_limit_seconds: set.time_limit_seconds ?? null,
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
        setName={setName}
        setIsPrivate={(value) => setIsPrivate(value)}
        draftSetIds={draftSetIds}
        setDraftSetIds={setDraftSetIds}
        search={search}
        setSearch={setSearch}
        setCatalog={setCatalog}
      />
    </UcatDialogShell>
  )
}
