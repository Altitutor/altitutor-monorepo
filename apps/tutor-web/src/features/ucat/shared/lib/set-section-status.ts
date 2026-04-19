import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from './rich-text'

/**
 * Centralized UCAT exam alignment status.
 * Green = matches UCAT exam timing and number of questions.
 * Orange = partial match (e.g. one set per section but questions/timing don't match).
 * Red = mismatch (e.g. wrong number of sets).
 */

export type UcatExamStatus = 'match' | 'partial' | 'mismatch'

/** Timing status: green = full match, orange = time-per-question match, red = mismatch, yellow = untimed */
export type TimeLimitStatus = 'match' | 'partial' | 'mismatch' | 'untimed'

export type SetSectionStatus = {
  sectionsStatus: 'match' | 'mismatch'
  sectionsTooltip: string
  questionCountStatus: 'match' | 'mismatch'
  questionCountTooltip: string
  timeLimitStatus: TimeLimitStatus
  timeLimitTooltip: string
}

export type UcatSectionForStatus = {
  id: string | null
  section_number: number | null
  name: string | null
  number_of_questions: number | null
  time_limit_seconds: number | null
}

export type SetForStatus = {
  sectionCount: number
  firstSectionNumber: number | null
  question_count: number | null
  time_limit_seconds: number | null
}

export function getSetSectionStatus(
  set: SetForStatus,
  sections: UcatSectionForStatus[]
): SetSectionStatus {
  const singleSection = set.sectionCount === 1
  const firstSection = singleSection && set.firstSectionNumber != null
    ? sections.find((s) => s.section_number === set.firstSectionNumber)
    : null

  const sectionsStatus: 'match' | 'mismatch' = singleSection ? 'match' : 'mismatch'
  const sectionsTooltip = singleSection
    ? 'This set contains questions from a single UCAT section.'
    : 'This set contains questions from multiple UCAT sections. Consider splitting for exam-like practice.'

  const questionCountMatch =
    firstSection != null &&
    set.question_count != null &&
    firstSection.number_of_questions != null &&
    set.question_count === firstSection.number_of_questions
  const questionCountStatus: 'match' | 'mismatch' =
    singleSection && firstSection != null
      ? questionCountMatch
        ? 'match'
        : 'mismatch'
      : 'mismatch'
  const sectionLabel = firstSection?.name ?? 'section'
  const questionCountTooltip =
    singleSection && firstSection != null
      ? questionCountMatch
        ? `Matches ${sectionLabel} (${firstSection.number_of_questions} questions).`
        : `Section has ${firstSection.number_of_questions ?? '—'} questions; set has ${set.question_count ?? '—'}.`
      : singleSection
        ? 'Section has no question count configured.'
        : 'Multi-section: compare per section.'

  const setTimeLimit = set.time_limit_seconds ?? 0
  const isUntimed = setTimeLimit <= 0
  const sectionTimeLimit = firstSection != null ? (firstSection.time_limit_seconds ?? 0) : 0
  const sectionQuestionCount = firstSection?.number_of_questions ?? 0
  const setQuestionCount = set.question_count ?? 0

  const timeLimitExactMatch =
    firstSection != null &&
    !isUntimed &&
    sectionTimeLimit > 0 &&
    setTimeLimit === sectionTimeLimit

  const sectionTimePerQuestion =
    sectionQuestionCount > 0 && sectionTimeLimit > 0
      ? sectionTimeLimit / sectionQuestionCount
      : null
  const setTimePerQuestion =
    setQuestionCount > 0 && setTimeLimit > 0 ? setTimeLimit / setQuestionCount : null

  const TIME_PER_QUESTION_TOLERANCE_SECONDS = 1
  const timePerQuestionMatches =
    sectionTimePerQuestion != null &&
    setTimePerQuestion != null &&
    Math.abs(setTimePerQuestion - sectionTimePerQuestion) <= TIME_PER_QUESTION_TOLERANCE_SECONDS

  let timeLimitStatus: TimeLimitStatus
  let timeLimitTooltip: string

  if (isUntimed) {
    timeLimitStatus = 'untimed'
    timeLimitTooltip = 'This set is untimed.'
  } else if (!singleSection || firstSection == null) {
    timeLimitStatus = 'mismatch'
    timeLimitTooltip = singleSection
      ? 'Section has no time limit configured.'
      : 'Multi-section: compare per section.'
  } else if (questionCountMatch && timeLimitExactMatch) {
    timeLimitStatus = 'match'
    timeLimitTooltip = `Matches ${sectionLabel} time limit (${sectionTimeLimit}s total).`
  } else if (!questionCountMatch && timePerQuestionMatches) {
    timeLimitStatus = 'partial'
    const secTpq = Math.round(sectionTimePerQuestion!)
    timeLimitTooltip = `Question count differs from ${sectionLabel}, but time per question matches (~${secTpq}s).`
  } else {
    timeLimitStatus = 'mismatch'
    if (sectionTimePerQuestion != null && setTimePerQuestion != null) {
      const secTpq = Math.round(sectionTimePerQuestion)
      const setTpq = Math.round(setTimePerQuestion)
      timeLimitTooltip = `Section: ~${secTpq}s per question; set: ~${setTpq}s per question.`
    } else {
      timeLimitTooltip = `Section: ${sectionTimeLimit}s; set: ${setTimeLimit}s.`
    }
  }

  return {
    sectionsStatus,
    sectionsTooltip,
    questionCountStatus,
    questionCountTooltip,
    timeLimitStatus,
    timeLimitTooltip,
  }
}

export function parseSetSections(sections: unknown): {
  sectionCount: number
  firstSectionNumber: number | null
  sectionNumbers: number[]
} {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { sectionCount: 0, firstSectionNumber: null, sectionNumbers: [] }
  }
  const sectionNumbers = sections
    .map((s) => (s as { section_number?: number })?.section_number)
    .filter((n): n is number => n != null)
  const first = sections[0] as { section_number?: number } | undefined
  return {
    sectionCount: sections.length,
    firstSectionNumber: first?.section_number ?? null,
    sectionNumbers,
  }
}

function sectionNameToPlainText(name: unknown): string {
  if (name == null) return ''
  if (typeof name === 'string') return name.trim()
  if (typeof name === 'object') return proseMirrorToPlainText(name as Json).trim()
  return ''
}

/**
 * Format set sections for display (e.g. "Section 1: Verbal Reasoning · Section 2: Decision Making").
 */
export function formatSetSectionsDisplay(sections: unknown): string {
  if (!Array.isArray(sections)) return ''
  return sections
    .map((s: { section_number?: number; name?: unknown }) => {
      const name = sectionNameToPlainText(s?.name)
      if (s?.section_number != null && name) return `Section ${s.section_number}: ${name}`
      if (name) return name
      if (s?.section_number != null) return `Section ${s.section_number}`
      return ''
    })
    .filter(Boolean)
    .join(' · ')
}

/** True if set has single section and both question count and time limit match the section config. */
export function isSetFullyExamMatch(
  setStatus: SetSectionStatus
): boolean {
  return (
    setStatus.questionCountStatus === 'match' &&
    setStatus.timeLimitStatus === 'match'
  )
}

type MockSetForStatus = {
  sections?: unknown
  question_count?: number | null
  time_limit_seconds?: number | null
}

export type MockExamStatusResult = {
  status: UcatExamStatus
  tooltip: string
}

/**
 * Compute mock-level exam alignment status.
 * - match (green): one set per UCAT section, all sets have questions and timing matching their section.
 * - partial (orange): one set per section but at least one set doesn't match questions/timing.
 * - mismatch (red): wrong number of sets (not one per section).
 */
export function getMockExamStatus(
  setCount: number,
  sets: MockSetForStatus[],
  sections: UcatSectionForStatus[],
  getSetStatus: (set: SetForStatus, s: UcatSectionForStatus[]) => SetSectionStatus
): MockExamStatusResult {
  const sectionCount = sections.length
  const hasOneSetPerSection = setCount === sectionCount && sectionCount > 0

  if (!hasOneSetPerSection) {
    return {
      status: 'mismatch',
      tooltip: `UCAT has ${sectionCount} section(s). This mock has ${setCount} set(s). Add one set per section for exam-like practice.`,
    }
  }

  const allSetsMatch = sets.every((s) => {
    const parsed = parseSetSections(s.sections ?? null)
    const setStatus = getSetStatus(
      {
        sectionCount: parsed.sectionCount,
        firstSectionNumber: parsed.firstSectionNumber,
        question_count: s.question_count ?? null,
        time_limit_seconds: s.time_limit_seconds ?? null,
      },
      sections
    )
    return isSetFullyExamMatch(setStatus)
  })

  if (allSetsMatch) {
    return {
      status: 'match',
      tooltip: 'Matches UCAT exam: one set per section, correct question counts and time limits.',
    }
  }

  return {
    status: 'partial',
    tooltip: 'Has one set per section, but at least one set does not match its section\'s question count or time limit.',
  }
}

/**
 * Check if mock has correct number and order of sets.
 * - set count must equal section count
 * - set at position i must be for section at position i (sections ordered by section_number)
 */
export function isMockSetOrderCorrect(
  setCount: number,
  sets: MockSetForStatus[],
  sections: UcatSectionForStatus[]
): boolean {
  const sectionCount = sections.length
  if (setCount !== sectionCount || sectionCount === 0) return false
  const sectionsSorted = [...sections].sort(
    (a, b) => (a.section_number ?? 0) - (b.section_number ?? 0)
  )
  for (let i = 0; i < sectionCount; i++) {
    const set = sets[i]
    if (!set) return false
    const parsed = parseSetSections(set.sections ?? null)
    const expectedSectionNumber = sectionsSorted[i]?.section_number ?? null
    if (parsed.firstSectionNumber !== expectedSectionNumber) return false
  }
  return true
}
