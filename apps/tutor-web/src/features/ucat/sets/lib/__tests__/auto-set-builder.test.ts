import { buildAutoSetPreview } from '@/features/ucat/sets/lib/auto-set-builder'
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
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("True, False, Can't Tell"),
    ]))
  })
})
