import type { MockAttemptRow } from '@altitutor/shared'
import { calculateRecentWeightedMockScore } from '../mock-progress-insights'

function attempt(
  scaledScore: number | null,
  completedAt: string
): MockAttemptRow {
  return {
    id: completedAt,
    attemptedAt: completedAt,
    completedAt,
    ucatMockId: completedAt,
    mockName: null,
    scorePoints: null,
    totalPoints: null,
    scaledScore,
    scaledScoreMax: 2700,
    timeTakenSeconds: null,
    setTimeLimitSeconds: null,
    studentSetSpeed: null,
    studentExamSpeed: null,
    wasTimed: true,
  }
}

describe('calculateRecentWeightedMockScore', () => {
  it('favours a recent mock over an older score', () => {
    expect(
      calculateRecentWeightedMockScore([
        attempt(1800, '2026-01-01T00:00:00.000Z'),
        attempt(2400, '2026-03-02T00:00:00.000Z'),
      ])
    ).toBe(2200)
  })

  it('returns null without scored mocks', () => {
    expect(
      calculateRecentWeightedMockScore([
        attempt(null, '2026-03-02T00:00:00.000Z'),
      ])
    ).toBeNull()
  })
})
