import type {
  BlindSolutionResponse,
  UcatAssessmentFinding,
  UcatAssessmentFingerprints,
  UcatAssessmentResponse,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  ucatQuestionStemSchema,
  type UcatQuestionStemFormValues,
} from '@/features/ucat/questions/types/schema'
import { BULK_IMPORT_AUTO_APPLY_CONFIDENCE } from './bulk-import-review-policy'

export type BulkImportAiReviewCache = {
  promptVersion: number
  fingerprints: UcatAssessmentFingerprints
  assessment: UcatAssessmentResponse
  blindSolution: BlindSolutionResponse
  provenance?: BulkImportAiReviewProvenance | null
  reviewToken: string
}

export type BulkImportAiReviewProvenance = {
  blindSolverModelProfileId: string | null
  assessmentModelProfileId: string | null
  blindProviderId: string | null
  blindModel: string | null
  assessmentProviderId: string | null
  assessmentModel: string | null
}

/**
 * A completed draft review submitted with the import. `draftStemId` must match
 * the stable `stemId` in the serialized stem payload.
 */
export type BulkImportAiReviewSubmission = BulkImportAiReviewCache & {
  draftStemId: string
  decisions?: Array<{
    findingKey: string
    decision: 'dismissed'
  }>
}

export type BulkImportAiReviewResult = {
  id: string
  promptVersion: number
  fingerprints: UcatAssessmentFingerprints | null
  /** The moderator's original category-by-category comments before automatic repairs. */
  audit: UcatAssessmentResponse | null
  /** The current post-repair assessment used for import and publication decisions. */
  assessment: UcatAssessmentResponse | null
  blindSolution: BlindSolutionResponse | null
  values: UcatQuestionStemFormValues | null
  appliedRepairs: string[]
  provenance: BulkImportAiReviewProvenance | null
  reviewToken: string | null
  reused: boolean
  error: string | null
  timings?: {
    totalMs: number
    auditRepairMs: number | null
    verificationPreparationMs: number | null
    blindVerificationMs: number | null
    reconciliationMs: number | null
  }
}

export function bulkImportReviewErrorMessage(error: string | null | undefined): string {
  if (!error) return 'AI review returned an incomplete result. Please retry this stem.'
  const looksLikeInternalValidation = (
    error.includes('ZodError')
    || (error.includes('"code"') && error.includes('"path"'))
    || error.trimStart().startsWith('[\n  {')
  )
  return looksLikeInternalValidation
    ? 'AI returned an incomplete review. No changes were lost; please retry this stem.'
    : error
}

export async function requestBulkImportAiReview(params: {
  stems: Array<{
    id: string
    values: UcatQuestionStemFormValues
    previous?: BulkImportAiReviewCache | null
  }>
  signal?: AbortSignal
  concurrency?: number
}): Promise<{
  results: BulkImportAiReviewResult[]
  reviewedCount: number
  reusedCount: number
  errorCount: number
}> {
  for (const stem of params.stems) {
    const parsed = ucatQuestionStemSchema.safeParse(stem.values)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const field = issue?.path.length ? issue.path.join('.') : 'question draft'
      throw new Error(`This stem cannot be reviewed yet: ${field} — ${issue?.message ?? 'invalid content'}.`)
    }
  }
  const response = await fetch('/api/ucat/question-stems/bulk-review', {
    method: 'POST',
    signal: params.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stems: params.stems,
      concurrency: params.concurrency ?? 6,
    }),
  })
  const body = await response.json().catch(() => ({})) as {
    error?: string
    results?: BulkImportAiReviewResult[]
    reviewedCount?: number
    reusedCount?: number
    errorCount?: number
  }
  if (!response.ok || !Array.isArray(body.results)) {
    throw new Error(body.error ?? 'Bulk AI review failed.')
  }
  return {
    results: body.results,
    reviewedCount: body.reviewedCount ?? 0,
    reusedCount: body.reusedCount ?? 0,
    errorCount: body.errorCount ?? 0,
  }
}

function automaticPatchAllowed(finding: UcatAssessmentFinding): boolean {
  // Starting the bulk-import review is the tutor's one-click authorization to
  // repair draft content. The moderator still withholds suggestions when it is
  // uncertain, and exclusion/review findings remain manual.
  return Boolean(
    finding.suggestion
    && finding.recommendedAction === 'fix'
    && finding.suggestion.application === 'auto_apply'
    && finding.confidence >= BULK_IMPORT_AUTO_APPLY_CONFIDENCE
  )
}

export function partitionBulkImportAiFindings(findings: UcatAssessmentFinding[]): {
  automatic: UcatAssessmentFinding[]
  approvalRequired: UcatAssessmentFinding[]
  manualReview: UcatAssessmentFinding[]
} {
  const automatic: UcatAssessmentFinding[] = []
  const approvalRequired: UcatAssessmentFinding[] = []
  const manualReview: UcatAssessmentFinding[] = []
  for (const finding of findings) {
    if (automaticPatchAllowed(finding)) automatic.push(finding)
    else if (finding.suggestion) approvalRequired.push(finding)
    else manualReview.push(finding)
  }
  return { automatic, approvalRequired, manualReview }
}
