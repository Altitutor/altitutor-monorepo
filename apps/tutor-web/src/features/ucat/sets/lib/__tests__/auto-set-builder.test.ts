import {
  blueprintCategoryRanges,
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
  it('preserves existing stems and fills only the remaining category targets', () => {
    const existing = {
      ...stem('reading-existing', 'reading', 'Reading Comprehension'),
      setIds: ['current-set'],
    }
    const stems = [
      existing,
      ...Array.from({ length: 7 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]

    const result = buildAutoSetPreview({
      mode: 'category',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: true,
      categories,
      stems,
      existingStemIds: [existing.id],
      seed: 1,
    })

    expect(result.selectedStems.filter((item) => item.id === existing.id)).toHaveLength(1)
    expect(result.selectedStems).toHaveLength(11)
    expect(result.totalQuestions).toBe(44)
    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryId: 'reading', targetQuestions: 32, actualQuestions: 32 }),
        expect.objectContaining({ categoryId: 'tfct', targetQuestions: 12, actualQuestions: 12 }),
      ]),
    )
  })

  it('preserves existing stems when filling the default blueprint range targets', () => {
    const existing = {
      ...stem('reading-existing-range', 'reading', 'Reading Comprehension'),
      setIds: ['current-set'],
    }
    const stems = [
      existing,
      ...Array.from({ length: 7 }, (_, index) => stem(`range-reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`range-tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]

    const result = buildAutoSetPreview({
      mode: 'range',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: true,
      categories,
      stems,
      existingStemIds: [existing.id],
      seed: 1,
    })

    expect(result.selectedStems[0]?.id).toBe(existing.id)
    expect(result.selectedStems.filter((item) => item.id === existing.id)).toHaveLength(1)
    expect(result.totalQuestions).toBe(44)
    expect(result.blueprintCompliance?.compliant).toBe(true)
  })

  it('maps VR stem-unit rules into the same category question targets as By category', () => {
    const stems = [
      ...Array.from({ length: 8 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 3 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    expect(
      blueprintPreferredCategoryTargets({
        blueprint: UCAT_ANZ_2026_V1,
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
      mode: 'category',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
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
      mode: 'category',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
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
      mode: 'category',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
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
      mode: 'category',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
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
      mode: 'category',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 0,
      categoryTargets: {},
      categoryRanges: {},
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

describe('Total + category ranges', () => {
  const oneQuestion = (id: string, categoryId: string, categoryName: string): UcatStemCatalogItem => ({
    ...stem(id, categoryId, categoryName),
    questionsCount: 1,
    blueprintQuestions: [{
      id: `${id}-q0`,
      answerScheme: 'single_choice',
      optionCount: 4,
      requiredPlacementCount: 0,
    }],
  })

  it('blocks when sum of mins exceeds the global total', () => {
    const stems = [
      ...Array.from({ length: 10 }, (_, index) => oneQuestion(`a-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 10 }, (_, index) => oneQuestion(`b-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    const result = buildAutoSetPreview({
      mode: 'range',
      targetTotal: 5,
      categoryTargets: {},
      categoryRanges: {
        reading: { min: '4', max: '6' },
        tfct: { min: '3', max: '5' },
      },
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.selectedStems).toEqual([])
    expect(result.totalQuestions).toBe(0)
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/sum of minimums|minimums exceed/i)]),
    )
  })

  it('blocks when sum of maxes is below the global total', () => {
    const stems = [
      ...Array.from({ length: 10 }, (_, index) => oneQuestion(`a-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 10 }, (_, index) => oneQuestion(`b-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    const result = buildAutoSetPreview({
      mode: 'range',
      targetTotal: 20,
      categoryTargets: {},
      categoryRanges: {
        reading: { min: '2', max: '4' },
        tfct: { min: '2', max: '4' },
      },
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.selectedStems).toEqual([])
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/sum of maximums|maximums are below/i)]),
    )
  })

  it('hits the global total while keeping each category inside its range', () => {
    const stems = [
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`a-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`b-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    const result = buildAutoSetPreview({
      mode: 'range',
      targetTotal: 10,
      categoryTargets: {},
      categoryRanges: {
        reading: { min: '3', max: '7' },
        tfct: { min: '3', max: '7' },
      },
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.warnings).toEqual([])
    expect(result.totalQuestions).toBe(10)
    expect(result.targetQuestions).toBe(10)
    for (const row of result.byCategory) {
      expect(row.actualQuestions).toBeGreaterThanOrEqual(row.minQuestions ?? 0)
      expect(row.actualQuestions).toBeLessThanOrEqual(row.maxQuestions ?? 0)
    }
    const reading = result.byCategory.find((row) => row.categoryId === 'reading')
    const tfct = result.byCategory.find((row) => row.categoryId === 'tfct')
    expect((reading?.actualQuestions ?? 0) + (tfct?.actualQuestions ?? 0)).toBe(10)
  })

  it('trades off between categories to hit the global total near midpoints', () => {
    const stems = [
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`a-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 20 }, (_, index) => oneQuestion(`b-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    const result = buildAutoSetPreview({
      mode: 'range',
      targetTotal: 10,
      categoryTargets: {},
      categoryRanges: {
        reading: { min: '2', max: '8' },
        tfct: { min: '2', max: '8' },
      },
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.totalQuestions).toBe(10)
    const reading = result.byCategory.find((row) => row.categoryId === 'reading')
    const tfct = result.byCategory.find((row) => row.categoryId === 'tfct')
    // Midpoints are 5/5; equal split minimises midpoint distance.
    expect(reading?.actualQuestions).toBe(5)
    expect(tfct?.actualQuestions).toBe(5)
  })

  it('falls back to the closest in-range total when exact T is impossible with whole stems', () => {
    const stems = [
      ...Array.from({ length: 5 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 5 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    const result = buildAutoSetPreview({
      mode: 'range',
      targetTotal: 10,
      categoryTargets: {},
      categoryRanges: {
        reading: { min: '4', max: '8' },
        tfct: { min: '4', max: '8' },
      },
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    // 4-question stems only → achievable in-range totals are multiples of 4 (8, 12, 16…).
    expect(result.totalQuestions).not.toBe(10)
    expect([8, 12, 16]).toContain(result.totalQuestions)
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/not exactly 10/i)]),
    )
    for (const row of result.byCategory) {
      expect(row.actualQuestions).toBeGreaterThanOrEqual(row.minQuestions ?? 0)
      expect(row.actualQuestions).toBeLessThanOrEqual(row.maxQuestions ?? 0)
    }
  })

  it('maps VR blueprint policy into question ranges and official total for range + 2026', () => {
    const stems = [
      ...Array.from({ length: 10 }, (_, index) => stem(`reading-${index}`, 'reading', 'Reading Comprehension')),
      ...Array.from({ length: 5 }, (_, index) => stem(`tfct-${index}`, 'tfct', "True, False, Can't Tell")),
    ]
    expect(
      blueprintCategoryRanges({
        blueprint: UCAT_ANZ_2026_V1,
        sectionNumber: 1,
        categories: [
          { id: 'reading', name: 'Reading Comprehension' },
          { id: 'tfct', name: "True, False, Can't Tell" },
        ],
        eligibleStems: stems,
      }),
    ).toEqual({
      reading: { min: '28', max: '36', preferred: '32' },
      tfct: { min: '8', max: '16', preferred: '12' },
    })

    const result = buildAutoSetPreview({
      mode: 'range',
      blueprint: UCAT_ANZ_2026_V1,
      targetTotal: 44,
      categoryTargets: {},
      categoryRanges: {
        reading: { min: '28', max: '36' },
        tfct: { min: '8', max: '16' },
      },
      sectionId: 'vr',
      sectionNumber: 1,
      stemVisibility: 'either',
      onlyNotInAnotherSet: false,
      categories,
      stems,
      seed: 1,
    })

    expect(result.totalQuestions).toBe(44)
    expect(result.blueprintCompliance?.compliant).toBe(true)
    expect(result.warnings).toEqual([])
  })
})
