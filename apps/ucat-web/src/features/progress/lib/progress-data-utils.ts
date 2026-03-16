import {
  getTimeFrameRange,
  getGraphBucketDays,
  getBucketKey,
  getBucketKeysInRange,
  getBucketKeysBetween,
} from './progress-mode'
import type {
  SectionProgress,
  QuestionAttemptRow,
  SetAttemptRow,
  SectionCategoryProgress,
} from '@/app/api/ucat/progress/route'
import type { ProgressMode, TimeFrameDays } from './progress-mode'

function isInRange(date: Date | string, start: Date, end: Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d >= start && d <= end
}

/** Filter attempts by time frame when mode is time_frame */
export function filterByTimeFrame<T extends { attemptedAt: string; completedAt?: string | null }>(
  items: T[],
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays
): T[] {
  if (mode !== 'time_frame') return items
  const days = parseInt(timeFrameDays, 10) || 30
  const { start, end } = getTimeFrameRange(days)
  return items.filter((a) => {
    const d = a.completedAt ?? a.attemptedAt
    return isInRange(d, start, end)
  })
}

/** Compute stats for a single section from filtered attempts (for time_frame mode) */
export function computeSingleSectionFromFiltered(
  questionAttempts: QuestionAttemptRow[],
  setAttempts: SetAttemptRow[],
  section: SectionProgress
): SectionProgress {
  let correct = 0
  let max = 0
  let scaledSum = 0
  let scaledCount = 0
  for (const qa of questionAttempts) {
    const maxPerQuestion = qa.questionType === 'syllogism' ? 2 : 1
    correct += qa.score ?? 0
    max += maxPerQuestion
  }
  const standaloneSetAttempts = setAttempts.filter((a) => !a.studentUcatMockAttemptId)
  for (const a of standaloneSetAttempts) {
    if (a.scaledScore != null) {
      scaledSum += a.scaledScore
      scaledCount += 1
    }
  }
  const percentage = max > 0 ? Math.round((correct / max) * 100) : 0
  const averageScaledScore = scaledCount > 0 ? scaledSum / scaledCount : null
  return {
    ...section,
    correctScore: correct,
    maxScore: max,
    percentage,
    averageScaledScore,
    weightedAverageScaledScore: averageScaledScore,
    weightedAveragePercentage: percentage,
  }
}

/** Compute section progress from filtered data (for time_frame mode) */
export function computeSectionProgressFromFiltered(
  questionAttempts: QuestionAttemptRow[],
  setAttempts: SetAttemptRow[],
  sectionProgress: SectionProgress[]
): SectionProgress[] {
  const sectionMap = new Map<
    string,
    { name: string; number: number; correct: number; max: number; scaledSum: number; scaledCount: number }
  >()
  for (const s of sectionProgress) {
    sectionMap.set(s.sectionId, {
      name: s.sectionName,
      number: s.sectionNumber,
      correct: 0,
      max: 0,
      scaledSum: 0,
      scaledCount: 0,
    })
  }
  for (const qa of questionAttempts) {
    const sectionId = qa.ucatSectionId
    if (!sectionId) continue
    const maxPerQuestion = qa.questionType === 'syllogism' ? 2 : 1
    const entry = sectionMap.get(sectionId)
    if (entry) {
      entry.correct += qa.score ?? 0
      entry.max += maxPerQuestion
    }
  }
  const standaloneSetAttempts = setAttempts.filter((a) => !a.studentUcatMockAttemptId)
  for (const a of standaloneSetAttempts) {
    const sectionId = a.sectionId
    if (!sectionId || a.scaledScore == null) continue
    const entry = sectionMap.get(sectionId)
    if (entry) {
      entry.scaledSum += a.scaledScore
      entry.scaledCount += 1
    }
  }
  return sectionProgress.map((s) => {
    const data = sectionMap.get(s.sectionId)
    if (!data) return s
    const percentage = data.max > 0 ? Math.round((data.correct / data.max) * 100) : 0
    const averageScaledScore =
      data.scaledCount > 0 ? data.scaledSum / data.scaledCount : null
    return {
      ...s,
      correctScore: data.correct,
      maxScore: data.max,
      percentage,
      averageScaledScore,
      weightedAverageScaledScore: averageScaledScore,
      weightedAveragePercentage: percentage,
    }
  })
}

/** Compute category progress from filtered question attempts */
export function computeCategoryProgressFromFiltered(
  questionAttempts: QuestionAttemptRow[],
  sectionCategoryProgress: Record<string, SectionCategoryProgress[]>
): Record<string, SectionCategoryProgress[]> {
  const result: Record<string, SectionCategoryProgress[]> = {}
  const categoryMap = new Map<string, { correct: number; max: number }>()
  for (const qa of questionAttempts) {
    const sectionId = qa.ucatSectionId
    if (!sectionId) continue
    const categoryId = qa.questionStemCategoryId ?? '__uncategorized__'
    const maxPerQuestion = qa.questionType === 'syllogism' ? 2 : 1
    const key = `${sectionId}:${categoryId}`
    const existing = categoryMap.get(key)
    if (existing) {
      existing.correct += qa.score ?? 0
      existing.max += maxPerQuestion
    } else {
      categoryMap.set(key, {
        correct: qa.score ?? 0,
        max: maxPerQuestion,
      })
    }
  }
  for (const [sectionId, cats] of Object.entries(sectionCategoryProgress)) {
    result[sectionId] = cats.map((cat) => {
      const key = `${sectionId}:${cat.categoryId}`
      const { correct, max } = categoryMap.get(key) ?? { correct: 0, max: 0 }
      const percentage = max > 0 ? Math.round((correct / max) * 100) : 0
      return {
        ...cat,
        correctScore: correct,
        maxScore: max,
        percentage,
        weightedAveragePercentage: percentage,
      }
    })
  }
  return result
}

/** Aggregate data into buckets for graph. Returns { date, value }[] */
export function aggregateForGraph<T>(
  items: T[],
  getDate: (item: T) => Date | string,
  getValue: (item: T) => number,
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays,
  isCountMetric: boolean
): { date: string; value: number | null; label?: string }[] {
  let filtered = items
  let allKeys: string[]
  let bucket: 'day' | 'week'

  if (mode === 'time_frame') {
    const days = parseInt(timeFrameDays, 10) || 30
    const { start, end } = getTimeFrameRange(days)
    filtered = items.filter((a) => {
      const d = getDate(a)
      const date = typeof d === 'string' ? new Date(d) : d
      return date >= start && date <= end
    })
    bucket = getGraphBucketDays(days)
    allKeys = getBucketKeysInRange(days, bucket)
  } else {
    if (filtered.length === 0) return []
    const dates = filtered.map((a) => {
      const d = getDate(a)
      return typeof d === 'string' ? new Date(d) : d
    })
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
    bucket = getGraphBucketDays(days)
    allKeys = getBucketKeysBetween(minDate, maxDate, bucket)
  }

  const byBucket = new Map<string, number[]>()
  for (const item of filtered) {
    const d = getDate(item)
    const key = getBucketKey(d, bucket)
    const list = byBucket.get(key) ?? []
    list.push(getValue(item))
    byBucket.set(key, list)
  }

  const result = allKeys.map((date) => {
    const values = byBucket.get(date) ?? []
    let value: number | null
    if (values.length === 0) {
      value = null
    } else if (isCountMetric) {
      value = values.length
    } else {
      value = values.reduce((s, v) => s + v, 0) / values.length
    }
    return { date, value }
  })

  return result
}
