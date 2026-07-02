import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  getSetSectionStatus,
  isSetFullyExamMatch,
  parseSetSections,
  type UcatSectionForStatus,
} from '@/features/ucat/shared/lib/set-section-status'

export type MockSetColumnIssue = 'none' | 'structural' | 'partial'

export type MockSetColumnRow =
  | {
      kind: 'set'
      setId: string
      name: string
      issue: MockSetColumnIssue
      tooltip: string
    }
  | {
      kind: 'gap'
      label: string
      tooltip: string
    }

type MockSetForColumn = {
  id: string
  name?: unknown
  sections?: unknown
  question_count?: number | null
  time_limit_seconds?: number | null
}

function getSetPlainName(name: unknown): string {
  return proseMirrorToPlainText(name as Json) || 'Untitled'
}

function sectionLabel(section: UcatSectionForStatus | undefined): string {
  if (!section) return 'section'
  if (section.section_number != null && section.name) {
    return `Section ${section.section_number}: ${section.name}`
  }
  return section.name ?? `Section ${section.section_number ?? '—'}`
}

function countDuplicateSections(sets: MockSetForColumn[]): Set<number> {
  const usage = new Map<number, number>()
  for (const set of sets) {
    const parsed = parseSetSections(set.sections ?? null)
    if (parsed.sectionCount === 1 && parsed.firstSectionNumber != null) {
      const sectionNumber = parsed.firstSectionNumber
      usage.set(sectionNumber, (usage.get(sectionNumber) ?? 0) + 1)
    }
  }
  return new Set(
    [...usage.entries()].filter(([, count]) => count > 1).map(([sectionNumber]) => sectionNumber),
  )
}

function buildSetRow(
  set: MockSetForColumn,
  sections: UcatSectionForStatus[],
  options: {
    expectedSection?: UcatSectionForStatus
    duplicateSections: Set<number>
    extra?: boolean
  },
): MockSetColumnRow {
  const parsed = parseSetSections(set.sections ?? null)
  const name = getSetPlainName(set.name)
  const setStatus = getSetSectionStatus(
    {
      sectionCount: parsed.sectionCount,
      firstSectionNumber: parsed.firstSectionNumber,
      question_count: set.question_count ?? null,
      time_limit_seconds: set.time_limit_seconds ?? null,
    },
    sections,
  )

  if (options.extra) {
    return {
      kind: 'set',
      setId: set.id,
      name,
      issue: 'structural',
      tooltip: `UCAT has ${sections.length} section(s). This set is beyond the expected number of sets.`,
    }
  }

  const expectedSectionNumber = options.expectedSection?.section_number ?? null
  const isMultiSection = parsed.sectionCount !== 1
  const isWrongSection =
    expectedSectionNumber != null && parsed.firstSectionNumber !== expectedSectionNumber
  const isDuplicateSection =
    parsed.firstSectionNumber != null && options.duplicateSections.has(parsed.firstSectionNumber)

  if (isMultiSection) {
    return {
      kind: 'set',
      setId: set.id,
      name,
      issue: 'structural',
      tooltip: setStatus.sectionsTooltip,
    }
  }

  if (isWrongSection && options.expectedSection) {
    const actualLabel =
      parsed.firstSectionNumber != null
        ? sections.find((section) => section.section_number === parsed.firstSectionNumber)
        : undefined
    return {
      kind: 'set',
      setId: set.id,
      name,
      issue: 'structural',
      tooltip: `This set is for ${sectionLabel(actualLabel)}, but this slot expects ${sectionLabel(options.expectedSection)}.`,
    }
  }

  if (isDuplicateSection) {
    return {
      kind: 'set',
      setId: set.id,
      name,
      issue: 'structural',
      tooltip: `Multiple sets use ${sectionLabel(
        sections.find((section) => section.section_number === parsed.firstSectionNumber) ?? undefined,
      )}. A mock should have one set per section.`,
    }
  }

  if (!isSetFullyExamMatch(setStatus)) {
    const details = [
      setStatus.questionCountStatus === 'mismatch' ? setStatus.questionCountTooltip : null,
      setStatus.timeLimitStatus === 'match' || setStatus.timeLimitStatus === 'untimed'
        ? null
        : setStatus.timeLimitTooltip,
    ].filter(Boolean)
    return {
      kind: 'set',
      setId: set.id,
      name,
      issue: 'partial',
      tooltip:
        details.length > 0
          ? details.join(' ')
          : 'This set does not fully match its section question count or time limit.',
    }
  }

  return {
    kind: 'set',
    setId: set.id,
    name,
    issue: 'none',
    tooltip: `Matches ${sectionLabel(options.expectedSection)}.`,
  }
}

export function buildMockSetsColumnRows(
  sets: MockSetForColumn[],
  sections: UcatSectionForStatus[],
): MockSetColumnRow[] {
  const sectionsSorted = [...sections].sort(
    (a, b) => (a.section_number ?? 0) - (b.section_number ?? 0),
  )
  const duplicateSections = countDuplicateSections(sets)
  const rows: MockSetColumnRow[] = []

  for (let index = 0; index < sectionsSorted.length; index += 1) {
    const expectedSection = sectionsSorted[index]
    const set = sets[index]

    if (!set) {
      rows.push({
        kind: 'gap',
        label: `Missing — ${sectionLabel(expectedSection)}`,
        tooltip: `Add a set for ${sectionLabel(expectedSection)}.`,
      })
      continue
    }

    rows.push(
      buildSetRow(set, sections, {
        expectedSection,
        duplicateSections,
      }),
    )
  }

  for (let index = sectionsSorted.length; index < sets.length; index += 1) {
    const set = sets[index]
    if (!set) continue
    rows.push(
      buildSetRow(set, sections, {
        duplicateSections,
        extra: true,
      }),
    )
  }

  return rows
}
