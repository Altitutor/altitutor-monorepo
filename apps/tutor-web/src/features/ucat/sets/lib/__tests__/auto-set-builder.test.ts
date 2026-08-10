import { buildAutoSetPreview } from '@/features/ucat/sets/lib/auto-set-builder'
import { UCAT_ANZ_2026_V1 } from '@altitutor/ucat-blueprint'
import { recalculateLinkedMockBlueprintCompliance } from '@/features/ucat/mocks/lib/blueprint-compliance'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'

function stem(id: string, categoryId: string, categoryName: string): UcatStemCatalogItem {
  return {
    id,
    text: id,
    questionsCount: 4,
    sectionName: 'Verbal Reasoning',
    sectionNumber: 1,
    sectionId: 'vr',
    categoryId,
    categoryName,
    presentationFormat: 'passage',
    accessScope: 'public',
    status: 'published',
    sourceChannel: 'individual',
    questionTypes: ['multiple_choice'],
    responseTypes: ['multiple_choice'],
    answerSchemes: ['single_choice'],
    blueprintQuestions: Array.from({ length: 4 }, (_, index) => ({
      id: `${id}-q${index}`,
      answerScheme: 'single_choice',
      optionCount: 4,
      requiredPlacementCount: 0,
    })),
    tagIds: [],
    createdAt: null,
    questionSearchText: '',
    answerOptionSearchText: '',
    setNames: '—',
    setIds: [],
    typeSummary: 'multiple_choice',
  }
}

const categories = [
  { id: 'reading', name: 'Reading Comprehension', ucat_section_id: 'vr' },
  { id: 'tfct', name: "True, False, Can't Tell", ucat_section_id: 'vr' },
]

describe('2026 blueprint set creation', () => {
  it('selects whole stems only when the exact total and every range can be met', () => {
    const stems = [
      ...Array.from({ length: 8 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]

    const result = buildAutoSetPreview({
      mode: 'blueprint',
      targetTotal: 0,
      categoryTargets: {},
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.totalQuestions).toBe(44)
    expect(result.selectedStems).toHaveLength(11)
    expect(result.warnings).toEqual([])
    expect(result.blueprintCompliance?.compliant).toBe(true)
    expect(result.blueprintCompliance?.sections[0]?.checks.length).toBeGreaterThan(0)
    expect(result.blueprintCompliance?.sections[0]?.checks.every(check => check.reason.length > 0)).toBe(true)
  })

  it('returns explicit shortfalls and no nearest invalid composition', () => {
    const stems = Array.from({ length: 10 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension'))

    const result = buildAutoSetPreview({
      mode: 'blueprint',
      targetTotal: 0,
      categoryTargets: {},
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.selectedStems).toEqual([])
    expect(result.blueprintCompliance?.sections[0]?.checks.find(check => check.code === 'QUESTION_TOTAL_MISMATCH')?.actual).toBe(0)
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("True, False, Can't Tell"),
    ]))
  })

  it('recalculates linked mock rules from an unsaved set draft', () => {
    const stems = [
      ...Array.from({ length: 8 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ].map(item => ({ ...item, setIds: ['set-1'] }))
    const initial = buildAutoSetPreview({
      mode: 'blueprint', targetTotal: 0, categoryTargets: {}, sectionId: 'vr', sectionNumber: 1,
      stemVisibility: 'either', onlyNotInAnotherSet: false, categories, stems, seed: 1,
    })

    const [report] = recalculateLinkedMockBlueprintCompliance({
      linkedReports: [{
        mockId: 'mock-1', mockName: 'Mock', blueprintId: 'bp-1', setIds: ['set-1'],
        compliance: initial.blueprintCompliance!,
      }],
      blueprints: [{
        id: 'bp-1', code: UCAT_ANZ_2026_V1.id, test_year: UCAT_ANZ_2026_V1.testYear,
        version: UCAT_ANZ_2026_V1.version,
        official_facts_label: UCAT_ANZ_2026_V1.official.label,
        altitutor_policy_label: UCAT_ANZ_2026_V1.altitutorPolicy.label,
        sections: UCAT_ANZ_2026_V1.official.sections.map((official, sectionIndex) => ({
          section: official.section,
          sectionIndex,
          exactQuestionCount: official.questionCount,
          answeringTimeSeconds: official.answeringTimeSeconds,
          instructionTimeSeconds: official.instructionTimeSeconds,
          altitutorCompositionPolicy: UCAT_ANZ_2026_V1.altitutorPolicy.sectionRules.find(
            rule => rule.section === official.section,
          ),
        })),
      }],
      setCatalog: [{
        id: 'set-1', name: 'VR', sectionDisplay: 'VR', sectionCount: 1, firstSectionNumber: 1,
        question_count: 44, time_limit_seconds: 1320,
      }],
      stemCatalog: stems,
      editedSet: {
        id: 'set-1', stemIds: stems.slice(0, -1).map(item => item.id),
        timeLimitSeconds: 1320, sectionNumbers: [1],
      },
    })

    expect(report?.compliance.compliant).toBe(false)
    expect(report?.compliance.sections[0]?.checks.some(check => !check.compliant)).toBe(true)
  })
})
