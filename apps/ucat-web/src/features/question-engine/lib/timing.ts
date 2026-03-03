'use client'

import type {
  MockTimingSegment,
  QuestionEngineExam,
  QuestionEngineState,
  SetModeTiming,
} from '@/features/question-engine/model/types'

/**
 * Returns the current segment's time limit in seconds, or null if untimed.
 * Used for set and mock modes only.
 */
export function getCurrentSegmentTimeLimitSeconds(
  exam: QuestionEngineExam,
  state: QuestionEngineState
): number | null {
  if (exam.sourceType === 'set' && exam.setModeTiming) {
    const t = exam.setModeTiming as SetModeTiming
    if (t.setTimeLimitSeconds == null || t.setTimeLimitSeconds <= 0) return null
    if (state.phase === 'instructions') return t.instructionsTimeLimitSeconds
    if (state.phase === 'question') return t.setTimeLimitSeconds
    return null
  }

  if (exam.sourceType === 'mock' && exam.mockTimingSegments?.length) {
    const seg = getCurrentMockSegment(exam, state)
    return seg?.timeLimitSeconds ?? null
  }

  return null
}

/**
 * For mock mode, returns the segment index and segment for current (phase, instructionsIndex, currentIndex).
 */
export function getCurrentMockSegment(
  exam: QuestionEngineExam,
  state: QuestionEngineState
): (MockTimingSegment & { segmentIndex: number }) | null {
  const segments = exam.mockTimingSegments
  if (!segments?.length) return null

  if (state.phase === 'instructions') {
    const idx = segments.findIndex(
      (s) => s.type === 'instructions' && s.instructionsIndex === state.instructionsIndex
    )
    if (idx >= 0) {
      const s = segments[idx]
      return s.type === 'instructions' ? { ...s, segmentIndex: idx } : null
    }
    return null
  }

  if (state.phase === 'question') {
    const idx = segments.findIndex(
      (s) =>
        s.type === 'questions' &&
        state.currentIndex >= s.questionStartIndex &&
        state.currentIndex < s.questionEndIndex
    )
    if (idx >= 0) {
      const s = segments[idx]
      return s.type === 'questions' ? { ...s, segmentIndex: idx } : null
    }
  }

  return null
}

/**
 * Remaining seconds for the current segment. Returns 0 if expired or untimed.
 */
export function getRemainingSeconds(
  exam: QuestionEngineExam,
  state: QuestionEngineState,
  timerStartedAt: number | null
): number | null {
  const limit = getCurrentSegmentTimeLimitSeconds(exam, state)
  if (limit == null || limit <= 0 || timerStartedAt == null) return null
  const elapsed = Math.floor((Date.now() - timerStartedAt) / 1000)
  return Math.max(0, limit - elapsed)
}

/**
 * For mock: get the next segment after the current one. Returns null if at end.
 */
export function getNextMockSegment(
  exam: QuestionEngineExam,
  state: QuestionEngineState
): (MockTimingSegment & { segmentIndex: number }) | null {
  const current = getCurrentMockSegment(exam, state)
  const segments = exam.mockTimingSegments
  if (!current || !segments || current.segmentIndex >= segments.length - 1) return null
  const next = segments[current.segmentIndex + 1]
  return { ...next, segmentIndex: current.segmentIndex + 1 }
}

/**
 * Format seconds as MM:SS for timer display.
 */
export function formatTimeRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
