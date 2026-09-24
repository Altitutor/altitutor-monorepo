import {
  buildSetMembershipCatalogRows,
  setDetailStemToFallback,
  stemCatalogItemToFallback,
} from '@/features/ucat/sets/lib/set-membership-rows'
import type { UcatQuestionCatalogRow } from '@/features/ucat/questions/api/questions'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

describe('buildSetMembershipCatalogRows', () => {
  it('keeps every set stem even when the catalog has not loaded it yet', () => {
    const rows = buildSetMembershipCatalogRows({
      stemIds: ['missing', 'loaded'],
      catalogRows: [{ id: 'loaded', question_count: 4, stem_text: 'Loaded' } as UcatQuestionCatalogRow],
      fallbackStems: [
        setDetailStemToFallback({
          stem_id: 'missing',
          stem_text: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'From set' }] }] },
          questions_meta: [{ id: 'q1', index: 0 }, { id: 'q2', index: 1 }],
        }),
      ],
    })

    expect(rows.map((row) => row.id)).toEqual(['missing', 'loaded'])
    expect(rows[0]?.question_count).toBe(2)
    expect(proseMirrorToPlainText(rows[0]?.stem_text ?? null)).toBe('From set')
    expect(rows[1]?.question_count).toBe(4)
  })

  it('prefers the questions catalog over add-stem catalog fallback', () => {
    const fallback = stemCatalogItemToFallback({
      id: 'stem-1',
      text: 'Sidebar copy',
      questionsCount: 1,
      sectionName: 'VR',
      sectionNumber: 1,
      sectionId: 'section-1',
      categoryId: null,
      categoryName: null,
      accessScope: 'public',
      status: 'draft',
      sourceChannel: 'individual',
      tagIds: [],
      createdAt: null,
      questionSearchText: '',
      answerOptionSearchText: '',
      setNames: '—',
      setIds: [],
      typeSummary: '-',
    } satisfies UcatStemCatalogItem)

    const rows = buildSetMembershipCatalogRows({
      stemIds: ['stem-1'],
      catalogRows: [{ id: 'stem-1', question_count: 5, stem_text: 'Catalog copy' } as UcatQuestionCatalogRow],
      fallbackStems: [fallback],
    })

    expect(rows[0]?.question_count).toBe(5)
    expect(rows[0]?.stem_text).toBe('Catalog copy')
  })
})
