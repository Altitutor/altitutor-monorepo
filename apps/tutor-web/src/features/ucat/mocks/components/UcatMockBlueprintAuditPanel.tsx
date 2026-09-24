import React from 'react'
import { Button, SearchableSelect } from '@altitutor/ui'
import { UcatBlueprintCompliancePanel } from '@/features/ucat/mocks/components/UcatBlueprintCompliancePanel'
import type { UcatMockBlueprintCandidateController } from '@/features/ucat/mocks/hooks/useUcatMockBlueprintCandidate'

export function UcatMockBlueprintAuditPanel({
  blueprints,
  controller,
}: {
  blueprints: Array<{ id: string; code: string; test_year: number; version: number }>
  controller: UcatMockBlueprintCandidateController
}) {
  const candidate = blueprints.find(blueprint => blueprint.id === controller.candidateBlueprintId)
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Full-mock blueprint</span>
        <SearchableSelect<{ value: string; label: string }>
          items={[
            { value: 'none', label: 'None — focused or ordinary practice' },
            ...blueprints.map(blueprint => ({
              value: blueprint.id,
              label: `${blueprint.test_year} v${blueprint.version} · ${blueprint.code}`,
            })),
          ]}
          value={controller.candidateBlueprintId == null
            ? { value: 'none', label: 'None — focused or ordinary practice' }
            : candidate
              ? { value: candidate.id, label: `${candidate.test_year} v${candidate.version} · ${candidate.code}` }
              : null}
          onValueChange={item => controller.setCandidateBlueprintId(item?.value === 'none' ? null : item?.value ?? null)}
          getItemLabel={item => item.label}
          getItemId={item => item.value}
        />
      </label>
      <UcatBlueprintCompliancePanel compliance={controller.compliance} />
      {controller.candidateBlueprintId ? (
        <div className="space-y-2 rounded-lg border p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Eligibility audit</p>
            <span className="text-muted-foreground">
              {controller.candidateBlueprintId === controller.attachedBlueprintId ? 'Attached candidate' : 'Not attached'}
            </span>
          </div>
          {controller.latestAudit ? (
            <div className="space-y-1">
              <p className="font-medium capitalize">{controller.latestAudit.decision}</p>
              <p className="text-muted-foreground">Checked {new Date(controller.latestAudit.checkedAt).toLocaleString()}</p>
              <p>{controller.latestAudit.gateResults.publicationState.reason}</p>
              <p>{controller.latestAudit.gateResults.sectionPurity.reason}</p>
              <p>{controller.latestAudit.gateResults.provisionalMetadata.reason}</p>
              <div className="pt-1">
                <p className="mb-2 font-semibold">Stored audit snapshot</p>
                <UcatBlueprintCompliancePanel compliance={controller.latestAudit.gateResults.compliance} />
              </div>
            </div>
          ) : <p className="text-muted-foreground">Run the durable audit before attaching this blueprint.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={controller.auditCandidate} disabled={controller.auditPending}>
              {controller.auditPending ? 'Auditing…' : 'Run audit'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={controller.confirmCandidate}
              disabled={controller.confirmPending || controller.latestAudit?.decision !== 'eligible'
                || controller.candidateBlueprintId === controller.attachedBlueprintId}
            >
              {controller.confirmPending ? 'Confirming…' : 'Confirm and attach'}
            </Button>
          </div>
          {controller.latestAudit?.decision === 'provisional' ? (
            <p className="font-medium text-amber-700">Review the unresolved category or presentation metadata, then run the audit again.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
