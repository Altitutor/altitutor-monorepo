'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, TableCell, TableRow, useToast } from '@altitutor/ui'
import { ReconciliationTable } from './ReconciliationTable'
import type { PendingGeneratedStem } from '../api/reconciliation'
import { useReconciliationData } from '../hooks/useReconciliation'
import { useSetUcatQuestionStemApprovalStatus } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'
import { tutorTableBodyRow } from '@/shared/lib/tutor-visual'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'

const TRUNCATE_LEN = 80

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trim() + '...'
}

export function PendingGeneratedStemsTable({
  onOpenStemDialog,
}: {
  onOpenStemDialog?: (stemId: string) => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { data, isLoading } = useReconciliationData()
  const approvalMutation = useSetUcatQuestionStemApprovalStatus()
  const [queueOpen, setQueueOpen] = useState(false)

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

  async function setApprovalStatus(item: PendingGeneratedStem, status: 'approved' | 'rejected') {
    try {
      await approvalMutation.mutateAsync({ stemId: item.id, status })
      toast({
        title: status === 'approved' ? 'Generated question approved' : 'Generated question rejected',
        description:
          status === 'approved'
            ? 'The stem is now published with approved questions.'
            : 'The stem has been removed from the approval queue.',
      })
    } catch {
      toast({
        title: 'Failed to update approval',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <ReconciliationTable<PendingGeneratedStem>
        title="AI-generated questions awaiting approval"
        items={items}
        isLoading={isLoading}
        columnDefinitions={columnDefinitions}
        visibleColumnKeys={columnDefinitions.map((column) => column.key)}
        headerActions={
          <Button variant="outline" size="sm" onClick={() => setQueueOpen(true)} disabled={queueEntries.length === 0}>
            Begin approvals
          </Button>
        }
        renderRow={(item, _index, visibleColumnKeys) => (
        <PendingGeneratedStemRow
          key={item.id}
          item={item}
          visibleColumnKeys={visibleColumnKeys}
          isUpdating={approvalMutation.isPending}
          onApprove={() => setApprovalStatus(item, 'approved')}
          onReject={() => setApprovalStatus(item, 'rejected')}
          onOpenStemDialog={onOpenStemDialog}
          onReview={() => router.push(`/ucat/questions/generated/${item.id}`)}
        />
        )}
      />
      <UcatQuestionStemApprovalQueueDialog
        open={queueOpen}
        title="Approve generated question stems"
        entries={queueEntries}
        onClose={() => setQueueOpen(false)}
      />
    </>
  )
}

function PendingGeneratedStemRow({
  item,
  visibleColumnKeys,
  isUpdating,
  onApprove,
  onReject,
  onOpenStemDialog,
  onReview,
}: {
  item: PendingGeneratedStem
  visibleColumnKeys: string[]
  isUpdating: boolean
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onOpenStemDialog?: (stemId: string) => void
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
          <Button variant="outline" size="sm" onClick={onReview}>
            Review
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenStemDialog?.(item.id)}>
            Quick edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => void onReject()} disabled={isUpdating}>
            Reject
          </Button>
          <Button size="sm" onClick={() => void onApprove()} disabled={isUpdating}>
            Approve
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
