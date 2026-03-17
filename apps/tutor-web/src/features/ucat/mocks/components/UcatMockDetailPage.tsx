'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button, useToast } from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { useUcatMockDraft } from '@/features/ucat/mocks/hooks/useUcatMockDraft'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { UcatVisibilityCascadeWarning } from '@/features/ucat/shared/components/UcatVisibilityCascadeWarning'
import { UcatMockEditorContent } from '@/features/ucat/mocks/components/UcatMockEditorContent'

type SetOption = {
  id: string
  name: string
  sectionDisplay: string
  question_count: number | null
  time_limit_seconds: number | null
  is_private?: boolean | null
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

type UcatMockDetailPageProps = {
  mockId: string
}

export function UcatMockDetailPage({ mockId }: UcatMockDetailPageProps) {
  const { toast } = useToast()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const [search, setSearch] = useState('')

  const {
    detail,
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
  } = useUcatMockDraft({ open: true, mockId })

  const setCatalog = useMemo<SetOption[]>(() => {
    return (sets.data ?? [])
      .filter((set) => (set as { deleted_at?: string | null }).deleted_at == null)
      .map((set) => ({
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: formatSectionsDisplay(set.sections ?? null),
        question_count: set.question_count ?? null,
        time_limit_seconds: set.time_limit_seconds ?? null,
        is_private: (set as { is_private?: boolean | null }).is_private ?? null,
      }))
  }, [sets.data])

  const setsThatWillBecomePublicCount = useMemo(() => {
    if (isPrivate) return 0
    return draftSetIds.filter((id) => setCatalog.find((s) => s.id === id)?.is_private).length
  }, [draftSetIds, isPrivate, setCatalog])

  const isLoading = access.isLoading || sets.isLoading || detail.isLoading

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="p-6">
      <UcatPageHeader
        title="Edit UCAT Mock"
        description={detail.data?.name ? detail.data.name : 'Edit mock exam'}
        backHref="/ucat/mocks"
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Mocks', href: '/ucat/mocks' },
          { label: detail.data?.name ?? 'Mock' },
        ]}
        actions={
          <Button
            onClick={async () => {
              try {
                await save()
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
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

      {setsThatWillBecomePublicCount > 0 && (
        <UcatVisibilityCascadeWarning type="mock" count={setsThatWillBecomePublicCount} />
      )}
      <div className="mt-4 h-[70vh] rounded-md border overflow-hidden">
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
          setCatalog={setCatalog}
        />
      </div>
    </div>
  )
}

