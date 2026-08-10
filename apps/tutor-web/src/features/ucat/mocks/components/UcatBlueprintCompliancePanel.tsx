import { Badge } from '@altitutor/ui'
import type { StoredBlueprintCompliance } from '@/features/ucat/mocks/lib/blueprint-compliance'

const labels: Record<string, string> = {
  verbal_reasoning: 'Verbal Reasoning',
  decision_making: 'Decision Making',
  quantitative_reasoning: 'Quantitative Reasoning',
  situational_judgement: 'Situational Judgement',
}

export function UcatBlueprintCompliancePanel({ compliance }: { compliance: StoredBlueprintCompliance | null }) {
  if (!compliance?.applicable) {
    return <p className="text-xs text-muted-foreground">No full-mock blueprint selected. Focused and ordinary sets remain unconstrained.</p>
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Blueprint compliance</p>
        <Badge variant={compliance.compliant ? 'default' : 'destructive'}>
          {compliance.compliant ? 'Compliant' : 'Needs attention'}
        </Badge>
      </div>
      {compliance.sections.map(section => (
        <div key={section.section} className="space-y-1.5">
          <p className="text-xs font-semibold">{labels[section.section] ?? section.section}</p>
          {section.checks.map((check, index) => (
            <div key={`${check.code}-${check.label}-${index}`} className="rounded border bg-muted/20 px-2 py-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span>{check.label}</span>
                <span className={check.compliant ? 'text-emerald-700' : 'font-medium text-destructive'}>
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
