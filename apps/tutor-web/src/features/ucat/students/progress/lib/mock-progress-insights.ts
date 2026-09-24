import type { MockAttemptRow } from '@altitutor/shared'

const RECENCY_HALF_LIFE_DAYS = 60

function attemptDate(attempt: MockAttemptRow) {
  return attempt.completedAt ?? attempt.attemptedAt
}

export function calculateRecentWeightedMockScore(
  attempts: MockAttemptRow[]
): number | null {
  const scored = attempts.filter((attempt) => attempt.scaledScore != null)
  if (!scored.length) return null

  const newest = Math.max(
    ...scored.map((attempt) => new Date(attemptDate(attempt)).getTime())
  )
  let weightedScore = 0
  let totalWeight = 0
  for (const attempt of scored) {
    const ageDays = Math.max(
      0,
      (newest - new Date(attemptDate(attempt)).getTime()) / 86_400_000
    )
    const weight = 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS)
    weightedScore += attempt.scaledScore! * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : null
}
