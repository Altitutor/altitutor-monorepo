'use client'

import { Button, TableCell, TableRow } from '@altitutor/ui'
import type { DownvotedQuestion } from '@/features/ucat/reconciliation/api/reconciliation'
import { useReconciliationData } from '@/features/ucat/reconciliation/hooks/useReconciliation'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { tutorBtnOutline, tutorTableBodyRow } from '@/shared/lib/tutor-visual'
import { ReconciliationTable } from './ReconciliationTable'

const columns = [
  { key: 'section', label: 'Section', visibleByDefault: true },
  { key: 'question', label: 'Question', visibleByDefault: true },
  { key: 'votes', label: 'Votes', visibleByDefault: true },
  { key: 'reasons', label: 'Reasons / comments', visibleByDefault: true },
]

const REASON_LABELS: Record<string, string> = {
  misformatted: 'Misformatted',
  answer_incorrect: 'Answer seems incorrect',
  unclear: 'Unclear',
  too_easy: 'Too easy',
  too_hard: 'Too hard',
  other: 'Other',
}

function preview(value: unknown, max = 100) {
  const text =
    proseMirrorToPlainText(value as import('@altitutor/shared').Json) ?? ''
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

export function DownvotedQuestionsTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const { data, isLoading } = useReconciliationData()
  const items = data?.downvotedQuestions ?? []

  return (
    <ReconciliationTable<DownvotedQuestion>
      title="Downvoted questions"
      items={items}
      isLoading={isLoading}
      columnDefinitions={columns}
      visibleColumnKeys={columns.map((column) => column.key)}
      renderRow={(item) => (
        <TableRow key={item.questionId} className={tutorTableBodyRow}>
          <TableCell className="whitespace-nowrap">
            {item.sectionName || '—'}
          </TableCell>
          <TableCell
            className="max-w-[360px]"
            title={preview(item.questionText, 500)}
          >
            {preview(item.questionText) || '—'}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            {item.downvotes} down · {item.upvotes} up
          </TableCell>
          <TableCell className="max-w-[380px] text-sm text-muted-foreground">
            {Object.entries(item.reasonCounts)
              .map(
                ([reason, count]) =>
                  `${REASON_LABELS[reason] ?? reason.replaceAll('_', ' ')} (${count})`,
              )
              .join(', ') || 'No preset reason'}
            {item.comments.length > 0
              ? ` · ${item.comments.length} comment${item.comments.length === 1 ? '' : 's'}`
              : ''}
          </TableCell>
          <TableCell>
            <Button
              variant="outline"
              size="sm"
              className={tutorBtnOutline}
              onClick={() => onOpenStemDialog?.(item.stemId)}
            >
              Edit question
            </Button>
          </TableCell>
        </TableRow>
      )}
    />
  )
}
