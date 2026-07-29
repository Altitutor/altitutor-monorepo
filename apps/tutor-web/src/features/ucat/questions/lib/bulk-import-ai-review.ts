import type {
  BlindSolutionResponse,
  UcatAssessmentFinding,
  UcatAssessmentFingerprints,
  UcatAssessmentResponse,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

export type BulkImportAiReviewCache = {
  promptVersion: number
  fingerprints: UcatAssessmentFingerprints
  assessment: UcatAssessmentResponse
  blindSolution: BlindSolutionResponse
  provenance?: BulkImportAiReviewProvenance | null
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
  assessment: UcatAssessmentResponse | null
  blindSolution: BlindSolutionResponse | null
  provenance: BulkImportAiReviewProvenance | null
  reused: boolean
  error: string | null
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
  const response = await fetch('/api/ucat/question-stems/bulk-review', {
    method: 'POST',
    signal: params.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stems: params.stems,
      concurrency: params.concurrency ?? 3,
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
  const suggestion = finding.suggestion
  if (!suggestion || suggestion.application !== 'auto_apply') return false
  return suggestion.patches.every((patch) => {
    if (patch.operation === 'set_answer_key') return finding.confidence >= 0.95
    if (finding.confidence < 0.9) return false
    if (patch.operation === 'replace_text') return finding.category === 'presentation_integrity'
    if (patch.operation === 'set_text') return patch.target.field === 'answer_explanation'
    if (patch.operation === 'set_metadata') {
      return patch.field === 'difficulty'
        || patch.field === 'time_burden_seconds'
        || patch.field === 'tag_ids'
    }
    return false
  })
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
