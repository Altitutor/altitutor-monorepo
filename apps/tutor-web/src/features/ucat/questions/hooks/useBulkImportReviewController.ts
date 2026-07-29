'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BlindSolutionResponse,
  UcatAssessmentFinding,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { applyUcatAssessmentPatches } from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
import {
  partitionBulkImportAiFindings,
  requestBulkImportAiReview,
  type BulkImportAiReviewCache,
  type BulkImportAiReviewResult,
} from '@/features/ucat/questions/lib/bulk-import-ai-review'
import {
  runBulkImportDeterministicReview,
  type BulkImportAutomaticFix,
  type BulkImportGateIssue,
} from '@/features/ucat/questions/components/bulk-import/bulkImportDeterministicReview'
import type { BulkImportDuplicateFinding } from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type NamedTaxonomyItem = {
  id?: string | null
  name?: string | null
}

export type BulkImportReviewFinding = {
  stemId: string
  finding: UcatAssessmentFinding
}

export type BulkImportReviewChange = {
  id: string
  stemId: string
  source: 'deterministic' | 'ai'
  summary: string
  findingKey: string | null
  before: UcatQuestionStemFormValues
  after: UcatQuestionStemFormValues
}

export type BulkImportDeterministicStemReview = {
  stemId: string
  issues: BulkImportGateIssue[]
  fixes: BulkImportAutomaticFix[]
  hasHardFailures: boolean
}

export type BulkImportAiReviewStatus = 'idle' | 'running'
export type BulkImportDuplicateAnalysisStatus = 'idle' | 'running'

export type UseBulkImportReviewControllerArgs = {
  stems: BulkImportStemDraft[]
  sections?: NamedTaxonomyItem[]
  categories?: NamedTaxonomyItem[]
  onUpdateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
  aiConcurrency?: number
}

export type BulkImportReviewController = {
  deterministicByStemId: Record<string, BulkImportDeterministicStemReview>
  hardFailures: Array<{ stemId: string; issue: BulkImportGateIssue }>
  hasHardFailures: boolean
  applyDeterministicFixes: () => void

  aiStatus: BulkImportAiReviewStatus
  aiResultsByStemId: Record<string, BulkImportAiReviewResult>
  aiErrorsByStemId: Record<string, string>
  staleAiStemIds: Set<string>
  approvalRequiredFindings: BulkImportReviewFinding[]
  manualReviewFindings: BulkImportReviewFinding[]
  keptFindingKeysByStemId: Record<string, string[]>
  runAiReview: () => Promise<void>
  runAiReviewForStem: (stemId: string) => Promise<void>
  retryFailedAiReview: () => Promise<void>
  cancelAiReview: () => void
  approveFinding: (stemId: string, findingKey: string) => Promise<void>
  keepFinding: (stemId: string, findingKey: string) => void

  duplicateStatus: BulkImportDuplicateAnalysisStatus
  hasDuplicateAnalysisRun: boolean
  duplicateError: string | null
  duplicateFindings: BulkImportDuplicateFinding[]
  runDuplicateAnalysis: () => Promise<void>
  cancelDuplicateAnalysis: () => void

  excludedStemIds: Set<string>
  excludedQuestionIds: Set<string>
  excludeStem: (stemId: string) => void
  includeStem: (stemId: string) => void
  excludeQuestion: (stemId: string, questionId: string) => void
  includeQuestion: (stemId: string, questionId: string) => void
  includedStems: BulkImportStemDraft[]

  automaticChanges: Array<BulkImportReviewChange & { canUndo: boolean }>
  undoAutomaticChange: (changeId: string) => boolean
  undoAllAutomaticChanges: () => void
  resetReview: () => void
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stable(record[key])]))
}

function signature(value: unknown): string {
  return JSON.stringify(stable(value))
}

function sameValues(left: UcatQuestionStemFormValues, right: UcatQuestionStemFormValues): boolean {
  return signature(left) === signature(right)
}

function questionKey(stemId: string, questionId: string): string {
  return `${stemId}:${questionId}`
}

export function automaticFindingStillSafe(
  values: UcatQuestionStemFormValues,
  finding: UcatAssessmentFinding,
  blindSolution?: BlindSolutionResponse | null,
): boolean {
  if (!finding.suggestion) return false
  return finding.suggestion.patches.every((patch) => {
    if (patch.operation === 'set_answer_key') {
      const solution = blindSolution?.solutions.find(
        (item) => item.questionId === patch.questionId
      )
      return Boolean(
        solution
        && !solution.ambiguous
        && !solution.unsolvable
        && solution.confidence >= 0.95
        && solution.selectedOptionId === patch.correctOptionId
      )
    }
    if (patch.operation === 'set_metadata' && patch.field === 'tag_ids') {
      const question = values.questions.find((item) => item.id === patch.targetId)
      return Boolean(question && question.tagIds.length === 0)
    }
    if (patch.operation !== 'set_text' || patch.target.field !== 'answer_explanation') {
      return true
    }
    if (patch.target.kind === 'question') {
      const question = values.questions.find((item) => item.id === patch.target.id)
      return Boolean(question && !proseMirrorToPlainText(question.answerExplanation).trim())
    }
    if (patch.target.kind === 'option') {
      const option = values.questions
        .flatMap((question) => question.options)
        .find((item) => item.id === patch.target.id)
      return Boolean(option && !proseMirrorToPlainText(option.answerExplanation).trim())
    }
    return false
  })
}

export function deriveIncludedBulkImportStems(params: {
  stems: BulkImportStemDraft[]
  excludedStemIds: ReadonlySet<string>
  excludedQuestionIds: ReadonlySet<string>
}): BulkImportStemDraft[] {
  return params.stems.flatMap((stem) => {
    if (params.excludedStemIds.has(stem.id)) return []
    const questions = stem.values.questions.filter((question) => {
      if (!question.id) return true
      return !params.excludedQuestionIds.has(questionKey(stem.id, question.id))
    })
    if (questions.length === 0) return []
    return [{
      ...stem,
      values: {
        ...stem.values,
        questions,
      },
    }]
  })
}

function cacheFromResult(result: BulkImportAiReviewResult | undefined): BulkImportAiReviewCache | null {
  if (
    !result
    || result.error
    || !result.fingerprints
    || !result.assessment
    || !result.blindSolution
  ) return null
  return {
    promptVersion: result.promptVersion,
    fingerprints: result.fingerprints,
    assessment: result.assessment,
    blindSolution: result.blindSolution,
    provenance: result.provenance,
  }
}

function requireApprovalForAutomaticFindings(
  result: BulkImportAiReviewResult,
): BulkImportAiReviewResult {
  if (!result.assessment) return result
  return {
    ...result,
    assessment: {
      ...result.assessment,
      findings: result.assessment.findings.map((finding) => {
        if (finding.suggestion?.application !== 'auto_apply') return finding
        return {
          ...finding,
          suggestion: {
            ...finding.suggestion,
            application: 'approval_required' as const,
          },
        }
      }),
    },
  }
}

async function requestDuplicateAnalysis(
  stems: BulkImportStemDraft[],
  signal: AbortSignal,
): Promise<BulkImportDuplicateFinding[]> {
  if (stems.length === 0) return []
  const response = await fetch('/api/ucat/question-stems/bulk-import/duplicate-analysis', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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

function changeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useBulkImportReviewController({
  stems,
  sections = [],
  categories = [],
  onUpdateStem,
  aiConcurrency = 3,
}: UseBulkImportReviewControllerArgs): BulkImportReviewController {
  const [aiStatus, setAiStatus] = useState<BulkImportAiReviewStatus>('idle')
  const [aiResultsByStemId, setAiResultsByStemId] = useState<Record<string, BulkImportAiReviewResult>>({})
  const [aiErrorsByStemId, setAiErrorsByStemId] = useState<Record<string, string>>({})
  const [reviewedSignatures, setReviewedSignatures] = useState<Record<string, string>>({})
  const [keptFindingKeysByStemId, setKeptFindingKeysByStemId] = useState<Record<string, string[]>>({})
  const [duplicateStatus, setDuplicateStatus] = useState<BulkImportDuplicateAnalysisStatus>('idle')
  const [hasDuplicateAnalysisRun, setHasDuplicateAnalysisRun] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicateFindings, setDuplicateFindings] = useState<BulkImportDuplicateFinding[]>([])
  const [excludedStemIds, setExcludedStemIds] = useState<Set<string>>(() => new Set())
  const [excludedQuestionIds, setExcludedQuestionIds] = useState<Set<string>>(() => new Set())
  const [automaticChanges, setAutomaticChanges] = useState<BulkImportReviewChange[]>([])

  const stemsRef = useRef(stems)
  const aiResultsRef = useRef(aiResultsByStemId)
  const automaticChangesRef = useRef(automaticChanges)
  const skippedDeterministicSignaturesRef = useRef(new Set<string>())
  const aiAbortRef = useRef<AbortController | null>(null)
  const duplicateAbortRef = useRef<AbortController | null>(null)
  const aiRunRef = useRef(0)

  useEffect(() => {
    stemsRef.current = stems
  }, [stems])
  useEffect(() => {
    aiResultsRef.current = aiResultsByStemId
  }, [aiResultsByStemId])
  useEffect(() => {
    automaticChangesRef.current = automaticChanges
  }, [automaticChanges])

  const sectionNames = useMemo(
    () => new Map(sections.flatMap((item) => item.id ? [[item.id, item.name ?? null] as const] : [])),
    [sections],
  )
  const categoryNames = useMemo(
    () => new Map(categories.flatMap((item) => item.id ? [[item.id, item.name ?? null] as const] : [])),
    [categories],
  )

  const commitValues = useCallback((
    stemId: string,
    values: UcatQuestionStemFormValues,
  ) => {
    stemsRef.current = stemsRef.current.map((stem) => (
      stem.id === stemId ? { ...stem, values } : stem
    ))
    onUpdateStem(stemId, values)
  }, [onUpdateStem])

  const recordAutomaticChange = useCallback((
    source: BulkImportReviewChange['source'],
    stemId: string,
    before: UcatQuestionStemFormValues,
    after: UcatQuestionStemFormValues,
    summary: string,
    findingKey: string | null,
  ) => {
    if (sameValues(before, after)) return
    const change: BulkImportReviewChange = {
      id: changeId(),
      stemId,
      source,
      summary,
      findingKey,
      before: clone(before),
      after: clone(after),
    }
    automaticChangesRef.current = [...automaticChangesRef.current, change]
    setAutomaticChanges(automaticChangesRef.current)
  }, [])

  const deterministicByStemId = useMemo(() => {
    return Object.fromEntries(stems.map((stem) => {
      const review = runBulkImportDeterministicReview({
        values: stem.values,
        sectionName: sectionNames.get(stem.values.sectionId),
        categoryName: stem.values.categoryId
          ? categoryNames.get(stem.values.categoryId)
          : null,
      })
      return [stem.id, {
        stemId: stem.id,
        issues: review.issues,
        fixes: review.fixes,
        hasHardFailures: review.hasHardFailures,
      } satisfies BulkImportDeterministicStemReview]
    }))
  }, [categoryNames, sectionNames, stems])

  const applyDeterministicFixes = useCallback(() => {
    skippedDeterministicSignaturesRef.current.clear()
    for (const stem of stemsRef.current) {
      const review = runBulkImportDeterministicReview({
        values: stem.values,
        sectionName: sectionNames.get(stem.values.sectionId),
        categoryName: stem.values.categoryId
          ? categoryNames.get(stem.values.categoryId)
          : null,
      })
      if (review.fixes.length === 0 || sameValues(stem.values, review.values)) continue
      recordAutomaticChange(
        'deterministic',
        stem.id,
        stem.values,
        review.values,
        review.fixes.map((fix) => fix.message).join(' '),
        null,
      )
      commitValues(stem.id, review.values)
    }
  }, [categoryNames, commitValues, recordAutomaticChange, sectionNames])

  useEffect(() => {
    for (const stem of stems) {
      const currentSignature = signature(stem.values)
      if (skippedDeterministicSignaturesRef.current.has(`${stem.id}:${currentSignature}`)) continue
      const review = runBulkImportDeterministicReview({
        values: stem.values,
        sectionName: sectionNames.get(stem.values.sectionId),
        categoryName: stem.values.categoryId
          ? categoryNames.get(stem.values.categoryId)
          : null,
      })
      if (review.fixes.length === 0 || sameValues(stem.values, review.values)) continue
      recordAutomaticChange(
        'deterministic',
        stem.id,
        stem.values,
        review.values,
        review.fixes.map((fix) => fix.message).join(' '),
        null,
      )
      commitValues(stem.id, review.values)
    }
  }, [categoryNames, commitValues, recordAutomaticChange, sectionNames, stems])

  const includedStems = useMemo(
    () => deriveIncludedBulkImportStems({ stems, excludedStemIds, excludedQuestionIds }),
    [excludedQuestionIds, excludedStemIds, stems],
  )

  const runAiForStemIds = useCallback(async (stemIds: string[]) => {
    if (aiStatus === 'running' || stemIds.length === 0) return
    const runId = aiRunRef.current + 1
    aiRunRef.current = runId
    const abortController = new AbortController()
    aiAbortRef.current = abortController
    setAiStatus('running')

    const queue = [...stemIds]
    const reviewStem = async (stemId: string) => {
      const reviewDraft = includedStems.find((stem) => stem.id === stemId)
      const fullDraft = stemsRef.current.find((stem) => stem.id === stemId)
      if (!reviewDraft || !fullDraft || abortController.signal.aborted) return
      const reviewedQuestionIds = new Set(
        reviewDraft.values.questions.flatMap((question) => question.id ? [question.id] : [])
      )
      const includedValuesFrom = (values: UcatQuestionStemFormValues) => ({
        ...values,
        questions: values.questions.filter(
          (question) => !question.id || reviewedQuestionIds.has(question.id)
        ),
      })
      const previous = cacheFromResult(aiResultsRef.current[stemId])
      try {
        const response = await requestBulkImportAiReview({
          stems: [{ id: stemId, values: reviewDraft.values, previous }],
          signal: abortController.signal,
          concurrency: 1,
        })
        const initial = response.results[0]
        if (!initial) throw new Error('AI review returned no result for this stem.')
        if (!initial.reused) {
          setKeptFindingKeysByStemId((existing) => {
            if (!existing[stemId]) return existing
            const next = { ...existing }
            delete next[stemId]
            return next
          })
        }
        if (initial.error || !initial.assessment) {
          const message = initial.error ?? 'AI review returned an incomplete result.'
          setAiErrorsByStemId((current) => ({ ...current, [stemId]: message }))
          setAiResultsByStemId((current) => ({ ...current, [stemId]: initial }))
          aiResultsRef.current = { ...aiResultsRef.current, [stemId]: initial }
          return
        }

        setAiErrorsByStemId((current) => {
          const next = { ...current }
          delete next[stemId]
          return next
        })
        setAiResultsByStemId((current) => ({ ...current, [stemId]: initial }))
        aiResultsRef.current = { ...aiResultsRef.current, [stemId]: initial }

        const automatic = partitionBulkImportAiFindings(initial.assessment.findings).automatic
        let currentValues =
          stemsRef.current.find((stem) => stem.id === stemId)?.values ?? fullDraft.values
        let appliedAny = false
        const failedAutomaticKeys = new Set<string>()
        for (const finding of automatic) {
          if (!finding.suggestion) continue
          if (!automaticFindingStillSafe(currentValues, finding, initial.blindSolution)) {
            failedAutomaticKeys.add(finding.key)
            continue
          }
          try {
            const next = await applyUcatAssessmentPatches(currentValues, finding.suggestion.patches)
            recordAutomaticChange(
              'ai',
              stemId,
              currentValues,
              next,
              finding.suggestion.summary,
              finding.key,
            )
            currentValues = next
            appliedAny = true
          } catch (error) {
            failedAutomaticKeys.add(finding.key)
            setAiErrorsByStemId((current) => ({
              ...current,
              [stemId]: error instanceof Error ? error.message : 'An automatic AI fix could not be applied.',
            }))
          }
        }

        if (!appliedAny) {
          const safeInitial = failedAutomaticKeys.size > 0
            ? requireApprovalForAutomaticFindings(initial)
            : initial
          setAiResultsByStemId((current) => ({ ...current, [stemId]: safeInitial }))
          aiResultsRef.current = { ...aiResultsRef.current, [stemId]: safeInitial }
          setReviewedSignatures((current) => ({
            ...current,
            [stemId]: signature(reviewDraft.values),
          }))
          return
        }

        commitValues(stemId, currentValues)
        if (abortController.signal.aborted) return
        const verificationValues = includedValuesFrom(currentValues)
        const verification = await requestBulkImportAiReview({
          stems: [{
            id: stemId,
            values: verificationValues,
            previous: cacheFromResult(initial),
          }],
          signal: abortController.signal,
          concurrency: 1,
        })
        const verified = verification.results[0]
        if (!verified) throw new Error('AI verification returned no result for this stem.')
        if (verified.error || !verified.assessment) {
          setAiErrorsByStemId((current) => ({
            ...current,
            [stemId]: verified.error ?? 'AI verification returned an incomplete result.',
          }))
          return
        }
        // A verification pass never chains into another automatic-fix pass.
        const safeVerified = requireApprovalForAutomaticFindings(verified)
        setAiResultsByStemId((current) => ({ ...current, [stemId]: safeVerified }))
        aiResultsRef.current = { ...aiResultsRef.current, [stemId]: safeVerified }
        setReviewedSignatures((current) => ({
          ...current,
          [stemId]: signature(verificationValues),
        }))
        setAiErrorsByStemId((current) => {
          const next = { ...current }
          delete next[stemId]
          return next
        })
      } catch (error) {
        if (abortController.signal.aborted) return
        setAiErrorsByStemId((current) => ({
          ...current,
          [stemId]: error instanceof Error ? error.message : 'AI review failed.',
        }))
      }
    }

    const worker = async () => {
      while (!abortController.signal.aborted) {
        const stemId = queue.shift()
        if (!stemId) return
        await reviewStem(stemId)
      }
    }

    try {
      await Promise.all(
        Array.from(
          { length: Math.min(Math.max(1, aiConcurrency), stemIds.length) },
          () => worker(),
        ),
      )
    } finally {
      if (aiRunRef.current === runId) {
        aiAbortRef.current = null
        setAiStatus('idle')
      }
    }
  }, [aiConcurrency, aiStatus, commitValues, includedStems, recordAutomaticChange])

  const runAiReview = useCallback(async () => {
    await runAiForStemIds(includedStems.map((stem) => stem.id))
  }, [includedStems, runAiForStemIds])

  const runAiReviewForStem = useCallback(async (stemId: string) => {
    if (!includedStems.some((stem) => stem.id === stemId)) return
    await runAiForStemIds([stemId])
  }, [includedStems, runAiForStemIds])

  const retryFailedAiReview = useCallback(async () => {
    const includedIds = new Set(includedStems.map((stem) => stem.id))
    await runAiForStemIds(Object.keys(aiErrorsByStemId).filter((id) => includedIds.has(id)))
  }, [aiErrorsByStemId, includedStems, runAiForStemIds])

  const cancelAiReview = useCallback(() => {
    aiAbortRef.current?.abort()
  }, [])

  const approveFinding = useCallback(async (stemId: string, findingKey: string) => {
    const draft = stemsRef.current.find((stem) => stem.id === stemId)
    const finding = aiResultsRef.current[stemId]?.assessment?.findings
      .find((candidate) => candidate.key === findingKey)
    if (!draft || !finding?.suggestion) {
      throw new Error('This AI suggestion is no longer available.')
    }
    const next = await applyUcatAssessmentPatches(draft.values, finding.suggestion.patches)
    commitValues(stemId, next)
    setReviewedSignatures((current) => {
      const updated = { ...current }
      delete updated[stemId]
      return updated
    })
  }, [commitValues])

  const keepFinding = useCallback((stemId: string, findingKey: string) => {
    const current = aiResultsRef.current[stemId]
    if (!current?.assessment?.findings.some((finding) => finding.key === findingKey)) return
    setKeptFindingKeysByStemId((existing) => ({
      ...existing,
      [stemId]: [...new Set([...(existing[stemId] ?? []), findingKey])],
    }))
  }, [])

  const cancelDuplicateAnalysis = useCallback(() => {
    duplicateAbortRef.current?.abort()
  }, [])

  const runDuplicateAnalysis = useCallback(async () => {
    if (duplicateStatus === 'running') return
    const abortController = new AbortController()
    duplicateAbortRef.current = abortController
    setDuplicateStatus('running')
    setDuplicateError(null)
    try {
      const findings = await requestDuplicateAnalysis(includedStems, abortController.signal)
      setDuplicateFindings(findings)
      setHasDuplicateAnalysisRun(true)
    } catch (error) {
      if (!abortController.signal.aborted) {
        setDuplicateError(error instanceof Error ? error.message : 'Duplicate analysis failed.')
      }
    } finally {
      if (duplicateAbortRef.current === abortController) {
        duplicateAbortRef.current = null
        setDuplicateStatus('idle')
      }
    }
  }, [duplicateStatus, includedStems])

  const excludeStem = useCallback((stemId: string) => {
    aiAbortRef.current?.abort()
    setExcludedStemIds((current) => new Set(current).add(stemId))
  }, [])
  const includeStem = useCallback((stemId: string) => {
    setExcludedStemIds((current) => {
      const next = new Set(current)
      next.delete(stemId)
      return next
    })
  }, [])
  const excludeQuestion = useCallback((stemId: string, questionId: string) => {
    aiAbortRef.current?.abort()
    setExcludedQuestionIds((current) => new Set(current).add(questionKey(stemId, questionId)))
  }, [])
  const includeQuestion = useCallback((stemId: string, questionId: string) => {
    setExcludedQuestionIds((current) => {
      const next = new Set(current)
      next.delete(questionKey(stemId, questionId))
      return next
    })
  }, [])

  const hardFailures = useMemo(
    () => includedStems.flatMap((stem) => {
      const review = runBulkImportDeterministicReview({
        values: stem.values,
        sectionName: sectionNames.get(stem.values.sectionId),
        categoryName: stem.values.categoryId
          ? categoryNames.get(stem.values.categoryId)
          : null,
      })
      return review.issues.map((issue) => ({ stemId: stem.id, issue }))
    }),
    [categoryNames, includedStems, sectionNames],
  )

  const staleAiStemIds = useMemo(() => new Set(includedStems.flatMap((stem) => {
    if (!aiResultsByStemId[stem.id]) return []
    const reviewed = reviewedSignatures[stem.id]
    return reviewed !== signature(stem.values) ? [stem.id] : []
  })), [aiResultsByStemId, includedStems, reviewedSignatures])

  const freshFindings = useMemo(() => includedStems.flatMap((stem) => {
    if (staleAiStemIds.has(stem.id)) return []
    const kept = new Set(keptFindingKeysByStemId[stem.id] ?? [])
    const findings = aiResultsByStemId[stem.id]?.assessment?.findings ?? []
    return findings
      .filter((finding) => !kept.has(finding.key))
      .map((finding) => ({ stemId: stem.id, finding }))
  }), [aiResultsByStemId, includedStems, keptFindingKeysByStemId, staleAiStemIds])

  const partitionedFindings = useMemo(() => {
    const approvalRequired: BulkImportReviewFinding[] = []
    const manualReview: BulkImportReviewFinding[] = []
    for (const item of freshFindings) {
      const partition = partitionBulkImportAiFindings([item.finding])
      if (partition.approvalRequired.length > 0) approvalRequired.push(item)
      else if (partition.manualReview.length > 0) manualReview.push(item)
    }
    return { approvalRequired, manualReview }
  }, [freshFindings])

  const visibleDuplicateFindings = useMemo(() => {
    const includedIds = new Set(includedStems.map((stem) => stem.id))
    return duplicateFindings.filter((finding) => {
      if (!includedIds.has(finding.draft.stemId)) return false
      return finding.match.source !== 'draft' || includedIds.has(finding.match.stemId)
    })
  }, [duplicateFindings, includedStems])

  const changesWithUndo = useMemo(() => automaticChanges.map((change) => {
    const current = stems.find((stem) => stem.id === change.stemId)?.values
    return { ...change, canUndo: Boolean(current && sameValues(current, change.after)) }
  }), [automaticChanges, stems])

  const undoAutomaticChange = useCallback((id: string): boolean => {
    const change = automaticChangesRef.current.find((candidate) => candidate.id === id)
    if (!change) return false
    const current = stemsRef.current.find((stem) => stem.id === change.stemId)?.values
    if (!current || !sameValues(current, change.after)) return false
    if (change.source === 'deterministic') {
      skippedDeterministicSignaturesRef.current.add(`${change.stemId}:${signature(change.before)}`)
    }
    commitValues(change.stemId, clone(change.before))
    automaticChangesRef.current = automaticChangesRef.current.filter((candidate) => candidate.id !== id)
    setAutomaticChanges(automaticChangesRef.current)
    return true
  }, [commitValues])

  const undoAllAutomaticChanges = useCallback(() => {
    const valuesByStemId = new Map(stemsRef.current.map((stem) => [stem.id, stem.values]))
    const undone = new Set<string>()
    for (const change of [...automaticChangesRef.current].reverse()) {
      const current = valuesByStemId.get(change.stemId)
      if (!current || !sameValues(current, change.after)) continue
      valuesByStemId.set(change.stemId, clone(change.before))
      undone.add(change.id)
      if (change.source === 'deterministic') {
        skippedDeterministicSignaturesRef.current.add(`${change.stemId}:${signature(change.before)}`)
      }
    }
    for (const [stemId, values] of valuesByStemId) {
      const current = stemsRef.current.find((stem) => stem.id === stemId)?.values
      if (current && !sameValues(current, values)) commitValues(stemId, values)
    }
    automaticChangesRef.current = automaticChangesRef.current.filter((change) => !undone.has(change.id))
    setAutomaticChanges(automaticChangesRef.current)
  }, [commitValues])

  const resetReview = useCallback(() => {
    aiAbortRef.current?.abort()
    duplicateAbortRef.current?.abort()
    setAiStatus('idle')
    setAiResultsByStemId({})
    aiResultsRef.current = {}
    setAiErrorsByStemId({})
    setReviewedSignatures({})
    setKeptFindingKeysByStemId({})
    setDuplicateStatus('idle')
    setHasDuplicateAnalysisRun(false)
    setDuplicateError(null)
    setDuplicateFindings([])
    setExcludedStemIds(new Set())
    setExcludedQuestionIds(new Set())
    setAutomaticChanges([])
    automaticChangesRef.current = []
    skippedDeterministicSignaturesRef.current.clear()
  }, [])

  useEffect(() => () => {
    aiAbortRef.current?.abort()
    duplicateAbortRef.current?.abort()
  }, [])

  return {
    deterministicByStemId,
    hardFailures,
    hasHardFailures: hardFailures.length > 0,
    applyDeterministicFixes,
    aiStatus,
    aiResultsByStemId,
    aiErrorsByStemId,
    staleAiStemIds,
    approvalRequiredFindings: partitionedFindings.approvalRequired,
    manualReviewFindings: partitionedFindings.manualReview,
    keptFindingKeysByStemId,
    runAiReview,
    runAiReviewForStem,
    retryFailedAiReview,
    cancelAiReview,
    approveFinding,
    keepFinding,
    duplicateStatus,
    hasDuplicateAnalysisRun,
    duplicateError,
    duplicateFindings: visibleDuplicateFindings,
    runDuplicateAnalysis,
    cancelDuplicateAnalysis,
    excludedStemIds,
    excludedQuestionIds,
    excludeStem,
    includeStem,
    excludeQuestion,
    includeQuestion,
    includedStems,
    automaticChanges: changesWithUndo,
    undoAutomaticChange,
    undoAllAutomaticChanges,
    resetReview,
  }
}
