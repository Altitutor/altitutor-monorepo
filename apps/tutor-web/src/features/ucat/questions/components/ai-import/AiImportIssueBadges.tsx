'use client'

import type { AiImportIssue } from '@/features/ucat/questions/lib/ai-import/schema'

type AiImportIssueBadgesProps = {
  issues: AiImportIssue[]
}

const SEVERITY_CLASS: Record<AiImportIssue['severity'], string> = {
  low: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  medium: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  high: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function AiImportIssueBadges({ issues }: AiImportIssueBadgesProps) {
  if (issues.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {issues.map((issue, index) => (
        <span
          key={`${issue.code}-${index}`}
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${SEVERITY_CLASS[issue.severity]}`}
          title={issue.message}
        >
          {issue.code.replaceAll('_', ' ')}
        </span>
      ))}
    </div>
  )
}
