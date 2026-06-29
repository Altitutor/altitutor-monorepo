'use client'

import { useMemo, useState } from 'react'
import { Button, TableCell, TableRow } from '@altitutor/ui'
import { ReconciliationTable } from './ReconciliationTable'
import type { PendingGeneratedStem } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorBtnPrimary, tutorTableBodyRow } from '@/shared/lib/tutor-visual'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '...'
}

export function PendingGeneratedStemsTable(_props: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const { data, isLoading } = useReconciliationData()
  const [queueOpen, setQueueOpen] = useState(false)
  const [reviewStemId, setReviewStemId] = useState<string | null>(null)

  const items = useMemo(() => data?.pendingGeneratedStems ?? [], [data?.pendingGeneratedStems])
  const queueEntries = useMemo<UcatApprovalQueueEntry[]>(
    () => items.map((item) => ({ stemId: item.id, mode: 'ai_approval' as const })),
    [items],
  )

  const columnDefinitions = [
    { key: 'section', label: 'Section' },
    { key: 'category', label: 'Category' },
    { key: 'stem', label: 'Question stem' },
    { key: 'questions', label: 'Questions' },
  ]

  return (
    <>
      <ReconciliationTable<PendingGeneratedStem>
        title="AI-generated questions awaiting approval"
        items={items}
        isLoading={isLoading}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={columnDefinitions.map((column) => column.key)}
        headerActions={
          <Button size="sm" className={tutorBtnPrimary} onClick={() => setQueueOpen(true)} disabled={queueEntries.length === 0}>
            Begin approvals
          </Button>
        }
        renderRow={(item, _index, visibleColumnKeys) => (
        <PendingGeneratedStemRow
          key={item.id}
          item={item}
          visibleColumnKeys={visibleColumnKeys}
          onReview={() => setReviewStemId(item.id)}
        />
        )}
      />
      <UcatQuestionStemApprovalQueueDialog
        open={queueOpen}
        title="Approve generated question stems"
        entries={queueEntries}
        onClose={() => setQueueOpen(false)}
      />
      <UcatQuestionStemApprovalQueueDialog
        open={reviewStemId != null}
        title="Review generated question stem"
        entries={reviewStemId ? [{ stemId: reviewStemId, mode: 'ai_approval' }] : []}
        onClose={() => setReviewStemId(null)}
      />
    </>
  )
}

function PendingGeneratedStemRow({
  item,
  visibleColumnKeys,
  onReview,
}: {
  item: PendingGeneratedStem
  visibleColumnKeys: string[]
  onReview: () => void
}) {
  const stemText = proseMirrorToPlainText(item.stemText as import('@altitutor/shared').Json) ?? ''
  const questionsDisplay = useMemo(() => {
    const sorted = [...(item.questions ?? [])].sort((a, b) => a.index - b.index)
    return sorted
      .map((q, i) => `${i + 1}. ${truncate(proseMirrorToPlainText(q.question_text as import('@altitutor/shared').Json) ?? '', 60)}`)
      .join(' ')
  }, [item.questions])

  const cells: Record<string, React.ReactNode> = {
    section: <TableCell className="whitespace-nowrap">{item.sectionName || '-'}</TableCell>,
    category: <TableCell className="whitespace-nowrap">{item.categoryName || '-'}</TableCell>,
    stem: (
      <TableCell className="max-w-[300px]" title={stemText}>
        {truncate(stemText, TRUNCATE_LEN) || '-'}
      </TableCell>
    ),
    questions: (
      <TableCell className="max-w-[400px] text-muted-foreground" title={questionsDisplay}>
        <span className="block truncate">{questionsDisplay || '-'}</span>
      </TableCell>
    ),
  }

  return (
    <TableRow className={cn(tutorTableBodyRow)}>
      {visibleColumnKeys.map((key) => cells[key]).filter((cell): cell is React.ReactNode => cell != null)}
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className={tutorBtnOutline} onClick={onReview}>
            Review
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
