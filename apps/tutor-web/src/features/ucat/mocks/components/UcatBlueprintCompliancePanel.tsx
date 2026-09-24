import React from 'react'
import { Badge } from '@altitutor/ui'
import { isPublicationBlockingBlueprintCode } from '@altitutor/ucat-blueprint'
import type { StoredBlueprintCompliance } from '@/features/ucat/mocks/lib/blueprint-compliance'

const labels: Record<string, string> = {
  verbal_reasoning: 'Verbal Reasoning',
  decision_making: 'Decision Making',
  quantitative_reasoning: 'Quantitative Reasoning',
  situational_judgement: 'Situational Judgement',
}

function hasNonBlockingMisses(compliance: StoredBlueprintCompliance): boolean {
  return compliance.sections.some(section =>
    section.checks.some(check => !check.compliant && !isPublicationBlockingBlueprintCode(check.code)),
  )
}

export function UcatBlueprintCompliancePanel({ compliance }: { compliance: StoredBlueprintCompliance | null }) {
  if (!compliance?.applicable) {
    return <p className="text-xs text-muted-foreground">No full-mock blueprint selected. Focused and ordinary sets remain unconstrained.</p>
  }

  const warningOnly = compliance.compliant && hasNonBlockingMisses(compliance)

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Blueprint compliance</p>
        <Badge variant={compliance.compliant ? (warningOnly ? 'secondary' : 'default') : 'destructive'}>
          {compliance.compliant ? (warningOnly ? 'Warnings' : 'Compliant') : 'Needs attention'}
        </Badge>
      </div>
      {compliance.reasons?.map((reason, index) => (
        <p
          key={`${reason.code}-${index}`}
          className={reason.severity === 'warning' ? 'text-xs text-amber-700' : 'text-xs text-destructive'}
        >
          {reason.message}
        </p>
      ))}
      {compliance.sections.map(section => (
        <div key={section.section} className="space-y-1.5">
          <p className="text-xs font-semibold">{labels[section.section] ?? section.section}</p>
          {section.checks.map((check, index) => (
            <div key={`${check.code}-${check.label}-${index}`} className="rounded border bg-muted/20 px-2 py-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span>{check.label}</span>
                <span className={
                  check.compliant
                    ? 'text-emerald-700'
                    : isPublicationBlockingBlueprintCode(check.code)
                      ? 'font-medium text-destructive'
                      : 'font-medium text-amber-700'
                }>
                  {check.actual ?? '—'} {check.unit}
                </span>
              </div>
              <p className="text-muted-foreground">{check.reason}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
