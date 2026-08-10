import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@altitutor/ui'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import {
  useAuditUcatMockBlueprint,
  useConfirmUcatMockBlueprintAudit,
  useUcatMockBlueprintAudits,
} from '@/features/ucat/mocks/hooks/useUcatMocks'
import {
  blueprintRowToModel,
  evaluateDraftMockBlueprint,
  evaluationToStoredCompliance,
  parseStoredBlueprintCompliance,
  parseStoredMockBlueprintAudit,
  type BlueprintRow,
  type StoredBlueprintCompliance,
  type StoredMockBlueprintAudit,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

export type UcatMockBlueprintCandidateController = {
  attachedBlueprintId: string | null
  candidateBlueprintId: string | null
  setCandidateBlueprintId: (value: string | null) => void
  compliance: StoredBlueprintCompliance | null
  latestAudit: StoredMockBlueprintAudit | null
  auditPending: boolean
  confirmPending: boolean
  auditCandidate: () => Promise<void>
  confirmCandidate: () => Promise<void>
}

export function useUcatMockBlueprintCandidate({
  mockId,
  attachedBlueprintId,
  storedCompliance,
  blueprints,
  draftSetIds,
  setCatalog,
  stemCatalog,
}: {
  mockId: string
  attachedBlueprintId: string | null
  storedCompliance: unknown
  blueprints: BlueprintRow[]
  draftSetIds: string[]
  setCatalog: SetOption[]
  stemCatalog: UcatStemCatalogItem[]
}): UcatMockBlueprintCandidateController {
  const { toast } = useToast()
  const auditsQuery = useUcatMockBlueprintAudits(mockId)
  const auditBlueprint = useAuditUcatMockBlueprint()
  const confirmBlueprintAudit = useConfirmUcatMockBlueprintAudit()
  const [candidateBlueprintId, setCandidateBlueprintId] = useState<string | null>(null)

  useEffect(() => {
    setCandidateBlueprintId(attachedBlueprintId)
  }, [attachedBlueprintId, mockId])

  const compliance = useMemo(() => {
    if (!candidateBlueprintId) return parseStoredBlueprintCompliance(storedCompliance)
    const blueprint = blueprintRowToModel(blueprints.find(candidate => candidate.id === candidateBlueprintId) ?? {
      code: null,
      test_year: null,
      version: null,
      official_facts_label: null,
      altitutor_policy_label: null,
      sections: null,
    })
    return blueprint
      ? evaluationToStoredCompliance(evaluateDraftMockBlueprint(blueprint, draftSetIds, setCatalog, stemCatalog))
      : parseStoredBlueprintCompliance(storedCompliance)
  }, [blueprints, candidateBlueprintId, draftSetIds, setCatalog, stemCatalog, storedCompliance])

  const latestAudit = useMemo(() => (auditsQuery.data ?? [])
    .map(parseStoredMockBlueprintAudit)
    .find(audit => audit?.blueprintId === candidateBlueprintId) ?? null,
  [auditsQuery.data, candidateBlueprintId])

  return {
    attachedBlueprintId,
    candidateBlueprintId,
    setCandidateBlueprintId,
    compliance,
    latestAudit,
    auditPending: auditBlueprint.isPending,
    confirmPending: confirmBlueprintAudit.isPending,
    auditCandidate: async () => {
      if (!candidateBlueprintId) return
      try {
        await auditBlueprint.mutateAsync({ mockId, blueprintId: candidateBlueprintId })
      } catch (error) {
        toast({ title: 'Blueprint audit failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
      }
    },
    confirmCandidate: async () => {
      if (!latestAudit) return
      try {
        await confirmBlueprintAudit.mutateAsync({ mockId, auditId: latestAudit.id })
        toast({ title: 'Blueprint attached', description: 'Every live gate passed the confirmation re-check.' })
      } catch (error) {
        toast({ title: 'Blueprint confirmation failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' })
      }
    },
  }
}
