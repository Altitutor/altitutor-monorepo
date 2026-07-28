'use client'

import { useUcatReconciliationHandlers } from './UcatReconciliationContext'
import { ReconciliationSubtypeTabs } from './ReconciliationSubtypeTabs'
import { SetsReconciliationTable } from './SetsReconciliationTable'
import {
  SET_RECONCILIATION_ISSUES,
  type SetIssueSlug,
} from '@/features/ucat/reconciliation/lib/set-issue-definitions'

export function UcatReconciliationSetIssue({ issue }: { issue: SetIssueSlug }) {
  const { onEditSet } = useUcatReconciliationHandlers()
  const definition = SET_RECONCILIATION_ISSUES.find(
    (item) => item.slug === issue,
  )

  if (!definition) return null

  return (
    <div className="space-y-6">
      <ReconciliationSubtypeTabs
        items={SET_RECONCILIATION_ISSUES}
        activeSlug={issue}
        baseHref="/ucat/reconciliation/sets"
        label="Set reconciliation issue types"
      />
      <SetsReconciliationTable
        title={definition.title}
        dataKey={definition.dataKey}
        onEditSet={onEditSet}
        showTimeColumn={definition.showTimeColumn}
      />
    </div>
  )
}
