import {
  blueprintPreferredCategoryTargets,
  buildAutoSetPreview,
} from '@/features/ucat/sets/lib/auto-set-builder'
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
  it('maps VR stem-unit rules into the same category question targets as By category', () => {
    const stems = [
      ...Array.from({ length: 8 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    expect(
      blueprintPreferredCategoryTargets({
        sectionNumber: 1,
        categories: [
          { id: 'reading', name: 'Reading Comprehension' },
          { id: 'tfct', name: "True, False, Can't Tell" },
        ],
        eligibleStems: stems,
      }),
    ).toEqual({
      reading: '32',
      tfct: '12',
    })
  })

  it('selects whole stems via the category path when preferred targets can be met', () => {
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
    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId: 'reading', targetQuestions: 32, actualQuestions: 32 }),
        expect.objectContaining({ categoryId: 'tfct', targetQuestions: 12, actualQuestions: 12 }),
      ]),
    )
    expect(result.warnings).toEqual([])
    expect(result.blueprintCompliance?.compliant).toBe(true)
  })

  it('returns category shortfalls instead of hanging when a named category is empty', () => {
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

    expect(result.byCategory.find((row) => row.categoryId === 'tfct')?.actualQuestions).toBe(0)
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("True, False, Can't Tell")]),
    )
    expect(result.blueprintCompliance?.compliant).toBe(false)
  })

  it('selects a compliant set from a large catalog using per-category picks', () => {
    const stems = [
      ...Array.from({ length: 80 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 40 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
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
  })

  it('selects a Decision Making set from preferred category question targets', () => {
    const dmCategories = [
      { id: 'syl', name: 'Syllogisms', ucat_section_id: 'dm' },
      { id: 'lp', name: 'Logical Puzzles', ucat_section_id: 'dm' },
      { id: 'ra', name: 'Recognising Assumptions', ucat_section_id: 'dm' },
      { id: 'iidc', name: 'Interpreting Information and Drawing Conclusions', ucat_section_id: 'dm' },
      { id: 'venn', name: 'Venn Diagrams', ucat_section_id: 'dm' },
      { id: 'prob', name: 'Probabilistic and Statistical Reasoning', ucat_section_id: 'dm' },
    ]
    const oneQuestion = (id: string, categoryId: string, categoryName: string): UcatStemCatalogItem => ({
      ...stem(id, categoryId, categoryName),
      sectionId: 'dm',
      sectionName: 'Decision Making',
      sectionNumber: 2,
      questionsCount: 1,
      blueprintQuestions: [{
        id: `${id}-q0`,
        answerScheme: 'single_choice',
        optionCount: 4,
        requiredPlacementCount: 0,
      }],
    })
    const stems = [
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`syl-${index}`, 'syl', 'Syllogisms')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`lp-${index}`, 'lp', 'Logical Puzzles')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`ra-${index}`, 'ra', 'Recognising Assumptions')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`iidc-${index}`, 'iidc', 'Interpreting Information and Drawing Conclusions')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`venn-${index}`, 'venn', 'Venn Diagrams')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`prob-${index}`, 'prob', 'Probabilistic and Statistical Reasoning')),
    ]

    const result = buildAutoSetPreview({
      mode: 'blueprint',
      targetTotal: 0,
      categoryTargets: {},
      sectionId: 'dm',
      sectionNumber: 2,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories: dmCategories,
      stems,
      seed: 1,
    })

    expect(result.warnings).toEqual([])
    expect(result.totalQuestions).toBe(35)
    expect(result.byCategory).toHaveLength(6)
    expect(result.blueprintCompliance?.compliant).toBe(true)
  })

  it('recalculates linked mock rules from an unsaved set draft', () => {
    const stems = [
      ...Array.from({ length: 8 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ].map((item) => ({ ...item, setIds: ['set-1'] }))
    const initial = buildAutoSetPreview({
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

    const [report] = recalculateLinkedMockBlueprintCompliance({
      linkedReports: [{
        mockId: 'mock-1',
        mockName: 'Mock',
        blueprintId: 'bp-1',
        setIds: ['set-1'],
        compliance: initial.blueprintCompliance!,
      }],
      blueprints: [{
        id: 'bp-1',
        code: UCAT_ANZ_2026_V1.id,
        test_year: UCAT_ANZ_2026_V1.testYear,
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
            (rule) => rule.section === official.section,
          ),
        })),
      }],
      setCatalog: [{
        id: 'set-1',
        name: 'VR',
        sectionDisplay: 'VR',
        sectionCount: 1,
        firstSectionNumber: 1,
        question_count: 44,
        time_limit_seconds: 1320,
      }],
      stemCatalog: stems,
      editedSet: {
        id: 'set-1',
        stemIds: stems.slice(0, -1).map((item) => item.id),
        timeLimitSeconds: 1320,
        sectionNumbers: [1],
      },
    })

    expect(report?.compliance.compliant).toBe(false)
    expect(report?.compliance.sections[0]?.checks.some((check) => !check.compliant)).toBe(true)
  })
})
