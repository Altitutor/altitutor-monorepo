'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BlindSolutionResponse,
  UcatAssessmentFinding,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { applyUcatAssessmentPatches } from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
import {
  bulkImportReviewErrorMessage,
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
export type BulkImportAiStemPhase =
  | 'idle'
  | 'queued'
  | 'analyzing'
  | 'ready'
  | 'manual_review'
  | 'failed'
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
  aiPhaseByStemId: Record<string, BulkImportAiStemPhase>
  aiResultsByStemId: Record<string, BulkImportAiReviewResult>
  aiErrorsByStemId: Record<string, string>
  staleAiStemIds: Set<string>
  pendingAiStemIds: Set<string>
  approvalRequiredFindings: BulkImportReviewFinding[]
  manualReviewFindings: BulkImportReviewFinding[]
  keptFindingKeysByStemId: Record<string, string[]>
  runAiReview: () => Promise<void>
  runAiReviewForStemIds: (stemIds: string[]) => Promise<void>
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
  keepDuplicateFinding: (findingId: string) => void

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

type ReviewMergeResult<T> = {
  value: T
  conflict: boolean
}

function mergeReviewValue<T>(submitted: T, current: T, reviewed: T): ReviewMergeResult<T> {
  if (signature(reviewed) === signature(submitted)) return { value: current, conflict: false }
  if (
    signature(current) === signature(submitted)
    || signature(current) === signature(reviewed)
  ) return { value: reviewed, conflict: false }

  if (
    submitted && current && reviewed
    && typeof submitted === 'object'
    && typeof current === 'object'
    && typeof reviewed === 'object'
    && !Array.isArray(submitted)
    && !Array.isArray(current)
    && !Array.isArray(reviewed)
  ) {
    const submittedRecord = submitted as Record<string, unknown>
    const currentRecord = current as Record<string, unknown>
    const reviewedRecord = reviewed as Record<string, unknown>
    const keys = new Set([
      ...Object.keys(submittedRecord),
      ...Object.keys(currentRecord),
      ...Object.keys(reviewedRecord),
    ])
    const value: Record<string, unknown> = {}
    for (const key of keys) {
      const merged = mergeReviewValue(
        submittedRecord[key],
        currentRecord[key],
        reviewedRecord[key],
      )
      if (merged.conflict) return { value: current, conflict: true }
      value[key] = merged.value
    }
    return { value: value as T, conflict: false }
  }

  return { value: current, conflict: true }
}

export function mergeBulkImportReviewResult(params: {
  submitted: UcatQuestionStemFormValues
  current: UcatQuestionStemFormValues
  reviewed: UcatQuestionStemFormValues
}): { values: UcatQuestionStemFormValues; conflict: boolean } {
  const submittedWithoutQuestions = { ...params.submitted, questions: [] }
  const currentWithoutQuestions = { ...params.current, questions: [] }
  const reviewedWithoutQuestions = { ...params.reviewed, questions: [] }
  const shared = mergeReviewValue(
    submittedWithoutQuestions,
    currentWithoutQuestions,
    reviewedWithoutQuestions,
  )
  if (shared.conflict) return { values: params.current, conflict: true }

  const currentById = new Map(
    params.current.questions.flatMap((question) => question.id ? [[question.id, question] as const] : []),
  )
  const reviewedById = new Map(
    params.reviewed.questions.flatMap((question) => question.id ? [[question.id, question] as const] : []),
  )
  const mergedById = new Map<string, UcatQuestionStemFormValues['questions'][number]>()
  for (const submittedQuestion of params.submitted.questions) {
    if (!submittedQuestion.id) return { values: params.current, conflict: true }
    const currentQuestion = currentById.get(submittedQuestion.id)
    const reviewedQuestion = reviewedById.get(submittedQuestion.id)
    if (!currentQuestion || !reviewedQuestion) return { values: params.current, conflict: true }
    const merged = mergeReviewValue(submittedQuestion, currentQuestion, reviewedQuestion)
    if (merged.conflict) return { values: params.current, conflict: true }
    mergedById.set(submittedQuestion.id, merged.value)
  }

  return {
    values: {
      ...shared.value,
      questions: params.current.questions.map((question) =>
        question.id ? mergedById.get(question.id) ?? question : question
      ),
    },
    conflict: false,
  }
}

export function reviewInputStillCurrent(params: {
  submitted: UcatQuestionStemFormValues
  current: UcatQuestionStemFormValues
  reviewedQuestionIds: Set<string>
}): boolean {
  return sameValues(params.submitted, {
    ...params.current,
    questions: params.current.questions.filter(
      (question) => !question.id || params.reviewedQuestionIds.has(question.id)
    ),
  })
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
    if (patch.operation === 'replace_text') {
      const semanticCharacters = (value: string) =>
        value.normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
      return semanticCharacters(patch.beforeText) === semanticCharacters(patch.afterText)
    }
    if (patch.operation === 'set_rich_content') {
      const semanticCharacters = (value: string) =>
        value.normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
      return semanticCharacters(proseMirrorToPlainText(patch.before))
        === semanticCharacters(proseMirrorToPlainText(patch.after))
    }
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
    || !result.reviewToken
  ) return null
  return {
    promptVersion: result.promptVersion,
    fingerprints: result.fingerprints,
    assessment: result.assessment,
    blindSolution: result.blindSolution,
    provenance: result.provenance,
    reviewToken: result.reviewToken,
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
  aiConcurrency = 6,
}: UseBulkImportReviewControllerArgs): BulkImportReviewController {
  const [activeAiStemIds, setActiveAiStemIds] = useState<Set<string>>(() => new Set())
  const aiStatus: BulkImportAiReviewStatus = activeAiStemIds.size > 0 ? 'running' : 'idle'
  const [aiPhaseByStemId, setAiPhaseByStemId] =
    useState<Record<string, BulkImportAiStemPhase>>({})
  const [aiResultsByStemId, setAiResultsByStemId] = useState<Record<string, BulkImportAiReviewResult>>({})
  const [aiErrorsByStemId, setAiErrorsByStemId] = useState<Record<string, string>>({})
  const [reviewedSignatures, setReviewedSignatures] = useState<Record<string, string>>({})
  const [findingContinuitySignatures, setFindingContinuitySignatures] =
    useState<Record<string, string>>({})
  const [keptFindingKeysByStemId, setKeptFindingKeysByStemId] = useState<Record<string, string[]>>({})
  const [forcedApprovalFindingKeysByStemId, setForcedApprovalFindingKeysByStemId] =
    useState<Record<string, string[]>>({})
  const [duplicateStatus, setDuplicateStatus] = useState<BulkImportDuplicateAnalysisStatus>('idle')
  const [duplicateAnalyzedSignature, setDuplicateAnalyzedSignature] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicateFindings, setDuplicateFindings] = useState<BulkImportDuplicateFinding[]>([])
  const [keptDuplicateFindingIds, setKeptDuplicateFindingIds] = useState<Set<string>>(
    () => new Set()
  )
  const [excludedStemIds, setExcludedStemIds] = useState<Set<string>>(() => new Set())
  const [excludedQuestionIds, setExcludedQuestionIds] = useState<Set<string>>(() => new Set())
  const [automaticChanges, setAutomaticChanges] = useState<BulkImportReviewChange[]>([])

  const stemsRef = useRef(stems)
  const aiResultsRef = useRef(aiResultsByStemId)
  const automaticChangesRef = useRef(automaticChanges)
  const skippedDeterministicSignaturesRef = useRef(new Set<string>())
  const aiAbortByStemIdRef = useRef(new Map<string, AbortController>())
  const duplicateAbortRef = useRef<AbortController | null>(null)

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
  const includedStemsSignature = useMemo(() => signature(includedStems), [includedStems])

  const runAiForStemIds = useCallback(async (stemIds: string[]) => {
    const pendingStemIds = [...new Set(stemIds)].filter(
      (stemId) => !aiAbortByStemIdRef.current.has(stemId)
    )
    if (pendingStemIds.length === 0) return
    const abortControllers = new Map(
      pendingStemIds.map((stemId) => [stemId, new AbortController()] as const)
    )
    for (const [stemId, controller] of abortControllers) {
      aiAbortByStemIdRef.current.set(stemId, controller)
    }
    setActiveAiStemIds(new Set(aiAbortByStemIdRef.current.keys()))
    setAiErrorsByStemId((current) => {
      const next = { ...current }
      for (const stemId of pendingStemIds) delete next[stemId]
      return next
    })
    setAiPhaseByStemId((current) => ({
      ...current,
      ...Object.fromEntries(pendingStemIds.map((stemId) => [stemId, 'queued' as const])),
    }))

    const reviewContexts = pendingStemIds.flatMap((stemId) => {
      const includedDraft = includedStems.find((stem) => stem.id === stemId)
      const fullDraft = stemsRef.current.find((stem) => stem.id === stemId)
      const abortController = abortControllers.get(stemId)
      if (!includedDraft || !fullDraft || !abortController) return []
      const reviewedQuestionIds = new Set(
        includedDraft.values.questions.flatMap((question) => question.id ? [question.id] : [])
      )
      const includedValuesFrom = (values: UcatQuestionStemFormValues) => ({
        ...values,
        questions: values.questions.filter(
          (question) => !question.id || reviewedQuestionIds.has(question.id)
        ),
      })
      const reviewDraft = {
        ...includedDraft,
        values: includedValuesFrom(fullDraft.values),
      }
      return [{
        stemId,
        fullDraft,
        reviewedQuestionIds,
        includedValuesFrom,
        reviewDraft,
        previous: cacheFromResult(aiResultsRef.current[stemId]),
        abortController,
      }]
    })

    try {
      const results: BulkImportAiReviewResult[] = []
      for (let offset = 0; offset < reviewContexts.length; offset += aiConcurrency) {
        const batch = reviewContexts.slice(offset, offset + aiConcurrency)
        setAiPhaseByStemId((current) => ({
          ...current,
          ...Object.fromEntries(batch.map(({ stemId }) => [stemId, 'analyzing' as const])),
        }))
        const batchResults = await Promise.all(batch.map(async ({
          stemId,
          reviewDraft,
          previous,
          abortController,
        }) => {
          try {
            const response = await requestBulkImportAiReview({
              stems: [{ id: stemId, values: reviewDraft.values, previous }],
              signal: abortController.signal,
              concurrency: 1,
            })
            return response.results[0] ?? {
              id: stemId,
              promptVersion: 0,
              fingerprints: null,
              audit: null,
              assessment: null,
              blindSolution: null,
              values: null,
              appliedRepairs: [],
              provenance: null,
              reviewToken: null,
              reused: false,
              error: 'AI review returned no result for this stem.',
            }
          } catch (error) {
            return {
              id: stemId,
              promptVersion: 0,
              fingerprints: null,
              audit: null,
              assessment: null,
              blindSolution: null,
              values: null,
              appliedRepairs: [],
              provenance: null,
              reviewToken: null,
              reused: false,
              error: error instanceof Error ? error.message : 'AI review failed.',
            }
          }
        }))
        results.push(...batchResults)
      }
      const resultsByStemId = new Map(results.map((result) => [result.id, result]))

      for (const context of reviewContexts) {
        if (context.abortController.signal.aborted) {
          setAiPhaseByStemId((current) => ({ ...current, [context.stemId]: 'idle' }))
          continue
        }
        const {
          stemId,
          fullDraft,
          includedValuesFrom,
          reviewDraft,
        } = context
        const initial = resultsByStemId.get(stemId)
        if (!initial) {
          setAiErrorsByStemId((current) => ({
            ...current,
            [stemId]: 'AI review returned no result for this stem.',
          }))
          setAiPhaseByStemId((current) => ({ ...current, [stemId]: 'failed' }))
          continue
        }
        if (!initial.reused) {
          setKeptFindingKeysByStemId((existing) => {
            if (!existing[stemId]) return existing
            const next = { ...existing }
            delete next[stemId]
            return next
          })
          setForcedApprovalFindingKeysByStemId((existing) => {
            if (!existing[stemId]) return existing
            const next = { ...existing }
            delete next[stemId]
            return next
          })
        }
        if (initial.error || !initial.assessment) {
          const message = bulkImportReviewErrorMessage(initial.error)
          setAiErrorsByStemId((current) => ({ ...current, [stemId]: message }))
          if (!cacheFromResult(aiResultsRef.current[stemId])) {
            setAiResultsByStemId((current) => ({ ...current, [stemId]: initial }))
            aiResultsRef.current = { ...aiResultsRef.current, [stemId]: initial }
          }
          setAiPhaseByStemId((current) => ({ ...current, [stemId]: 'failed' }))
          continue
        }

        setAiErrorsByStemId((current) => {
          const next = { ...current }
          delete next[stemId]
          return next
        })
        const reviewedValues = initial.values ?? reviewDraft.values
        const hasUnresolvedFindings = initial.assessment.findings.length > 0
        const currentFullValues =
          stemsRef.current.find((stem) => stem.id === stemId)?.values ?? fullDraft.values
        const mergedReview = mergeBulkImportReviewResult({
          submitted: reviewDraft.values,
          current: currentFullValues,
          reviewed: reviewedValues,
        })
        if (mergedReview.conflict) {
          setAiErrorsByStemId((current) => ({
            ...current,
            [stemId]: 'This question changed while AI review was running. Review it again to use the latest version.',
          }))
          setAiPhaseByStemId((current) => ({ ...current, [stemId]: 'failed' }))
          continue
        }
        const finalValues = mergedReview.values
        if (!sameValues(currentFullValues, finalValues)) {
          recordAutomaticChange(
            'ai',
            stemId,
            currentFullValues,
            finalValues,
            initial.appliedRepairs.join(' ') || 'Applied the AI review repair plan.',
            null,
          )
          commitValues(stemId, finalValues)
        }
        const finalIncludedValues = includedValuesFrom(finalValues)
        setAiResultsByStemId((current) => ({ ...current, [stemId]: initial }))
        aiResultsRef.current = { ...aiResultsRef.current, [stemId]: initial }
        setReviewedSignatures((current) => ({
          ...current,
          [stemId]: signature(finalIncludedValues),
        }))
        setFindingContinuitySignatures((current) => ({
          ...current,
          [stemId]: signature(finalIncludedValues),
        }))
        setAiErrorsByStemId((current) => {
          const next = { ...current }
          delete next[stemId]
          return next
        })
        setAiPhaseByStemId((current) => ({
          ...current,
          [stemId]: hasUnresolvedFindings ? 'manual_review' : 'ready',
        }))
      }
    } catch (error) {
      const message = bulkImportReviewErrorMessage(
        error instanceof Error ? error.message : null
      )
      const failedStemIds = reviewContexts
        .filter(({ abortController }) => !abortController.signal.aborted)
        .map(({ stemId }) => stemId)
      setAiErrorsByStemId((current) => ({
        ...current,
        ...Object.fromEntries(failedStemIds.map((stemId) => [stemId, message])),
      }))
      setAiPhaseByStemId((current) => ({
        ...current,
        ...Object.fromEntries(failedStemIds.map((stemId) => [stemId, 'failed' as const])),
      }))
    } finally {
      for (const [stemId, controller] of abortControllers) {
        if (aiAbortByStemIdRef.current.get(stemId) === controller) {
          aiAbortByStemIdRef.current.delete(stemId)
        }
      }
      setActiveAiStemIds(new Set(aiAbortByStemIdRef.current.keys()))
    }
  }, [aiConcurrency, commitValues, includedStems, recordAutomaticChange])

  const runAiReview = useCallback(async () => {
    await runAiForStemIds(includedStems.flatMap((stem) => {
      const result = aiResultsRef.current[stem.id]
      const isFresh = Boolean(
        result
        && !result.error
        && result.assessment
        && reviewedSignatures[stem.id] === signature(stem.values)
      )
      return isFresh ? [] : [stem.id]
    }))
  }, [includedStems, reviewedSignatures, runAiForStemIds])

  const runAiReviewForStem = useCallback(async (stemId: string) => {
    if (!includedStems.some((stem) => stem.id === stemId)) return
    await runAiForStemIds([stemId])
  }, [includedStems, runAiForStemIds])

  const runAiReviewForStemIds = useCallback(async (stemIds: string[]) => {
    const includedIds = new Set(includedStems.map((stem) => stem.id))
    await runAiForStemIds([...new Set(stemIds)].filter((id) => includedIds.has(id)))
  }, [includedStems, runAiForStemIds])

  const retryFailedAiReview = useCallback(async () => {
    const includedIds = new Set(includedStems.map((stem) => stem.id))
    await runAiForStemIds(Object.keys(aiErrorsByStemId).filter((id) => includedIds.has(id)))
  }, [aiErrorsByStemId, includedStems, runAiForStemIds])

  const cancelAiReview = useCallback(() => {
    for (const controller of aiAbortByStemIdRef.current.values()) controller.abort()
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
    setFindingContinuitySignatures((current) => ({
      ...current,
      [stemId]: signature(next),
    }))
    setKeptFindingKeysByStemId((existing) => ({
      ...existing,
      [stemId]: [...new Set([...(existing[stemId] ?? []), findingKey])],
    }))
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
  const keepDuplicateFinding = useCallback((findingId: string) => {
    setKeptDuplicateFindingIds((current) => new Set(current).add(findingId))
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
      setDuplicateAnalyzedSignature(signature(includedStems))
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
    aiAbortByStemIdRef.current.get(stemId)?.abort()
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
    aiAbortByStemIdRef.current.get(stemId)?.abort()
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

  const pendingAiStemIds = useMemo(() => new Set(includedStems.flatMap((stem) => {
    const result = aiResultsByStemId[stem.id]
    const phase = aiPhaseByStemId[stem.id]
    if (phase === 'queued' || phase === 'analyzing') return []
    return !result || result.error || staleAiStemIds.has(stem.id) ? [stem.id] : []
  })), [aiPhaseByStemId, aiResultsByStemId, includedStems, staleAiStemIds])

  const externallyChangedAiStemIds = useMemo(() => new Set(includedStems.flatMap((stem) => {
    if (!aiResultsByStemId[stem.id]) return []
    const continued = findingContinuitySignatures[stem.id] ?? reviewedSignatures[stem.id]
    return continued !== signature(stem.values) ? [stem.id] : []
  })), [
    aiResultsByStemId,
    findingContinuitySignatures,
    includedStems,
    reviewedSignatures,
  ])

  const freshFindings = useMemo(() => includedStems.flatMap((stem) => {
    if (externallyChangedAiStemIds.has(stem.id)) return []
    const kept = new Set(keptFindingKeysByStemId[stem.id] ?? [])
    const findings = aiResultsByStemId[stem.id]?.assessment?.findings ?? []
    return findings
      .filter((finding) => !kept.has(finding.key))
      .map((finding) => ({ stemId: stem.id, finding }))
  }), [
    aiResultsByStemId,
    externallyChangedAiStemIds,
    includedStems,
    keptFindingKeysByStemId,
  ])

  const partitionedFindings = useMemo(() => {
    const approvalRequired: BulkImportReviewFinding[] = []
    const manualReview: BulkImportReviewFinding[] = []
    for (const item of freshFindings) {
      if ((forcedApprovalFindingKeysByStemId[item.stemId] ?? []).includes(item.finding.key)) {
        approvalRequired.push(item)
        continue
      }
      const partition = partitionBulkImportAiFindings([item.finding])
      if (partition.approvalRequired.length > 0) approvalRequired.push(item)
      else if (partition.manualReview.length > 0) manualReview.push(item)
    }
    return { approvalRequired, manualReview }
  }, [forcedApprovalFindingKeysByStemId, freshFindings])

  const visibleDuplicateFindings = useMemo(() => {
    const includedIds = new Set(includedStems.map((stem) => stem.id))
    return duplicateFindings.filter((finding) => {
      if (keptDuplicateFindingIds.has(finding.id)) return false
      if (!includedIds.has(finding.draft.stemId)) return false
      return finding.match.source !== 'draft' || includedIds.has(finding.match.stemId)
    })
  }, [duplicateFindings, includedStems, keptDuplicateFindingIds])
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
    for (const controller of aiAbortByStemIdRef.current.values()) controller.abort()
    aiAbortByStemIdRef.current.clear()
    duplicateAbortRef.current?.abort()
    setActiveAiStemIds(new Set())
    setAiPhaseByStemId({})
    setAiResultsByStemId({})
    aiResultsRef.current = {}
    setAiErrorsByStemId({})
    setReviewedSignatures({})
    setFindingContinuitySignatures({})
    setKeptFindingKeysByStemId({})
    setForcedApprovalFindingKeysByStemId({})
    setDuplicateStatus('idle')
    setDuplicateAnalyzedSignature(null)
    setDuplicateError(null)
    setDuplicateFindings([])
    setKeptDuplicateFindingIds(new Set())
    setExcludedStemIds(new Set())
    setExcludedQuestionIds(new Set())
    setAutomaticChanges([])
    automaticChangesRef.current = []
    skippedDeterministicSignaturesRef.current.clear()
  }, [])

  useEffect(() => () => {
    for (const controller of aiAbortByStemIdRef.current.values()) controller.abort()
    duplicateAbortRef.current?.abort()
  }, [])

  return {
    deterministicByStemId,
    hardFailures,
    hasHardFailures: hardFailures.length > 0,
    applyDeterministicFixes,
    aiStatus,
    aiPhaseByStemId,
    aiResultsByStemId,
    aiErrorsByStemId,
    staleAiStemIds,
    pendingAiStemIds,
    approvalRequiredFindings: partitionedFindings.approvalRequired,
    manualReviewFindings: partitionedFindings.manualReview,
    keptFindingKeysByStemId,
    runAiReview,
    runAiReviewForStemIds,
    runAiReviewForStem,
    retryFailedAiReview,
    cancelAiReview,
    approveFinding,
    keepFinding,
    duplicateStatus,
    hasDuplicateAnalysisRun: duplicateAnalyzedSignature === includedStemsSignature,
    duplicateError,
    duplicateFindings:
      duplicateAnalyzedSignature === includedStemsSignature ? visibleDuplicateFindings : [],
    runDuplicateAnalysis,
    cancelDuplicateAnalysis,
    keepDuplicateFinding,
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
