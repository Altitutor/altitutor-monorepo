export const UCAT_OPEN_GENERATION_REVIEW_EVENT = 'ucat-open-generation-review'

export type UcatOpenGenerationReviewDetail = {
  runId: string
  stemIds?: string[]
}

export function openUcatGenerationReview(runId: string, stemIds?: string[]): void {
  if (typeof window === 'undefined' || !runId) return
  window.dispatchEvent(
    new CustomEvent<UcatOpenGenerationReviewDetail>(UCAT_OPEN_GENERATION_REVIEW_EVENT, {
      detail: { runId, stemIds },
    }),
  )
}
