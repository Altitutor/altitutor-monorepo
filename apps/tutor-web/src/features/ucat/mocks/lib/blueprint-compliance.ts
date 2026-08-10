import {
  evaluateBlueprint,
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
    presentationFormat: stem.presentationFormat ?? null,
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
  return evaluateBlueprint(blueprint, { purpose: 'full_mock', sections })
}

export function blueprintRowToModel(row: {
  code: string
  test_year: number
  version: number
  official_facts_label: string
  altitutor_policy_label: string
  sections: unknown
}): UcatBlueprint | null {
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
      compliant: evaluation.checks
        .filter(check => check.section === section.section)
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

export function parseLinkedMockBlueprintCompliance(value: unknown): Array<{
  mockId: string
  mockName: string
  compliance: StoredBlueprintCompliance
}> {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as { mockId?: unknown; mockName?: unknown; compliance?: unknown }
    const compliance = parseStoredBlueprintCompliance(candidate.compliance)
    return typeof candidate.mockId === 'string' && typeof candidate.mockName === 'string' && compliance
      ? [{ mockId: candidate.mockId, mockName: candidate.mockName, compliance }]
      : []
  })
}

export function blueprintSectionCode(sectionNumber: number | null | undefined): BlueprintSectionCode | null {
  return sectionNumber == null ? null : sectionByNumber[sectionNumber] ?? null
}
