'use client'

import { Button, TableCell, TableRow } from '@altitutor/ui'
import { ReconciliationTable } from './ReconciliationTable'
import { getQuestionIssueDefinition } from '../lib/question-issue-definitions'
import { useReconciliationData } from '@/features/ucat/reconciliation/hooks/useReconciliation'
import type { DownvotedExplanation } from '@/features/ucat/reconciliation/api/reconciliation'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { tutorBtnOutline, tutorTableBodyRow } from '@/shared/lib/tutor-visual'

const ISSUE = getQuestionIssueDefinition('downvoted-explanations')
const columns = [
  { key: 'section', label: 'Section', visibleByDefault: true },
  { key: 'question', label: 'Question', visibleByDefault: true },
  { key: 'votes', label: 'Votes', visibleByDefault: true },
  { key: 'reasons', label: 'Reasons / comments', visibleByDefault: true },
]

function preview(value: unknown, max = 100) {
  const text = proseMirrorToPlainText(value as import('@altitutor/shared').Json) ?? ''
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

export function DownvotedExplanationsTable({
  onOpenStemDialog,
  showCountBadge = true,
}: {
  onOpenStemDialog?: (stemId: string) => void
  showCountBadge?: boolean
}) {
  const { data, isLoading } = useReconciliationData()
  const items = data?.downvotedExplanations ?? []

  return (
    <ReconciliationTable<DownvotedExplanation>
      title={ISSUE.title}
      description={ISSUE.description}
      showCountBadge={showCountBadge}
      items={items}
      isLoading={isLoading}
      columnDefinitions={columns}
      visibleColumnKeys={columns.map((column) => column.key)}
      renderRow={(item) => (
        <TableRow key={item.questionId} className={tutorTableBodyRow}>
          <TableCell className="whitespace-nowrap">{item.sectionName || '—'}</TableCell>
          <TableCell className="max-w-[360px]" title={preview(item.questionText, 500)}>{preview(item.questionText) || '—'}</TableCell>
          <TableCell className="whitespace-nowrap">{item.downvotes} down · {item.upvotes} up</TableCell>
          <TableCell className="max-w-[380px] text-sm text-muted-foreground">
            {Object.entries(item.reasonCounts).map(([reason, count]) => `${reason.replaceAll('_', ' ')} (${count})`).join(', ') || 'No preset reason'}
            {item.comments.length > 0 ? ` · ${item.comments.length} comment${item.comments.length === 1 ? '' : 's'}` : ''}
          </TableCell>
          <TableCell>
            <Button variant="outline" size="sm" className={tutorBtnOutline} onClick={() => onOpenStemDialog?.(item.stemId)}>
              Edit explanation
            </Button>
          </TableCell>
        </TableRow>
      )}
    />
  )
}
