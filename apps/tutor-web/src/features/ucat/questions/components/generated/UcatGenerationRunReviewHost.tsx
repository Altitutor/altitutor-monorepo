'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ucatQuestionsApi, type UcatGenerationRun } from '@/features/ucat/questions/api/questions'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'
import {
  UCAT_OPEN_GENERATION_REVIEW_EVENT,
  type UcatOpenGenerationReviewDetail,
} from '@/features/ucat/questions/lib/ucat-generation-review-events'

/**
 * Opens the AI approval queue for a generation run — from completion notification clicks
 * or deep links (`?generationRun=<id>`).
 */
function UcatGenerationRunReviewHostInner() {
  const searchParams = useSearchParams()
  const generationRunId = searchParams.get('generationRun')
  const [reviewRun, setReviewRun] = useState<UcatGenerationRun | null>(null)
  const requestIdRef = useRef(0)

  const openRun = useCallback(async (runId: string, stemIds?: string[]) => {
    const requestId = ++requestIdRef.current

    if (stemIds && stemIds.length > 0) {
      setReviewRun({
        id: runId,
        status: 'completed',
        requested_stem_count: stemIds.length,
        accepted_stem_count: stemIds.length,
        discarded_stem_count: 0,
        processed_stem_count: stemIds.length,
        progress_step: 'drafts',
        progress_message: 'Questions are ready for review',
        error_message: null,
        generated_stem_ids: stemIds,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        dismissed_at: null,
      })
      return
    }

    try {
      const run = await ucatQuestionsApi.getGenerationRun(runId)
      if (requestId !== requestIdRef.current) return
      if (!run?.generated_stem_ids.length) return
      setReviewRun(run)
    } catch {
      // Deep-link review is best-effort; user can still open stems from the questions page.
    }
  }, [])

  useEffect(() => {
    if (!generationRunId) return
    void openRun(generationRunId)
  }, [generationRunId, openRun])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<UcatOpenGenerationReviewDetail>).detail
      if (detail?.runId) void openRun(detail.runId, detail.stemIds)
    }
    window.addEventListener(UCAT_OPEN_GENERATION_REVIEW_EVENT, handler)
    return () => {
      window.removeEventListener(UCAT_OPEN_GENERATION_REVIEW_EVENT, handler)
    }
  }, [openRun])

  const reviewEntries: UcatApprovalQueueEntry[] = (reviewRun?.generated_stem_ids ?? []).map((stemId) => ({
    stemId,
    mode: 'ai_approval',
  }))

  return (
    <UcatQuestionStemApprovalQueueDialog
      open={reviewRun != null}
      title="Review generated questions"
      entries={reviewEntries}
      onClose={() => {
        requestIdRef.current += 1
        setReviewRun(null)
      }}
    />
  )
}

export function UcatGenerationRunReviewHost() {
  return (
    <Suspense fallback={null}>
      <UcatGenerationRunReviewHostInner />
    </Suspense>
  )
}
