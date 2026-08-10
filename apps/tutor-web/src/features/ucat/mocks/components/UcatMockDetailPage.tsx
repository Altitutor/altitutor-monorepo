'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button, useToast } from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { useUcatMockDraft } from '@/features/ucat/mocks/hooks/useUcatMockDraft'
import {
  useAuditUcatMockBlueprint,
  useConfirmUcatMockBlueprintAudit,
  useUcatMockBlueprintAudits,
  useUcatMockBlueprints,
} from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { UcatMockEditorContent } from '@/features/ucat/mocks/components/UcatMockEditorContent'
import { parseSetSections } from '@/features/ucat/shared/lib/set-section-status'
import { buildSetCatalogFilterDefinitions } from '@/features/ucat/shared/lib/set-catalog-filters'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { useUcatStemCatalog } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  evaluateDraftMockBlueprint,
  evaluationToStoredCompliance,
  parseStoredBlueprintCompliance,
  parseStoredMockBlueprintAudit,
  blueprintRowToModel,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

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
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const blueprintsQuery = useUcatMockBlueprints()
  const auditsQuery = useUcatMockBlueprintAudits(mockId)
  const auditBlueprint = useAuditUcatMockBlueprint()
  const confirmBlueprintAudit = useConfirmUcatMockBlueprintAudit()
  const stemCatalogQuery = useUcatStemCatalog(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [candidateBlueprintId, setCandidateBlueprintId] = useState<string | null>(null)

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

  useEffect(() => {
    setCandidateBlueprintId(blueprintId)
  }, [blueprintId, mockId])

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
  const blueprintCompliance = useMemo(() => {
    if (!candidateBlueprintId) return parseStoredBlueprintCompliance(detail.data?.blueprint_compliance)
    const row = (blueprintsQuery.data ?? []).find(candidate => candidate.id === candidateBlueprintId)
    const blueprint = row?.code && row.test_year != null && row.version != null
      && row.official_facts_label && row.altitutor_policy_label
      ? blueprintRowToModel({
          code: row.code,
          test_year: row.test_year,
          version: row.version,
          official_facts_label: row.official_facts_label,
          altitutor_policy_label: row.altitutor_policy_label,
          sections: row.sections,
        })
      : null
    if (!blueprint) return parseStoredBlueprintCompliance(detail.data?.blueprint_compliance)
    return evaluationToStoredCompliance(evaluateDraftMockBlueprint(
      blueprint,
      draftSetIds,
      setCatalog,
      stemCatalogQuery.data ?? [],
    ))
  }, [candidateBlueprintId, blueprintsQuery.data, detail.data?.blueprint_compliance, draftSetIds, setCatalog, stemCatalogQuery.data])
  const latestCandidateAudit = useMemo(() => (auditsQuery.data ?? [])
    .map(parseStoredMockBlueprintAudit)
    .find((audit) => audit?.blueprintId === candidateBlueprintId) ?? null,
  [auditsQuery.data, candidateBlueprintId])

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
          blueprints={blueprints}
          attachedBlueprintId={blueprintId}
          candidateBlueprintId={candidateBlueprintId}
          setCandidateBlueprintId={setCandidateBlueprintId}
          blueprintCompliance={blueprintCompliance}
          latestCandidateAudit={latestCandidateAudit}
          auditPending={auditBlueprint.isPending}
          confirmPending={confirmBlueprintAudit.isPending}
          onAuditCandidate={async () => {
            if (!candidateBlueprintId) return
            try {
              await auditBlueprint.mutateAsync({ mockId, blueprintId: candidateBlueprintId })
            } catch (error) {
              toast({ title: 'Blueprint audit failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
            }
          }}
          onConfirmCandidate={async () => {
            if (!latestCandidateAudit) return
            try {
              await confirmBlueprintAudit.mutateAsync({ mockId, auditId: latestCandidateAudit.id })
              toast({ title: 'Blueprint attached', description: 'Every live gate passed the confirmation re-check.' })
            } catch (error) {
              toast({ title: 'Blueprint confirmation failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
            }
          }}
        />
      </div>
    </div>
  )
}
