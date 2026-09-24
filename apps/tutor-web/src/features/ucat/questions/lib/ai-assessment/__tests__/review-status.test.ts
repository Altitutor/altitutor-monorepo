import {
  deriveUcatAiScopeReviewStatus,
  shouldShowRequestAiReviewAction,
  shouldShowRerunAiReviewAction,
  type UcatAiReviewStatus,
} from '../review-status'

describe('UCAT AI review table action', () => {
  it('offers a review request only when no review has been requested', () => {
    expect(shouldShowRequestAiReviewAction('not_requested')).toBe(true)

    const existingReviewStatuses: UcatAiReviewStatus[] = [
      'reviewing',
      'deferred',
      'format_blocked',
      'unavailable',
      'unreviewable',
      'passed',
      'concerns',
      'critical',
      'disabled',
    ]
    for (const status of existingReviewStatuses) {
      expect(shouldShowRequestAiReviewAction(status)).toBe(false)
    }
    expect(shouldShowRequestAiReviewAction(undefined)).toBe(false)
  })

  it('offers a rerun from the editor once a review already exists', () => {
    expect(shouldShowRerunAiReviewAction('critical')).toBe(true)
    expect(shouldShowRerunAiReviewAction('passed')).toBe(true)
    expect(shouldShowRerunAiReviewAction('unavailable')).toBe(true)
    expect(shouldShowRerunAiReviewAction('not_requested')).toBe(false)
    expect(shouldShowRerunAiReviewAction('reviewing')).toBe(false)
    expect(shouldShowRerunAiReviewAction('disabled')).toBe(false)
  })
})

describe('UCAT AI review scope status', () => {
  it('becomes passed when a previously critical review has no unresolved scope ratings', () => {
    expect(deriveUcatAiScopeReviewStatus({
      overallStatus: 'critical',
      ratings: ['pass'],
      formatSeverities: [],
    })).toBe('passed')
  })

  it('uses the highest unresolved severity in the current scope', () => {
    expect(deriveUcatAiScopeReviewStatus({
      overallStatus: 'concerns',
      ratings: ['pass', 'critical'],
      formatSeverities: [],
    })).toBe('critical')
    expect(deriveUcatAiScopeReviewStatus({
      overallStatus: 'passed',
      ratings: ['pass'],
      formatSeverities: ['error'],
    })).toBe('format_blocked')
  })

  it('preserves operational states while a review is in progress', () => {
    expect(deriveUcatAiScopeReviewStatus({
      overallStatus: 'reviewing',
      ratings: ['critical'],
      formatSeverities: ['error'],
    })).toBe('reviewing')
  })
})
