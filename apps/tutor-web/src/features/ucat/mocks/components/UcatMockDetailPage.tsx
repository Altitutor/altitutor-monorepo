'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { useUcatMockDraft } from '@/features/ucat/mocks/hooks/useUcatMockDraft'
import { useUcatMockBlueprints } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { useUcatMockBlueprintCandidate } from '@/features/ucat/mocks/hooks/useUcatMockBlueprintCandidate'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { lifecycleErrorToast, type UcatLifecycleEntityType } from '@/features/ucat/shared/lifecycle-errors'
import { UcatMockEditorContent } from '@/features/ucat/mocks/components/UcatMockEditorContent'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { parseSetSections } from '@/features/ucat/shared/lib/set-section-status'
import { buildSetCatalogFilterDefinitions } from '@/features/ucat/shared/lib/set-catalog-filters'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { useUcatStemCatalog } from '@/features/ucat/questions/hooks/useUcatQuestions'

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
  const router = useRouter()
  const access = useUcatAccess()
  const sets = useUcatSets()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const blueprintsQuery = useUcatMockBlueprints()
  const stemCatalogQuery = useUcatStemCatalog(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [editingSetId, setEditingSetId] = useState<string | null>(null)

  const setFilterDefinitions = useMemo(
    () => buildSetCatalogFilterDefinitions(sections),
    [sections],
  )

  const {
    detail,
    name,
    isPrivate,
    instructionsText,
    setInstructionsText,
    draftSetIds,
    blueprintId,
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
  const blueprints = useMemo(() => (blueprintsQuery.data ?? []).flatMap(blueprint =>
    blueprint.id && blueprint.code && blueprint.test_year != null && blueprint.version != null
      ? [{ id: blueprint.id, code: blueprint.code, test_year: blueprint.test_year, version: blueprint.version }]
      : []
  ), [blueprintsQuery.data])
  const blueprintCandidate = useUcatMockBlueprintCandidate({
    mockId,
    attachedBlueprintId: blueprintId,
    storedCompliance: detail.data?.blueprint_compliance,
    blueprints: blueprintsQuery.data ?? [],
    draftSetIds,
    setCatalog,
    stemCatalog: stemCatalogQuery.data ?? [],
  })

  const isLoading = access.isLoading || sets.isLoading || detail.isLoading

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
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
                toast(lifecycleErrorToast(error, 'Failed to save', router.push, (entityType: UcatLifecycleEntityType, entityId: string) => {
                  if (entityType === 'set') {
                    setEditingSetId(entityId)
                    return true
                  }
                  return false
                }))
              }
            }}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

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
          filters={filters}
          setFilters={setFilters}
          filterDefinitions={setFilterDefinitions}
          setCatalog={setCatalog}
          setCatalogLoading={sets.isLoading}
          sections={sections}
          onEditSet={setEditingSetId}
          blueprints={blueprints}
          blueprintCandidate={blueprintCandidate}
        />
      </div>

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />
    </div>
  )
}
