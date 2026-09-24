import {
  evaluateBlueprint,
  isPublicationBlockingBlueprintCode,
  type BlueprintComposition,
  type BlueprintEvaluation,
  type BlueprintSectionCode,
  type BlueprintStem,
  type UcatBlueprint,
} from '@altitutor/ucat-blueprint'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'

export type StoredBlueprintCheck = {
  code: string
  label: string
  unit: string
  actual: number | null
  compliant: boolean
  target?: number | null
  expected?: number | null
  minimum?: number | null
  preferred?: number | null
  maximum?: number | null
  reason: string
}

export type StoredBlueprintCompliance = {
  applicable: boolean
  compliant: boolean
  blueprintId?: string | null
  blueprintCode?: string | null
  testYear?: number
  version?: number
  sections: Array<{
    section: BlueprintSectionCode
    compliant: boolean
    checks: StoredBlueprintCheck[]
  }>
  reasons?: Array<{ code: string; message: string; severity?: 'error' | 'warning' | 'information' }>
}

export type LinkedMockBlueprintCompliance = {
  mockId: string
  mockName: string
  blueprintId: string
  setIds: string[]
  compliance: StoredBlueprintCompliance
}

export type StoredMockBlueprintAudit = {
  id: string
  mockId: string
  blueprintId: string
  blueprintCode: string
  testYear: number
  version: number
  checkedAt: string
  decision: 'eligible' | 'provisional' | 'failed' | 'attached'
  gateResults: {
    compliance: StoredBlueprintCompliance
    publicationState: { compliant: boolean; reason: string }
    sectionPurity: { compliant: boolean; reason: string }
    provisionalMetadata: { reviewed: boolean; reason: string }
  }
}

export function parseStoredMockBlueprintAudit(value: unknown): StoredMockBlueprintAudit | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const gates = row.gate_results
  if (!gates || typeof gates !== 'object') return null
  const gateResults = gates as Record<string, unknown>
  const compliance = parseStoredBlueprintCompliance(gateResults.compliance)
  const publicationState = gateResults.publicationState as { compliant?: unknown; reason?: unknown } | undefined
  const sectionPurity = gateResults.sectionPurity as { compliant?: unknown; reason?: unknown } | undefined
  const provisionalMetadata = gateResults.provisionalMetadata as { reviewed?: unknown; reason?: unknown } | undefined
  const decision = row.decision
  if (
    typeof row.id !== 'string' || typeof row.mock_id !== 'string' || typeof row.blueprint_id !== 'string'
    || typeof row.blueprint_code !== 'string' || typeof row.test_year !== 'number' || typeof row.version !== 'number'
    || typeof row.checked_at !== 'string' || !['eligible', 'provisional', 'failed', 'attached'].includes(String(decision))
    || !compliance || typeof publicationState?.compliant !== 'boolean' || typeof publicationState.reason !== 'string'
    || typeof sectionPurity?.compliant !== 'boolean' || typeof sectionPurity.reason !== 'string'
    || typeof provisionalMetadata?.reviewed !== 'boolean' || typeof provisionalMetadata.reason !== 'string'
  ) return null
  return {
    id: row.id,
    mockId: row.mock_id,
    blueprintId: row.blueprint_id,
    blueprintCode: row.blueprint_code,
    testYear: row.test_year,
    version: row.version,
    checkedAt: row.checked_at,
    decision: decision as StoredMockBlueprintAudit['decision'],
    gateResults: {
      compliance,
      publicationState: publicationState as { compliant: boolean; reason: string },
      sectionPurity: sectionPurity as { compliant: boolean; reason: string },
      provisionalMetadata: provisionalMetadata as { reviewed: boolean; reason: string },
    },
  }
}

export type BlueprintRow = {
  id?: string | null
  code: string | null
  test_year: number | null
  version: number | null
  official_facts_label: string | null
  altitutor_policy_label: string | null
  sections: unknown
}

const sectionByNumber: Record<number, BlueprintSectionCode> = {
  1: 'verbal_reasoning',
  2: 'decision_making',
  3: 'quantitative_reasoning',
  4: 'situational_judgement',
}

export function catalogStemToBlueprintStem(stem: UcatStemCatalogItem): BlueprintStem {
  return {
    id: stem.id,
    category: stem.categoryName ?? 'Uncategorised',
    categoryId: stem.categoryId ?? undefined,
    questions: stem.blueprintQuestions ?? [],
  }
}

export function evaluateDraftMockBlueprint(
  blueprint: UcatBlueprint,
  setIds: string[],
  setCatalog: SetOption[],
  stemCatalog: UcatStemCatalogItem[],
): BlueprintEvaluation {
  const selectedSets = setIds.flatMap(setId => {
    const set = setCatalog.find(candidate => candidate.id === setId)
    return set ? [set] : []
  })
  const sections: BlueprintComposition['sections'] = selectedSets.flatMap(set => {
    const section = set.firstSectionNumber == null ? undefined : sectionByNumber[set.firstSectionNumber]
    if (!section) return []
    const official = blueprint.official.sections.find(candidate => candidate.section === section)
    if (!official) return []
    return [{
      section,
      answeringTimeSeconds: set.time_limit_seconds ?? 0,
      instructionTimeSeconds: official.instructionTimeSeconds,
      stems: stemCatalog
        .filter(stem => stem.setIds.includes(set.id))
        .map(catalogStemToBlueprintStem),
    }]
  })
  const representedSections = new Set(sections.map(section => section.section))
  for (const official of blueprint.official.sections) {
    if (!representedSections.has(official.section)) {
      sections.push({
        section: official.section,
        answeringTimeSeconds: 0,
        instructionTimeSeconds: official.instructionTimeSeconds,
        stems: [],
      })
    }
  }
  return evaluateBlueprint(blueprint, { purpose: 'full_mock', sections })
}

export function blueprintRowToModel(row: BlueprintRow): UcatBlueprint | null {
  if (
    typeof row.code !== 'string'
    || typeof row.test_year !== 'number'
    || typeof row.version !== 'number'
    || typeof row.official_facts_label !== 'string'
    || typeof row.altitutor_policy_label !== 'string'
  ) return null
  if (!Array.isArray(row.sections)) return null
  type ParsedSection = {
    section: string
    sectionIndex: number
    exactQuestionCount: number
    answeringTimeSeconds: number
    instructionTimeSeconds: number
    altitutorCompositionPolicy: Record<string, unknown>
  }
  const sections = row.sections.flatMap<ParsedSection>(section => {
    if (!section || typeof section !== 'object') return []
    const candidate = section as {
      section?: unknown
      sectionIndex?: unknown
      exactQuestionCount?: unknown
      answeringTimeSeconds?: unknown
      instructionTimeSeconds?: unknown
      altitutorCompositionPolicy?: unknown
    }
    if (
      typeof candidate.section !== 'string'
      || typeof candidate.sectionIndex !== 'number'
      || typeof candidate.exactQuestionCount !== 'number'
      || typeof candidate.answeringTimeSeconds !== 'number'
      || typeof candidate.instructionTimeSeconds !== 'number'
      || !candidate.altitutorCompositionPolicy
      || typeof candidate.altitutorCompositionPolicy !== 'object'
    ) return []
    return [candidate as ParsedSection]
  }).sort((left, right) => left.sectionIndex - right.sectionIndex)
  if (sections.length === 0) return null

  return {
    id: row.code,
    testYear: row.test_year,
    version: row.version,
    official: {
      label: row.official_facts_label,
      sections: sections.map(section => ({
        section: section.section as BlueprintSectionCode,
        questionCount: section.exactQuestionCount,
        answeringTimeSeconds: section.answeringTimeSeconds,
        instructionTimeSeconds: section.instructionTimeSeconds,
      })),
    },
    altitutorPolicy: {
      label: row.altitutor_policy_label,
      sectionRules: sections.map(section => ({
        section: section.section as BlueprintSectionCode,
        ...section.altitutorCompositionPolicy,
      })) as UcatBlueprint['altitutorPolicy']['sectionRules'],
    },
  } as UcatBlueprint
}

export function evaluationToStoredCompliance(evaluation: BlueprintEvaluation): StoredBlueprintCompliance {
  return {
    applicable: evaluation.applicable,
    compliant: evaluation.compliant,
    blueprintCode: evaluation.blueprintId,
    sections: evaluation.sections.map(section => ({
      section: section.section,
      compliant: !evaluation.reasons.some(reason =>
        reason.section === section.section && reason.severity === 'error',
      )
        && evaluation.checks
          .filter(check =>
            check.section === section.section
            && isPublicationBlockingBlueprintCode(check.code),
          )
          .every(check => check.compliant),
      checks: evaluation.checks
        .filter(check => check.section === section.section)
        .map(check => ({
          ...check,
          target: check.expected,
          reason: check.expected !== undefined
            ? `Target ${check.expected}; actual ${check.actual}.`
            : `Allowed ${check.minimum ?? '—'}–${check.maximum ?? '—'}; actual ${check.actual}.`,
        })),
    })),
    reasons: evaluation.reasons.map(reason => ({
      code: reason.code,
      message: reason.message,
      severity: reason.severity,
    })),
  }
}

export function parseStoredBlueprintCompliance(value: unknown): StoredBlueprintCompliance | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<StoredBlueprintCompliance>
  if (typeof candidate.applicable !== 'boolean' || typeof candidate.compliant !== 'boolean' || !Array.isArray(candidate.sections)) {
    return null
  }
  return candidate as StoredBlueprintCompliance
}

export function parseLinkedMockBlueprintCompliance(value: unknown): LinkedMockBlueprintCompliance[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as {
      mockId?: unknown
      mockName?: unknown
      blueprintId?: unknown
      setIds?: unknown
      compliance?: unknown
    }
    const compliance = parseStoredBlueprintCompliance(candidate.compliance)
    const setIds = Array.isArray(candidate.setIds)
      ? candidate.setIds.filter((id): id is string => typeof id === 'string')
      : []
    return typeof candidate.mockId === 'string'
      && typeof candidate.mockName === 'string'
      && typeof candidate.blueprintId === 'string'
      && compliance
      ? [{
          mockId: candidate.mockId,
          mockName: candidate.mockName,
          blueprintId: candidate.blueprintId,
          setIds,
          compliance,
        }]
      : []
  })
}

export function recalculateLinkedMockBlueprintCompliance({
  linkedReports,
  blueprints,
  setCatalog,
  stemCatalog,
  editedSet,
}: {
  linkedReports: LinkedMockBlueprintCompliance[]
  blueprints: BlueprintRow[]
  setCatalog: SetOption[]
  stemCatalog: UcatStemCatalogItem[]
  editedSet: {
    id: string
    stemIds: string[]
    timeLimitSeconds: number | null
    sectionNumbers: number[]
  }
}): LinkedMockBlueprintCompliance[] {
  const draftStemIds = new Set(editedSet.stemIds)
  const draftStems = stemCatalog.map(stem => ({
    ...stem,
    setIds: [
      ...stem.setIds.filter(setId => setId !== editedSet.id),
      ...(draftStemIds.has(stem.id) ? [editedSet.id] : []),
    ],
  }))
  const current = setCatalog.find(set => set.id === editedSet.id)
  const draftSectionNumber = editedSet.sectionNumbers.length === 1 ? editedSet.sectionNumbers[0] ?? null : null
  const draftSets = [
    ...setCatalog.filter(set => set.id !== editedSet.id),
    {
      id: editedSet.id,
      name: current?.name ?? 'Current set',
      sectionDisplay: current?.sectionDisplay ?? '',
      sectionCount: editedSet.sectionNumbers.length,
      firstSectionNumber: draftSectionNumber,
      question_count: editedSet.stemIds.reduce(
        (total, stemId) => total + (stemCatalog.find(stem => stem.id === stemId)?.questionsCount ?? 0),
        0,
      ),
      time_limit_seconds: editedSet.timeLimitSeconds,
      access_scope: current?.access_scope ?? null,
      stem_count: editedSet.stemIds.length,
    },
  ]

  return linkedReports.map(report => {
    const row = blueprints.find(blueprint => blueprint.id === report.blueprintId)
    const blueprint = row ? blueprintRowToModel(row) : null
    if (!blueprint) return report
    const compliance = evaluationToStoredCompliance(
      evaluateDraftMockBlueprint(blueprint, report.setIds, draftSets, draftStems),
    )
    if (editedSet.sectionNumbers.length !== 1) {
      compliance.compliant = false
      compliance.reasons = [{
        code: 'SET_SECTION_COUNT_INVALID',
        message: `A blueprint section set must contain stems from exactly one section; found ${editedSet.sectionNumbers.length}.`,
      }, ...(compliance.reasons ?? [])]
    }
    return {
      ...report,
      compliance,
    }
  })
}

export function blueprintSectionCode(sectionNumber: number | null | undefined): BlueprintSectionCode | null {
  return sectionNumber == null ? null : sectionByNumber[sectionNumber] ?? null
}
