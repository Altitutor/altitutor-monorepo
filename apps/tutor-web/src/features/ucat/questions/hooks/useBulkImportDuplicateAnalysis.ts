'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { BulkImportDuplicateFinding } from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'

function signature(stems: BulkImportStemDraft[], similarityThreshold: number): string {
  return JSON.stringify({
    similarityThreshold,
    stems: stems.map((stem) => ({
      id: stem.id,
      sectionId: stem.values.sectionId,
      stemText: stem.values.stemText,
      questions: stem.values.questions,
    })),
  })
}

async function requestDuplicateAnalysis(
  stems: BulkImportStemDraft[],
  similarityThreshold: number,
  signal: AbortSignal,
): Promise<BulkImportDuplicateFinding[]> {
  if (stems.length === 0) return []
  const response = await fetch('/api/ucat/question-stems/bulk-import/duplicate-analysis', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      similarityThreshold,
      drafts: stems.map((stem) => ({
        id: stem.id,
        sectionId: stem.values.sectionId,
        stemText: stem.values.stemText,
        questions: stem.values.questions,
      })),
    }),
  })
  const body = await response.json().catch(() => ({})) as {
    findings?: BulkImportDuplicateFinding[]
    error?: string
  }
  if (!response.ok || !Array.isArray(body.findings)) {
    throw new Error(body.error ?? 'Duplicate analysis failed.')
  }
  return body.findings
}

export function useBulkImportDuplicateAnalysis(stems: BulkImportStemDraft[], enabled: boolean) {
  const [similarityThreshold, setSimilarityThreshold] = useState(0.95)
  const [status, setStatus] = useState<'idle' | 'running'>('idle')
  const [analyzedSignature, setAnalyzedSignature] = useState<string | null>(null)
  const [findings, setFindings] = useState<BulkImportDuplicateFinding[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const currentSignature = useMemo(
    () => signature(stems, similarityThreshold),
    [similarityThreshold, stems],
  )

  const run = useCallback(async () => {
    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController
    setStatus('running')
    setError(null)
    try {
      const nextFindings = await requestDuplicateAnalysis(
        stems,
        similarityThreshold,
        abortController.signal,
      )
      setFindings(nextFindings)
      setAnalyzedSignature(signature(stems, similarityThreshold))
    } catch (caught) {
      if (!abortController.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Duplicate analysis failed.')
      }
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null
        setStatus('idle')
      }
    }
  }, [similarityThreshold, stems])

  useEffect(() => {
    if (!enabled || stems.length === 0 || analyzedSignature === currentSignature || status === 'running') {
      return
    }
    const timeout = window.setTimeout(() => void run(), 350)
    return () => window.clearTimeout(timeout)
  }, [analyzedSignature, currentSignature, enabled, run, status, stems.length])

  useEffect(() => () => abortRef.current?.abort(), [])

  const visibleFindings = useMemo(
    () => analyzedSignature === currentSignature ? findings : [],
    [analyzedSignature, currentSignature, findings],
  )
  const duplicateStemIds = useMemo(
    () => new Set(visibleFindings.map((finding) => finding.draft.stemId)),
    [visibleFindings],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setAnalyzedSignature(null)
    setFindings([])
    setError(null)
  }, [])

  return {
    status,
    error,
    similarityThreshold,
    setSimilarityThreshold,
    findings: visibleFindings,
    duplicateStemIds,
    hasRun: analyzedSignature === currentSignature,
    run,
    reset,
  }
}
