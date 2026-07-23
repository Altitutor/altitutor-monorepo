import {
  searchQuestionCandidates,
  searchQuestionStemCandidates,
  scoreCatalogMatch,
} from '../catalog-candidate-search'
import type {
  UcatQuestionCatalogItem,
  UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'

function stem(partial: Partial<UcatStemCatalogItem> & Pick<UcatStemCatalogItem, 'id' | 'text'>): UcatStemCatalogItem {
  return {
    questionsCount: 1,
    sectionName: 'Decision Making',
    sectionNumber: 1,
    sectionId: null,
    categoryId: null,
    categoryName: null,
    accessScope: 'public',
    status: 'published',
    sourceChannel: null,
    questionTypes: [],
    tagIds: [],
    createdAt: null,
    questionSearchText: '',
    answerOptionSearchText: '',
    setNames: '',
    setIds: [],
    typeSummary: '',
    ...partial,
  }
}

function question(
  partial: Partial<UcatQuestionCatalogItem> & Pick<UcatQuestionCatalogItem, 'id' | 'label'>,
): UcatQuestionCatalogItem {
  return {
    stemId: 'stem-1',
    questionIndex: 0,
    sectionName: 'Decision Making',
    questionType: 'multiple_choice',
    ...partial,
  }
}

describe('catalog candidate search', () => {
  it('scores term overlaps', () => {
    expect(scoreCatalogMatch('syllogism practice', 'DM Syllogisms practice stem')).toBeGreaterThan(0)
    expect(scoreCatalogMatch('xyzzy', 'unrelated stem')).toBe(0)
  })

  it('returns top stem candidates without inserting', () => {
    const candidates = searchQuestionStemCandidates('syllogism hospital', [
      stem({ id: 'a', text: 'A hospital syllogism about wards', categoryName: 'Syllogisms', typeSummary: 'MCQ' }),
      stem({ id: 'b', text: 'Unrelated charts about rainfall', categoryName: 'Graphs and Charts' }),
      stem({ id: 'c', text: 'Another syllogism without hospital', categoryName: 'Syllogisms' }),
    ], 2)

    expect(candidates).toHaveLength(2)
    expect(candidates[0]?.id).toBe('a')
    expect(candidates.every((candidate) => candidate.score > 0)).toBe(true)
  })

  it('returns top question candidates', () => {
    const candidates = searchQuestionCandidates('venn diagram', [
      question({ id: 'q1', label: 'Venn diagram overlap question', questionType: 'multiple_choice' }),
      question({ id: 'q2', label: 'Reading comprehension passage', questionType: 'syllogism' }),
    ])

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.id).toBe('q1')
  })
})
