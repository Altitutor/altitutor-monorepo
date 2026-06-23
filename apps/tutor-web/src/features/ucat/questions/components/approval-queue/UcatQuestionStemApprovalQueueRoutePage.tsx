'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  UcatQuestionStemApprovalQueuePage,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'

function parseEntries(value: string | null): UcatApprovalQueueEntry[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry): UcatApprovalQueueEntry[] => {
      if (!entry || typeof entry !== 'object') return []
      const record = entry as Record<string, unknown>
      if (typeof record.stemId !== 'string') return []
      if (record.mode === 'ai_approval') return [{ stemId: record.stemId, mode: 'ai_approval' }]
      if (record.mode !== 'reconciliation') return []
      if (
        record.issueType !== 'missing_category' &&
        record.issueType !== 'missing_explanation' &&
        record.issueType !== 'missing_tags' &&
        record.issueType !== 'missing_set'
      ) {
        return []
      }
      return [{
        stemId: record.stemId,
        mode: 'reconciliation',
        issueType: record.issueType,
        questionId: typeof record.questionId === 'string' ? record.questionId : undefined,
        questionIndex: typeof record.questionIndex === 'number' ? record.questionIndex : undefined,
      }]
    })
  } catch {
    return []
  }
}

export function UcatQuestionStemApprovalQueueRoutePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const entries = useMemo(() => parseEntries(searchParams.get('entries')), [searchParams])
  const title = searchParams.get('title') ?? 'Question stem approval queue'

  return (
    <div className="py-8 md:py-10">
      <UcatQuestionStemApprovalQueuePage
        title={title}
        entries={entries}
        onExit={() => router.push('/ucat/questions')}
      />
    </div>
  )
}
