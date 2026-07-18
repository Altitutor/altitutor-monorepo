'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@altitutor/ui'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatMockDraft } from '@/features/ucat/mocks/hooks/useUcatMockDraft'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { Trash2 } from 'lucide-react'
import { UcatMockEditorContent } from '@/features/ucat/mocks/components/UcatMockEditorContent'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseSetSections } from '@/features/ucat/shared/lib/set-section-status'
import { buildSetCatalogFilterDefinitions } from '@/features/ucat/shared/lib/set-catalog-filters'
import { useUcatStemCatalog } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatStemEditorHeaderControls } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorHeaderControls'
import type { StemEditorMode } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import { UcatMockPreviewContent } from '@/features/ucat/mocks/components/UcatMockPreviewContent'

export type SetOption = {
  id: string
  name: string
  sectionDisplay: string
  sectionCount: number
  firstSectionNumber: number | null
  question_count: number | null
  time_limit_seconds: number | null
  access_scope?: 'public' | 'private' | null
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
  warningPills,
}: {
  open: boolean
  mockId: string | null
  onClose: () => void
  onEditSet?: (setId: string) => void
  onDelete?: () => void
  warningPills?: string[]
}) {
  const sets = useUcatSets()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [editorMode, setEditorMode] = useState<StemEditorMode>('edit')
  const [showAnswer, setShowAnswer] = useState(false)
  const stemCatalogQuery = useUcatStemCatalog(open)

  const setFilterDefinitions = useMemo(
    () => buildSetCatalogFilterDefinitions(sections),
    [sections],
  )

  const { toast } = useToast()
  const { copyId } = useUcatCopyId()
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
      .filter((set) => (set as { deleted_at?: string | null }).deleted_at == null)
      .map((set) => {
        const parsed = parseSetSections(set.sections ?? null)
        return {
          id: set.id ?? '',
          name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
          sectionDisplay: formatSectionsDisplay(set.sections ?? null),
          sectionCount: parsed.sectionCount,
          firstSectionNumber: parsed.firstSectionNumber,
          question_count: set.question_count ?? null,
          time_limit_seconds: set.time_limit_seconds ?? null,
          access_scope: set.access_scope ?? null,
          stem_count: (set as { stem_count?: number | null }).stem_count ?? null,
        }
      })
  }, [sets.data])

  useEffect(() => {
    if (!open) {
      setEditorMode('edit')
      setShowAnswer(false)
    }
  }, [open])

  function handleRequestClose() {
    if (!isDirty || window.confirm('Changes made will be lost. Close without saving?')) {
      onClose()
    }
  }

  const copyIdAction =
    mockId != null
      ? buildCopyIdRowAction(
          [
            { label: 'Mock', id: mockId, description: withCopyIdDescription(name) },
            ...draftSetIds.map((setId, index) => {
              const set = setCatalog.find((entry) => entry.id === setId)
              return {
                label: set?.name ?? `Set ${index + 1}`,
                id: setId,
                description: withCopyIdDescription(set?.sectionDisplay),
              }
            }),
          ],
          copyId,
        )
      : null

  const headerActions = mockId != null ? (
    <UcatRowActions
      actions={[
        ...(copyIdAction ? [copyIdAction] : []),
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
  ) : null

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title="Edit Mock"
      subtitle="Reorder sets and update mock properties"
      onSave={async () => {
        try {
          await save()
          onClose()
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to save mock'
          const parsed = parseUcatVisibilityError(msg)
          toast({
            title: 'Failed to save',
            description: parsed.link ? (
              <span>
                {parsed.textBeforeLink}{' '}
                <Link href={parsed.link.href} className="underline font-medium">
                  {parsed.link.label}
                </Link>
              </span>
            ) : (
              msg
            ),
            variant: 'destructive',
          })
        }
      }}
      saveDisabled={!isDirty || isSaving}
      isSaving={isSaving}
      headerControls={
        <UcatStemEditorHeaderControls
          mode={editorMode}
          onModeChange={setEditorMode}
          showAnswer={showAnswer}
          onShowAnswerChange={setShowAnswer}
        />
      }
      headerActions={headerActions}
      warningPills={warningPills}
      hideCancel
      defaultExpanded
      mobileFullscreen
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {editorMode === 'edit' ? (
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
            setCatalogLoading={sets.isLoading}
            sections={sections}
            onEditSet={onEditSet}
          />
        ) : (
          <UcatMockPreviewContent
            setIds={draftSetIds}
            stemCatalog={stemCatalogQuery.data ?? []}
            showAnswer={showAnswer}
            catalogLoading={stemCatalogQuery.isLoading}
            setCatalog={setCatalog}
          />
        )}
      </div>
    </UcatDialogShell>
  )
}
